import type { CloudSketchVisibility, FrameworkId, WiringItem } from '../types/esp';

export const CLOUD_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 60,
  PHOTO_URL_MAX: 500,
  BIO_MAX: 240,
  TITLE_MAX: 100,
  SUMMARY_MAX: 500,
  CODE_MAX: 100000,
  BOARD_ID_MAX: 50,
  BOARD_NAME_MAX: 80,
  TAGS_MAX: 8,
  TAG_LEN_MAX: 32,
  LIBS_MAX: 12,
  LIB_LEN_MAX: 64,
  WIRING_MAX: 24,
  BAUD_MIN: 300,
  BAUD_MAX: 2000000,
  COMMENT_MAX: 600,
} as const;

export interface SanitizedCloudSketchInput {
  title: string;
  summary: string;
  code: string;
  boardId: string;
  boardName: string;
  framework: FrameworkId;
  visibility: CloudSketchVisibility;
  tags: string[];
  libraries: string[];
  wiring: WiringItem[];
  baudRate: number;
}

export function generateSafeDocId(prefix = 'sk'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'doc';
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${cleanPrefix}_${ts}_${rand}`.slice(0, CLOUD_LIMITS.ID_MAX);
}

export function sanitizeDisplayName(name: string | null | undefined, email?: string | null): string {
  const raw = (name ?? '').trim() || (email ? email.split('@')[0] : '') || 'ESP Builder';
  return raw.slice(0, CLOUD_LIMITS.DISPLAY_NAME_MAX);
}

export function sanitizeCloudSketchInput(input: {
  title: string;
  summary: string;
  code: string;
  boardId: string;
  boardName: string;
  framework: FrameworkId;
  visibility: CloudSketchVisibility;
  tags: string[];
  libraries: string[];
  wiring: WiringItem[];
  baudRate: number;
}): { ok: true; payload: SanitizedCloudSketchInput } | { ok: false; error: string } {
  const title = input.title.trim().slice(0, CLOUD_LIMITS.TITLE_MAX);
  if (!title) {
    return { ok: false, error: 'Please enter a sketch title before publishing or saving.' };
  }

  const code = input.code;
  if (!code.trim()) {
    return { ok: false, error: 'Source code cannot be empty.' };
  }
  if (code.length > CLOUD_LIMITS.CODE_MAX) {
    return {
      ok: false,
      error: `Source code exceeds the ${CLOUD_LIMITS.CODE_MAX.toLocaleString()} character limit.`,
    };
  }

  const summary = input.summary.trim().slice(0, CLOUD_LIMITS.SUMMARY_MAX);
  const boardId = (input.boardId.trim() || 'esp32-devkit-v1').slice(0, CLOUD_LIMITS.BOARD_ID_MAX);
  const boardName = (input.boardName.trim() || 'ESP32 DevKit v1').slice(0, CLOUD_LIMITS.BOARD_NAME_MAX);
  const framework: FrameworkId =
    input.framework === 'micropython' || input.framework === 'espidf' ? input.framework : 'arduino';
  const visibility: CloudSketchVisibility = input.visibility === 'private' ? 'private' : 'public';

  const tags = Array.from(
    new Set(
      input.tags
        .map((t) => t.trim().slice(0, CLOUD_LIMITS.TAG_LEN_MAX))
        .filter((t) => t.length > 0)
    )
  ).slice(0, CLOUD_LIMITS.TAGS_MAX);

  const libraries = Array.from(
    new Set(
      input.libraries
        .map((l) => l.trim().slice(0, CLOUD_LIMITS.LIB_LEN_MAX))
        .filter((l) => l.length > 0)
    )
  ).slice(0, CLOUD_LIMITS.LIBS_MAX);

  const wiring = input.wiring
    .filter((w) => w && typeof w.from === 'string' && typeof w.to === 'string')
    .slice(0, CLOUD_LIMITS.WIRING_MAX)
    .map((w) => ({
      from: w.from.trim().slice(0, 64) || 'Component',
      to: w.to.trim().slice(0, 64) || 'GPIO',
      ...(w.note?.trim() ? { note: w.note.trim().slice(0, 120) } : {}),
    }));

  const rawBaud = Number.isFinite(input.baudRate) ? Math.round(input.baudRate) : 115200;
  const baudRate = Math.min(CLOUD_LIMITS.BAUD_MAX, Math.max(CLOUD_LIMITS.BAUD_MIN, rawBaud));

  return {
    ok: true,
    payload: {
      title,
      summary,
      code,
      boardId,
      boardName,
      framework,
      visibility,
      tags,
      libraries,
      wiring,
      baudRate,
    },
  };
}

export function sanitizeCommentBody(
  body: string
): { ok: true; body: string } | { ok: false; error: string } {
  const trimmed = body.trim().slice(0, CLOUD_LIMITS.COMMENT_MAX);
  if (!trimmed) {
    return { ok: false, error: 'Enter a comment before posting.' };
  }
  return { ok: true, body: trimmed };
}

export function detectFrameworkFromFilename(filename: string): FrameworkId {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'micropython';
  if (lower.endsWith('.c')) return 'espidf';
  return 'arduino';
}

export function formatRelativeTime(ms: number, nowMs = Date.now()): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'just now';
  const diffSec = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}
