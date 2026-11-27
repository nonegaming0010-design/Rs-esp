import crypto from 'crypto';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

export interface FirebaseTokenPayload {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  auth_time?: unknown;
  email?: unknown;
  email_verified?: unknown;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> = {};
let cacheExpiresAtMs = 0;

export function extractBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function decodeBase64UrlToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export function parseJwtParts(token: string): {
  header: JwtHeader;
  payload: FirebaseTokenPayload;
  signingInput: string;
  signature: Buffer;
} {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    throw new Error('Malformed authentication token.');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(decodeBase64UrlToBuffer(headerB64).toString('utf8')) as JwtHeader;
  const payload = JSON.parse(decodeBase64UrlToBuffer(payloadB64).toString('utf8')) as FirebaseTokenPayload;
  const signature = decodeBase64UrlToBuffer(sigB64);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
    throw new Error('Unsupported or missing token signature key.');
  }

  return {
    header,
    payload,
    signingInput: `${headerB64}.${payloadB64}`,
    signature,
  };
}

export function validateFirebaseTokenClaims(
  payload: FirebaseTokenPayload,
  projectId: string,
  nowEpochSec = Math.floor(Date.now() / 1000)
): VerifiedFirebaseUser {
  if (!projectId) {
    throw new Error('Firebase project ID is not configured on the server.');
  }
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId) {
    throw new Error('Authentication token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Authentication token issuer mismatch.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    throw new Error('Authentication token subject is invalid.');
  }
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowEpochSec - 30) {
    throw new Error('Your sign-in session has expired. Please sign in again.');
  }
  if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > nowEpochSec + 300) {
    throw new Error('Authentication token issued-at timestamp is invalid.');
  }
  if (
    typeof payload.auth_time === 'number' &&
    (!Number.isFinite(payload.auth_time) || payload.auth_time > nowEpochSec + 300)
  ) {
    throw new Error('Authentication time claim is invalid.');
  }

  return {
    uid: payload.sub.trim(),
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
  };
}

export function parseCacheMaxAgeMs(cacheControlHeader: string | null): number {
  if (!cacheControlHeader) return 3600_000;
  const match = cacheControlHeader.match(/max-age\s*=\s*(\d+)/i);
  if (!match) return 3600_000;
  const sec = Number.parseInt(match[1], 10);
  if (!Number.isFinite(sec) || sec <= 0) return 60_000;
  return Math.min(sec * 1000, 24 * 3600_000);
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && Object.keys(cachedCerts).length > 0 && now < cacheExpiresAtMs) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Unable to load Firebase public certificates (HTTP ${res.status}).`);
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = certs;
  cacheExpiresAtMs = now + parseCacheMaxAgeMs(res.headers.get('cache-control'));
  return certs;
}

export function verifyRs256Signature(signingInput: string, signature: Buffer, publicKeyPem: string): boolean {
  try {
    return crypto.verify('RSA-SHA256', Buffer.from(signingInput, 'utf8'), publicKeyPem, signature);
  } catch {
    return false;
  }
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string
): Promise<VerifiedFirebaseUser> {
  const { header, payload, signingInput, signature } = parseJwtParts(token);
  const kid = header.kid!;

  let certs = await fetchGooglePublicCerts(false);
  let certPem = certs[kid];
  if (!certPem) {
    certs = await fetchGooglePublicCerts(true);
    certPem = certs[kid];
  }
  if (!certPem) {
    throw new Error('Signing key for authentication token was not recognized.');
  }

  if (!verifyRs256Signature(signingInput, signature, certPem)) {
    throw new Error('Invalid authentication token signature.');
  }

  return validateFirebaseTokenClaims(payload, projectId);
}
