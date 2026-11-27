import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  extractBearerToken,
  verifyFirebaseIdToken,
  type VerifiedFirebaseUser,
} from './src/utils/authTokenVerifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

function loadFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
      return parsed.projectId.trim();
    }
  } catch {
    // Fallback to environment variable if config file is unavailable
  }
  return (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();

type AuthenticatedRequest = express.Request & { authUser?: VerifiedFirebaseUser };

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({
      error: 'Please sign in or create an account to generate ESP code.',
      code: 'AUTH_REQUIRED',
    });
  }
  try {
    req.authUser = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
    return next();
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : 'Please sign in or create an account to generate ESP code.';
    return res.status(401).json({
      error: message,
      code: 'AUTH_REQUIRED',
    });
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 12000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CODE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Short, descriptive project title.',
    },
    code: {
      type: Type.STRING,
      description: 'Complete, ready-to-compile firmware source code properly formatted across multiple lines with \\n newlines, indentation, and clean comments.',
    },
    explanation: {
      type: Type.STRING,
      description: 'Beginner-friendly 2-4 sentence summary of how the code works and what to expect in Serial Monitor.',
    },
    wiring: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING, description: 'External component pin or module name' },
          to: { type: Type.STRING, description: 'ESP board pin (e.g. GPIO 21 / 3.3V / GND)' },
          note: { type: Type.STRING, description: 'Optional resistor, level shift, or boot warning' },
        },
        required: ['from', 'to'],
      },
      description: 'Pin-to-pin wiring table for the user.',
    },
    libraries: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of Arduino Library Manager or MicroPython packages required.',
    },
    baudRate: {
      type: Type.INTEGER,
      description: 'Serial Monitor baud rate used in the code (typically 115200).',
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Important 3.3V logic, strapping pin, or power supply tips.',
    },
  },
  required: ['title', 'code', 'explanation', 'wiring', 'libraries', 'baudRate', 'warnings'],
};

const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

function serializeErrorText(err: unknown): string {
  if (err instanceof Error) {
    const extra = err as Error & { status?: unknown; code?: unknown; cause?: unknown };
    const parts = [err.message];
    if (extra.status !== undefined) parts.push(String(extra.status));
    if (extra.code !== undefined) parts.push(String(extra.code));
    if (extra.cause) parts.push(serializeErrorText(extra.cause));
    return parts.filter(Boolean).join(' ');
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const raw = serializeErrorText(err) || fallback;
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: { message?: string; status?: string; code?: number };
        message?: string;
      };
      const nestedMsg = parsed?.error?.message || parsed?.message;
      if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
        return nestedMsg.trim();
      }
    } catch {
      // fall through to raw message
    }
  }
  return trimmed || fallback;
}

function isUnavailableOrTransientError(err: unknown): { transient: boolean; unavailable: boolean } {
  const raw = serializeErrorText(err);
  const obj = err as { status?: number; code?: number; name?: string; error?: { code?: number; status?: string } };
  const status = obj?.status ?? obj?.code ?? obj?.error?.code;
  const timedOut =
    obj?.name === 'AbortError' ||
    /ABORT_ERR|AbortError|DEADLINE_EXCEEDED|timed out|timeout/i.test(raw);
  const unavailable =
    status === 503 ||
    status === 504 ||
    timedOut ||
    /503|504|UNAVAILABLE|high demand|overloaded|capacity/i.test(raw);
  const rateLimited = status === 429 || /RESOURCE_EXHAUSTED|429/i.test(raw);
  const transient =
    unavailable ||
    rateLimited ||
    status === 502 ||
    status === 500 ||
    /502|500|ETIMEDOUT|ECONNRESET|ECONNABORTED|EAI_AGAIN|fetch failed|temporar/i.test(raw);
  return { transient, unavailable };
}

async function generateWithTimeout(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  timeoutMs: number
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const timeoutErr = new Error(`AI model request timed out after ${Math.round(timeoutMs / 1000)}s`);
      timeoutErr.name = 'AbortError';
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      ai.models.generateContent({
        ...params,
        config: {
          ...params.config,
          abortSignal: controller.signal,
        },
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'> & { model?: string }
) {
  const primaryModel = params.model || PRIMARY_GEMINI_MODEL;
  const sequence =
    primaryModel === FALLBACK_GEMINI_MODEL
      ? [FALLBACK_GEMINI_MODEL]
      : [primaryModel, FALLBACK_GEMINI_MODEL];

  let lastErr: unknown;
  for (let i = 0; i < sequence.length; i++) {
    const modelToUse = sequence[i];
    const attemptTimeoutMs = modelToUse === PRIMARY_GEMINI_MODEL ? 11000 : 12000;
    try {
      const configWithThinking =
        modelToUse === PRIMARY_GEMINI_MODEL
          ? {
              ...params.config,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            }
          : params.config;
      return await generateWithTimeout(
        ai,
        {
          ...params,
          model: modelToUse,
          config: configWithThinking,
        },
        attemptTimeoutMs
      );
    } catch (err) {
      lastErr = err;
      const { transient } = isUnavailableOrTransientError(err);
      if (!transient || i === sequence.length - 1) throw err;
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  throw lastErr;
}

function formatGeminiError(err: unknown, fallback: string): { status: number; message: string } {
  const raw = serializeErrorText(err);
  const clean = extractErrorMessage(err, fallback);

  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(raw)) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or missing permissions. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(raw)) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please retry in a moment or check your quota in Settings > Secrets.',
    };
  }
  if (/503|504|UNAVAILABLE|DEADLINE_EXCEEDED|high demand|overloaded|timed out|timeout|AbortError|ABORT_ERR/i.test(raw)) {
    return {
      status: 503,
      message: 'AI models are temporarily experiencing high demand or timed out. Please retry in a few seconds.',
    };
  }
  if (/NOT_FOUND|404/i.test(raw)) {
    return {
      status: 404,
      message: `Requested Gemini model was not found: ${clean}`,
    };
  }
  if (/GEMINI_API_KEY is not configured/i.test(raw)) {
    return { status: 400, message: clean };
  }
  return { status: 500, message: clean || fallback };
}

function parseAndNormalizeAiResult(
  rawText: string,
  defaults: { fallbackCode?: string; fallbackTitle?: string } = {}
) {
  let cleaned = rawText.trim();
  if (!cleaned) {
    throw new Error('Empty response from AI model. Please retry.');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const wiringRaw = Array.isArray(parsed.wiring) ? parsed.wiring : [];
  const wiring = wiringRaw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      from: typeof item.from === 'string' && item.from.trim() ? item.from.trim() : 'Component',
      to: typeof item.to === 'string' && item.to.trim() ? item.to.trim() : 'GPIO',
      note: typeof item.note === 'string' ? item.note.trim() : undefined,
    }));

  const libraries = Array.isArray(parsed.libraries)
    ? parsed.libraries.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];

  const baudRate =
    typeof parsed.baudRate === 'number' && Number.isFinite(parsed.baudRate) && parsed.baudRate > 0
      ? Math.round(parsed.baudRate)
      : 115200;

  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : defaults.fallbackTitle || 'ESP Firmware Sketch',
    code:
      typeof parsed.code === 'string' && parsed.code.trim()
        ? parsed.code
        : defaults.fallbackCode || '',
    explanation:
      typeof parsed.explanation === 'string' && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : 'Firmware ready. Review the wiring table and upload to your board.',
    wiring,
    libraries,
    baudRate,
    warnings,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Rs-ESP' });
  });

  app.post('/api/ai/generate', requireFirebaseAuth, async (req, res) => {
    try {
      const { prompt, boardName, boardChip, boardFamily, framework, peripherals, defaultLedPin, defaultI2c } =
        req.body ?? {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Please describe the ESP project you want to build.' });
      }

      const ai = getGeminiClient();

      const peripheralText =
        Array.isArray(peripherals) && peripherals.length > 0
          ? `Requested peripherals/features: ${peripherals.join(', ')}.`
          : '';

      const systemInstruction = `You are an expert embedded systems engineer for Rs-ESP.
Generate clean, compilable, safe firmware for ${boardName || 'ESP32'} (${boardChip || 'ESP32'}, family: ${boardFamily || 'esp32'}) using ${framework === 'micropython' ? 'MicroPython' : framework === 'espidf' ? 'ESP-IDF C' : 'Arduino C++'}.
Rules:
1. Never use internal SPI flash pins (GPIO 6-11 on classic ESP32).
2. Avoid strapping pins (GPIO 0, 12, 15 on ESP32; GPIO 15 on ESP8266) for critical outputs unless unavoidable, and note any caveat in warnings.
3. Prefer ADC1 pins for analogRead when Wi-Fi is active on ESP32.
4. Use safe 3.3V logic pins. Default onboard LED is GPIO ${defaultLedPin ?? 2}; default I2C SDA=${defaultI2c?.sda ?? 21}, SCL=${defaultI2c?.scl ?? 22}.
5. Include Serial.begin(115200) (or print statements in MicroPython) with clear debugging logs and key:value telemetry where appropriate so the Rs-ESP Serial Monitor & Plotter work immediately.
6. Format "code" with clean multi-line indentation and explicit newline characters (\\n) between every statement and preprocessor directive; never collapse code onto a single line.
7. Return strictly valid JSON matching the schema.`;

      const userPrompt = `Build an ESP firmware project for: "${prompt.trim()}".
Target board: ${boardName || 'ESP32 DevKit v1'}
Framework: ${framework || 'arduino'}
${peripheralText}`;

      const response = await generateWithRetry(ai, {
        model: PRIMARY_GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: CODE_RESPONSE_SCHEMA,
        },
      });

      const normalized = parseAndNormalizeAiResult(response.text ?? '', {
        fallbackTitle: prompt.trim().slice(0, 60),
      });
      return res.json(normalized);
    } catch (err) {
      console.error('AI generate error:', err);
      const { status, message } = formatGeminiError(err, 'Failed to generate ESP code.');
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/assist', requireFirebaseAuth, async (req, res) => {
    try {
      const {
        action,
        code,
        errorText,
        boardName,
        boardChip,
        boardFamily,
        framework,
        targetFramework,
        defaultLedPin,
        defaultI2c,
      } = req.body ?? {};
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'Source code is required in the editor before running this action.' });
      }

      const ai = getGeminiClient();
      const fwLabel =
        (targetFramework || framework) === 'micropython'
          ? 'MicroPython'
          : (targetFramework || framework) === 'espidf'
            ? 'ESP-IDF C'
            : 'Arduino C++';

      let taskPrompt = '';
      if (action === 'fix_error') {
        taskPrompt = `Fix any compiler, syntax, library, or pin-conflict issues in this ${boardName || 'ESP32'} (${fwLabel}) code.
Default onboard LED is GPIO ${defaultLedPin ?? 2}; default I2C SDA=${defaultI2c?.sda ?? 21}, SCL=${defaultI2c?.scl ?? 22}.
Error / issue reported by user: ${errorText?.trim() || 'No error pasted — audit the sketch for compile errors, missing #includes, wrong ESP32 vs ESP8266 APIs, unsafe GPIO pins, and Wi-Fi/ADC conflicts, and fix them cleanly.'}
In "explanation", clearly state what was wrong and what you fixed.

Code:
${code}`;
      } else if (action === 'convert') {
        taskPrompt = `Convert and adapt this firmware cleanly for target board "${boardName || 'ESP32'}" (${boardChip || 'ESP32'}, family: ${boardFamily || 'esp32'}) using ${fwLabel}.
Default onboard LED is GPIO ${defaultLedPin ?? 2}; default I2C SDA=${defaultI2c?.sda ?? 21}, SCL=${defaultI2c?.scl ?? 22}.
Adapt GPIO numbers, Wi-Fi headers (WiFi.h vs ESP8266WiFi.h vs MicroPython network/machine), and PWM/ADC calls accurately.

Source code:
${code}`;
      } else if (action === 'explain') {
        taskPrompt = `Explain clearly in plain, beginner-friendly language how this ${boardName || 'ESP32'} (${fwLabel}) sketch works step by step, what each major function/line does, and what hardware connections or Serial Monitor output to expect.
Keep "code" identical to the user's source code unless adding brief clarifying comments.

Code:
${code}`;
      } else {
        taskPrompt = `Enhance this ${boardName || 'ESP32'} (${fwLabel}) code with non-blocking timing, Serial Monitor debug logs, and clean error handling.

Code:
${code}`;
      }

      const response = await generateWithRetry(ai, {
        model: PRIMARY_GEMINI_MODEL,
        contents: taskPrompt,
        config: {
          systemInstruction:
            'You are an embedded ESP32/ESP8266 mentor inside Rs-ESP. Return strictly valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: CODE_RESPONSE_SCHEMA,
        },
      });

      const normalized = parseAndNormalizeAiResult(response.text ?? '', {
        fallbackCode: code,
        fallbackTitle: `${boardName || 'ESP'} Sketch`,
      });
      return res.json(normalized);
    } catch (err) {
      console.error('AI assist error:', err);
      const { status, message } = formatGeminiError(err, 'AI assist request failed.');
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rs-ESP server running at http://localhost:${PORT}`);
  });
  server.requestTimeout = 45000;
}

startServer();
