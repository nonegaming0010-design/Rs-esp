import type { User } from 'firebase/auth';
import { Loader2, Lock, LogIn, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { AiGeneratedResult, EspBoard, FrameworkId } from '../types/esp';

interface AiCodeMakerProps {
  board: EspBoard;
  framework: FrameworkId;
  user: User | null;
  isPhoneView?: boolean;
  onRequireAuth: (reason?: string) => void;
  onCodeGenerated: (result: AiGeneratedResult) => void;
}

const QUICK_IDEAS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Wi-Fi Relay + DHT22',
    prompt: 'Wi-Fi web dashboard to toggle 2 relays and read DHT22 temperature',
  },
  {
    label: 'OLED NTP Clock',
    prompt: 'SSD1306 OLED live clock with NTP sync and button screen toggle',
  },
  {
    label: 'Parking Distance Alert',
    prompt: 'Ultrasonic HC-SR04 parking distance indicator with NeoPixel and buzzer',
  },
  {
    label: 'Deep Sleep MQTT Soil',
    prompt: 'Deep sleep battery soil moisture sensor that sends MQTT alert when dry',
  },
];

const PERIPHERAL_OPTIONS = ['Wi-Fi', 'OLED SSD1306', 'DHT22', 'MQTT', 'Servo SG90', 'Deep Sleep'];

export function AiCodeMaker({
  board,
  framework,
  user,
  isPhoneView = false,
  onRequireAuth,
  onCodeGenerated,
}: AiCodeMakerProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedPeripherals, setSelectedPeripherals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePeripheral = (item: string) => {
    setSelectedPeripherals((prev) =>
      prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]
    );
  };

  const triggerGenerate = async () => {
    if (!user) {
      setError('Sign in or create an account to generate ESP code.');
      onRequireAuth('Sign in or create a free account before generating ESP code.');
      return;
    }

    if (!prompt.trim()) {
      setError('Enter what you want your ESP board to build before generating.');
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: prompt.trim(),
          boardName: board.name,
          boardChip: board.chip,
          boardFamily: board.family,
          framework,
          peripherals: selectedPeripherals,
          defaultLedPin: board.defaultLedPin,
          defaultI2c: board.defaultI2c,
        }),
      });
      const text = await res.text();
      let data: { error?: string; code?: string } & Partial<AiGeneratedResult> = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
      if (res.status === 401 || data.code === 'AUTH_REQUIRED') {
        const msg = data.error || 'Please sign in or create an account to generate ESP code.';
        onRequireAuth(msg);
        throw new Error(msg);
      }
      if (!res.ok) {
        throw new Error(data.error || `AI generation failed (HTTP ${res.status}). Please retry.`);
      }
      onCodeGenerated(data as AiGeneratedResult);
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || /failed to fetch|networkerror/i.test(err.message))) {
        setError('Connection timed out while contacting the AI server. Please click Retry.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to reach AI generator.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await triggerGenerate();
  };

  return (
    <section
      aria-label="AI ESP Code Maker"
      className={`rounded-lg border border-stone-300 bg-white dark:border-stone-800 dark:bg-stone-900 ${
        isPhoneView ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              AI Code Generator
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Describe what you want your ESP board to do, pick modules, or click a quick idea below.
            </p>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
            {board.shortName} · {framework === 'micropython' ? 'MicroPython' : framework === 'espidf' ? 'ESP-IDF' : 'Arduino C++'}
          </span>
        </div>

        {!user && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span>Login or Sign Up is required before generating ESP code.</span>
            </span>
            <button
              type="button"
              onClick={() => onRequireAuth('Sign in or create a free account to generate ESP code.')}
              className="inline-flex items-center gap-1 rounded bg-amber-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-800 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-3 w-3" aria-hidden="true" />
              <span>Sign In / Sign Up</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`flex gap-2 ${isPhoneView ? 'flex-col' : 'flex-col sm:flex-row'}`}>
          <div className="flex-1">
            <label htmlFor="ai-prompt-input" className="sr-only">
              Describe your ESP project
            </label>
            <input
              id="ai-prompt-input"
              type="text"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Describe what to build (e.g., DHT22 sensor with OLED display and Wi-Fi web switch)"
              className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:bg-stone-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500 ${
              isPhoneView ? 'w-full' : ''
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                {!user ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
                <span>{user ? 'Generate Code' : 'Sign In & Generate Code'}</span>
              </>
            )}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-stone-500 dark:text-stone-400 mr-1">Modules:</span>
            {PERIPHERAL_OPTIONS.map((item) => {
              const active = selectedPeripherals.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => togglePeripheral(item)}
                  aria-pressed={active}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-300'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-stone-500 dark:text-stone-400">Ideas:</span>
            {QUICK_IDEAS.map((idea) => (
              <button
                key={idea.label}
                type="button"
                onClick={() => {
                  setPrompt(idea.prompt);
                  setError(null);
                }}
                className="text-teal-800 hover:underline dark:text-teal-400 whitespace-nowrap"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <span>{error}</span>
            {user ? (
              <button
                type="button"
                disabled={loading}
                onClick={triggerGenerate}
                className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/50"
              >
                Retry
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRequireAuth('Sign in or create a free account to generate ESP code.')}
                className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/50"
              >
                Sign In Now
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
