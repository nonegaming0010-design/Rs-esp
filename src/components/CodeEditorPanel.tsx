import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiGeneratedResult, EspBoard, FrameworkId, WiringItem } from '../types/esp';
import { buildPlatformIoIni, detectRequiredLibraries, getSketchFilename, validateGpioUsage } from '../utils/espHelpers';

interface CodeEditorPanelProps {
  title: string;
  code: string;
  onChangeCode: (nextCode: string) => void;
  board: EspBoard;
  framework: FrameworkId;
  wiring: WiringItem[];
  libraries: string[];
  user: User | null;
  isPhoneView?: boolean;
  onRequireAuth: (reason?: string) => void;
  onAiAssistResult: (result: AiGeneratedResult) => void;
  onExplainResult: (result: AiGeneratedResult) => void;
  canUndo: boolean;
  onUndoCode: () => void;
}

type EditorTab = 'source' | 'platformio' | 'wiring';
type AssistAction = 'explain' | 'fix_error' | 'convert';

export function CodeEditorPanel({
  title,
  code,
  onChangeCode,
  board,
  framework,
  wiring,
  libraries,
  user,
  isPhoneView = false,
  onRequireAuth,
  onAiAssistResult,
  onExplainResult,
  canUndo,
  onUndoCode,
}: CodeEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('source');
  const [assistLoading, setAssistLoading] = useState<AssistAction | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<{
    action: AssistAction;
    errorText?: string;
  } | null>(null);
  const [inlineExplanation, setInlineExplanation] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showFixBox, setShowFixBox] = useState(false);
  const [compilerErrorText, setCompilerErrorText] = useState('');
  const fixInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showFixBox) {
      fixInputRef.current?.focus();
    }
  }, [showFixBox]);

  const filename = getSketchFilename(framework, title);
  const detectedLibs = useMemo(() => {
    const merged = new Set([...libraries, ...detectRequiredLibraries(code)]);
    return Array.from(merged);
  }, [libraries, code]);

  const platformioContent = useMemo(
    () => buildPlatformIoIni(board.id, detectedLibs),
    [board.id, detectedLibs]
  );

  const wiringMarkdown = useMemo(() => {
    const rows = wiring.map((w) => `| ${w.from} | ${w.to} | ${w.note || '-'} |`).join('\n');
    return `# ${title}\n\nTarget Board: ${board.name} (${board.chip})\nLogic Level: 3.3V\n\n| Component Pin | ESP Pin | Notes |\n| --- | --- | --- |\n${rows || '| Onboard LED | GPIO ' + board.defaultLedPin + ' | Built-in |'}\n`;
  }, [title, board, wiring]);

  const gpioWarnings = useMemo(() => validateGpioUsage(board.id, code), [board.id, code]);
  const lineCount = useMemo(() => Math.max(1, code.split('\n').length), [code]);

  const runAssist = async (action: AssistAction, customError?: string) => {
    if (!user) {
      setAssistError('Please sign in or create an account to use AI Explain, Fix Error, or Convert.');
      onRequireAuth('Sign in or create an account to generate, explain, fix, or convert ESP code.');
      return;
    }

    if (!code.trim()) {
      setAssistError('Write or load a sketch in the editor first.');
      return;
    }

    setAssistLoading(action);
    setAssistError(null);
    setLastFailedAction(null);
    setStatusNotice(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          action,
          code,
          errorText: customError,
          boardName: board.name,
          boardChip: board.chip,
          boardFamily: board.family,
          framework,
          targetFramework: framework,
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
        const msg = data.error || 'Please sign in or create an account to use AI code tools.';
        onRequireAuth(msg);
        throw new Error(msg);
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (HTTP ${res.status}). Please retry.`);
      }

      const normalized: AiGeneratedResult = {
        title: typeof data.title === 'string' && data.title.trim() ? data.title : title,
        code: typeof data.code === 'string' && data.code.trim() ? data.code : code,
        explanation:
          typeof data.explanation === 'string' && data.explanation.trim()
            ? data.explanation
            : 'Completed.',
        wiring: Array.isArray(data.wiring) ? data.wiring : wiring,
        libraries: Array.isArray(data.libraries) ? data.libraries : libraries,
        baudRate: typeof data.baudRate === 'number' ? data.baudRate : 115200,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };

      if (action === 'explain') {
        onExplainResult(normalized);
        setInlineExplanation(normalized.explanation);
      } else {
        onAiAssistResult(normalized);
        setActiveTab('source');
        setShowFixBox(false);
        setInlineExplanation(null);
        setStatusNotice(
          action === 'fix_error'
            ? `Code fixed for ${board.shortName}: ${normalized.explanation}`
            : `Code converted for ${board.shortName} (${framework === 'micropython' ? 'MicroPython' : framework === 'espidf' ? 'ESP-IDF' : 'Arduino C++'}).`
        );
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || /failed to fetch|networkerror/i.test(err.message))) {
        setAssistError('Connection timed out while contacting the AI server. Please click Retry.');
      } else {
        setAssistError(err instanceof Error ? err.message : 'Unable to reach AI assistant.');
      }
      setLastFailedAction({ action, errorText: customError });
    } finally {
      window.clearTimeout(timeoutId);
      setAssistLoading(null);
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-stone-300 bg-white overflow-hidden dark:border-stone-800 dark:bg-stone-900">
      {/* Editor Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-300 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950/60">
        <div role="tablist" aria-label="Project files" className="flex max-w-full items-center gap-1 overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'source'}
            onClick={() => setActiveTab('source')}
            className={`rounded-sm px-2.5 py-1 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'source'
                ? 'bg-stone-900 text-white dark:bg-teal-700'
                : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            {filename}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'platformio'}
            onClick={() => setActiveTab('platformio')}
            className={`rounded-sm px-2.5 py-1 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'platformio'
                ? 'bg-stone-900 text-white dark:bg-teal-700'
                : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            platformio.ini
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'wiring'}
            onClick={() => setActiveTab('wiring')}
            className={`rounded-sm px-2.5 py-1 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'wiring'
                ? 'bg-stone-900 text-white dark:bg-teal-700'
                : 'text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            wiring.md
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canUndo && (
            <button
              type="button"
              onClick={() => {
                onUndoCode();
                setStatusNotice('Reverted to previous code.');
              }}
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Undo</span>
            </button>
          )}
          <button
            type="button"
            disabled={!!assistLoading}
            onClick={() => runAssist('explain')}
            className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {assistLoading === 'explain' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{assistLoading === 'explain' ? 'Explaining...' : 'Explain Code'}</span>
          </button>
          <button
            type="button"
            disabled={!!assistLoading}
            onClick={() => setShowFixBox((prev) => !prev)}
            aria-expanded={showFixBox}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 whitespace-nowrap shrink-0 ${
              showFixBox
                ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-200'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            <Wrench className="h-3 w-3" aria-hidden="true" />
            <span>Fix Error</span>
          </button>
          <button
            type="button"
            disabled={!!assistLoading}
            onClick={() => runAssist('convert')}
            className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {assistLoading === 'convert' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{assistLoading === 'convert' ? 'Converting...' : `Convert for ${board.shortName}`}</span>
          </button>
        </div>
      </div>

      {/* Inline Compiler Error Fix Drawer */}
      {showFixBox && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAssist('fix_error', compilerErrorText);
          }}
          className="border-b border-stone-200 bg-stone-50 px-3 py-2.5 space-y-1.5 dark:border-stone-800 dark:bg-stone-950/70"
        >
          <label htmlFor="compiler-error-input" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
            Paste compiler or serial error (or leave blank to check and fix all issues)
          </label>
          <div className={`flex gap-2 ${isPhoneView ? 'flex-col' : 'flex-col sm:flex-row'}`}>
            <input
              ref={fixInputRef}
              id="compiler-error-input"
              type="text"
              value={compilerErrorText}
              onChange={(e) => setCompilerErrorText(e.target.value)}
              placeholder="e.g. 'WiFi.h: No such file or directory' or leave blank for auto-check"
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="submit"
                disabled={assistLoading === 'fix_error'}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {assistLoading === 'fix_error' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                <span>{assistLoading === 'fix_error' ? 'Fixing Code...' : 'Fix Code'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFixBox(false)}
                className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Assist Error Banner with 1-Click Retry */}
      {assistError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{assistError}</span>
          {!user ? (
            <button
              type="button"
              onClick={() => onRequireAuth('Sign in or create an account to use AI code tools.')}
              className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            >
              Sign In Now
            </button>
          ) : (
            lastFailedAction && (
              <button
                type="button"
                disabled={!!assistLoading}
                onClick={() => runAssist(lastFailedAction.action, lastFailedAction.errorText)}
                className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
              >
                Retry
              </button>
            )
          )}
        </div>
      )}

      {/* Success / Fix Applied Notice */}
      {statusNotice && (
        <div className="flex items-start justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            aria-label="Dismiss notice"
            className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Inline Code Explanation Box */}
      {inlineExplanation && (
        <div className="border-b border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-800 dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-200">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 font-semibold text-teal-800 dark:text-teal-400">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Code Explanation</span>
            </span>
            <button
              type="button"
              onClick={() => setInlineExplanation(null)}
              aria-label="Close explanation"
              className="rounded p-0.5 text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="leading-relaxed whitespace-pre-line">{inlineExplanation}</p>
        </div>
      )}

      {/* GPIO Hardware Safety Linter */}
      <div className="border-b border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
        {gpioWarnings.length === 0 ? (
          <div className="flex items-center justify-between gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Pin Check Passed: All GPIO pins look safe for {board.shortName}.</span>
            </span>
            <span className="hidden sm:inline font-mono text-stone-400 tabular-nums">
              {lineCount} lines
            </span>
          </div>
        ) : (
          <ul className="space-y-1">
            {gpioWarnings.map((w) => (
              <li
                key={w.gpio}
                className={`flex items-start gap-2 text-xs ${
                  w.severity === 'error'
                    ? 'text-red-700 dark:text-red-400 font-medium'
                    : w.severity === 'warning'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                {w.severity === 'info' ? (
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  <strong className="uppercase">{w.severity}:</strong> {w.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Code Surface */}
      {activeTab === 'source' ? (
        <div
          className={`relative flex bg-stone-950 text-stone-100 overflow-auto workbench-scroll ${
            isPhoneView ? 'min-h-[300px] max-h-[400px]' : 'min-h-[450px] max-h-[560px]'
          }`}
        >
          <div
            aria-hidden="true"
            className="select-none border-r border-stone-800 bg-stone-900/90 px-3 py-3 text-right font-mono text-xs leading-6 text-stone-500 tabular-nums"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <label htmlFor="main-code-editor" className="sr-only">
            Firmware source code editor
          </label>
          <textarea
            id="main-code-editor"
            value={code}
            onChange={(e) => onChangeCode(e.target.value)}
            spellCheck={false}
            rows={Math.max(isPhoneView ? 12 : 19, lineCount)}
            className="w-full resize-none bg-transparent p-3 font-mono text-xs leading-6 text-stone-100 focus:outline-none"
          />
        </div>
      ) : (
        <pre
          className={`overflow-auto bg-stone-950 p-4 font-mono text-xs leading-6 text-stone-200 workbench-scroll ${
            isPhoneView ? 'min-h-[300px] max-h-[400px]' : 'min-h-[450px] max-h-[560px]'
          }`}
        >
          {activeTab === 'platformio' ? platformioContent : wiringMarkdown}
        </pre>
      )}
    </div>
  );
}
