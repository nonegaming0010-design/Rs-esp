import type { User } from 'firebase/auth';
import { FileUp, Globe, Loader2, Lock, ShieldAlert, UploadCloud, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ESP_BOARDS, getBoardById } from '../data/boards';
import { publishOrUpdateCloudSketch } from '../services/cloudSketches';
import type { CloudSketchVisibility, FrameworkId, WiringItem } from '../types/esp';
import { CLOUD_LIMITS, detectFrameworkFromFilename } from '../utils/cloudValidation';

interface PublishSketchModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onOpenAuth: () => void;
  initialTitle: string;
  initialSummary: string;
  initialCode: string;
  initialBoardId: string;
  initialFramework: FrameworkId;
  initialTags?: string[];
  initialVisibility?: CloudSketchVisibility;
  existingSketchId?: string;
  libraries: string[];
  wiring: WiringItem[];
  baudRate: number;
  allowPublicPublish?: boolean;
  onPublished?: (sketchId: string, visibility: CloudSketchVisibility) => void;
}

export function PublishSketchModal({
  open,
  onClose,
  user,
  onOpenAuth,
  initialTitle,
  initialSummary,
  initialCode,
  initialBoardId,
  initialFramework,
  initialTags = [],
  initialVisibility = 'public',
  existingSketchId,
  libraries,
  wiring,
  baudRate,
  allowPublicPublish = true,
  onPublished,
}: PublishSketchModalProps) {
  const effectiveInitialVisibility: CloudSketchVisibility =
    !allowPublicPublish && !existingSketchId ? 'private' : initialVisibility;

  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [code, setCode] = useState(initialCode);
  const [boardId, setBoardId] = useState(initialBoardId);
  const [framework, setFramework] = useState<FrameworkId>(initialFramework);
  const [tagsText, setTagsText] = useState(initialTags.join(', '));
  const [visibility, setVisibility] = useState<CloudSketchVisibility>(effectiveInitialVisibility);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setSummary(initialSummary);
      setCode(initialCode);
      setBoardId(initialBoardId);
      setFramework(initialFramework);
      setTagsText(initialTags.join(', '));
      setVisibility(!allowPublicPublish && !existingSketchId ? 'private' : initialVisibility);
      setUploadedFilename(null);
      setError(null);
    }
  }, [
    open,
    initialTitle,
    initialSummary,
    initialCode,
    initialBoardId,
    initialFramework,
    initialTags,
    initialVisibility,
    allowPublicPublish,
    existingSketchId,
  ]);

  if (!open) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > CLOUD_LIMITS.CODE_MAX) {
      setError(`File is too large (max ${CLOUD_LIMITS.CODE_MAX.toLocaleString()} characters).`);
      return;
    }
    const text = await file.text();
    setCode(text);
    setUploadedFilename(file.name);
    setFramework(detectFrameworkFromFilename(file.name));
    if (!title.trim() || title === initialTitle) {
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (base) setTitle(base.slice(0, CLOUD_LIMITS.TITLE_MAX));
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in first to upload or publish code.');
      return;
    }
    if (!user.emailVerified) {
      setError('Please verify your email address in your account dialog before publishing.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const board = getBoardById(boardId);
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, CLOUD_LIMITS.TAGS_MAX);

      const sketchId = await publishOrUpdateCloudSketch(user, {
        existingSketchId,
        title,
        summary,
        code,
        boardId: board.id,
        boardName: board.shortName,
        framework,
        visibility,
        tags,
        libraries,
        wiring,
        baudRate,
      });
      onPublished?.(sketchId, visibility);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save sketch to cloud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-lg border border-stone-300 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5 dark:border-stone-800">
          <div>
            <h2 id="publish-modal-title" className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              {existingSketchId ? 'Update Cloud Sketch' : 'Upload & Publish ESP Code'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Share publicly to the Rs-ESP Community feed or keep it private to your account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close publish dialog"
            className="rounded p-1 text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!user && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
              <span>Sign in with Google, Apple, or Email to upload and manage your sketches.</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Sign In
              </button>
            </div>
          )}

          {user && !user.emailVerified && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span>Verify your email address before saving or publishing cloud sketches.</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Verify Email
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Visibility Switcher */}
          <div>
            <span className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Visibility
            </span>
            {!allowPublicPublish && (
              <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                New public community sketches are currently paused by an administrator. You can still save private sketches to your account.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!allowPublicPublish && !existingSketchId}
                onClick={() => setVisibility('public')}
                aria-pressed={visibility === 'public'}
                className={`flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  visibility === 'public'
                    ? 'border-teal-700 bg-teal-50/70 text-teal-950 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300'
                }`}
              >
                <Globe className="h-4 w-4 shrink-0 mt-0.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold">Public (Community)</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Anyone can browse, like, comment, and fork into Studio.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                aria-pressed={visibility === 'private'}
                className={`flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors ${
                  visibility === 'private'
                    ? 'border-teal-700 bg-teal-50/70 text-teal-950 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300'
                }`}
              >
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-stone-600 dark:text-stone-300" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold">Private (Only Me)</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Saved safely to your account. Hidden from the feed.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Optional File Upload */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 py-2 text-xs dark:border-stone-700 dark:bg-stone-950">
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
              <FileUp className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <span>
                {uploadedFilename
                  ? `Loaded file: ${uploadedFilename} (${code.length} chars)`
                  : 'Publishing current Studio code — or upload a .ino / .py / .c file'}
              </span>
            </div>
            <label className="cursor-pointer rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
              <span>Choose File</span>
              <input
                type="file"
                accept=".ino,.py,.c,.cpp,.h,.txt"
                onChange={handleFilePick}
                className="sr-only"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pub-title" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Project Title
              </label>
              <input
                id="pub-title"
                type="text"
                required
                maxLength={CLOUD_LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. ESP32 Wi-Fi DHT22 Logger"
                className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>

            <div>
              <label htmlFor="pub-board" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Target ESP Board
              </label>
              <select
                id="pub-board"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              >
                {ESP_BOARDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pub-framework" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Language / Framework
              </label>
              <select
                id="pub-framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value as FrameworkId)}
                className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              >
                <option value="arduino">Arduino C++</option>
                <option value="micropython">MicroPython</option>
                <option value="espidf">ESP-IDF</option>
              </select>
            </div>

            <div>
              <label htmlFor="pub-tags" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Tags (comma-separated, max 8)
              </label>
              <input
                id="pub-tags"
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="Wi-Fi, DHT22, OLED"
                className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pub-summary" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Description / Notes
            </label>
            <textarea
              id="pub-summary"
              rows={2}
              maxLength={CLOUD_LIMITS.SUMMARY_MAX}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Explain what this sketch does and any wiring notes..."
              className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="pub-code" className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Source Code ({code.split('\n').length} lines)
              </label>
            </div>
            <textarea
              id="pub-code"
              rows={5}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full rounded-md border border-stone-300 bg-stone-950 px-3 py-2 font-mono text-[11px] text-stone-100 focus:border-teal-700 focus:outline-none dark:border-stone-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !user || !user.emailVerified}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {submitting
                  ? 'Saving...'
                  : visibility === 'public'
                    ? existingSketchId
                      ? 'Save & Publish'
                      : 'Publish Publicly'
                    : existingSketchId
                      ? 'Save Privately'
                      : 'Save as Private'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
