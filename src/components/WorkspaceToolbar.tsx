import {
  Archive,
  Bookmark,
  Copy,
  FileText,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  UploadCloud,
} from 'lucide-react';
import { ESP_BOARDS } from '../data/boards';
import type { EspBoard, FrameworkId } from '../types/esp';
import type { AppViewMode } from '../utils/storage';

interface WorkspaceToolbarProps {
  selectedBoard: EspBoard;
  onSelectBoard: (boardId: string) => void;
  framework: FrameworkId;
  onSelectFramework: (fw: FrameworkId) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  viewMode: AppViewMode;
  onToggleViewMode: () => void;
  onCopyCode: () => void;
  onExportZip: () => void;
  onExportPdf: () => void;
  onOpenSaved: () => void;
  onOpenPublish: () => void;
  savedCount: number;
  lastSavedLabel: string | null;
  copied: boolean;
}

const FRAMEWORKS: Array<{ id: FrameworkId; label: string }> = [
  { id: 'arduino', label: 'Arduino C++' },
  { id: 'micropython', label: 'MicroPython' },
  { id: 'espidf', label: 'ESP-IDF' },
];

export function WorkspaceToolbar({
  selectedBoard,
  onSelectBoard,
  framework,
  onSelectFramework,
  isDark,
  onToggleTheme,
  viewMode,
  onToggleViewMode,
  onCopyCode,
  onExportZip,
  onExportPdf,
  onOpenSaved,
  onOpenPublish,
  savedCount,
  lastSavedLabel,
  copied,
}: WorkspaceToolbarProps) {
  const isPhoneView = viewMode === 'phone';

  return (
    <div className="border-b border-stone-300 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/70">
      <div
        className={`mx-auto flex max-w-[1440px] flex-wrap items-center justify-between ${
          isPhoneView ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-2 sm:px-6'
        }`}
      >
        <div className={`flex flex-wrap items-center ${isPhoneView ? 'w-full gap-2' : 'gap-3'}`}>
          <div className={`flex items-center gap-2 ${isPhoneView ? 'w-full' : ''}`}>
            <label
              htmlFor="board-select"
              className="text-xs font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap"
            >
              Board
            </label>
            <select
              id="board-select"
              value={selectedBoard.id}
              onChange={(e) => onSelectBoard(e.target.value)}
              className={`rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 ${
                isPhoneView ? 'flex-1 min-w-0' : ''
              }`}
            >
              <optgroup label="ESP32 Series (Xtensa & RISC-V)">
                {ESP_BOARDS.filter((b) => b.family === 'esp32').map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="ESP8266 Series">
                {ESP_BOARDS.filter((b) => b.family === 'esp8266').map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className={`flex items-center gap-2 ${isPhoneView ? 'w-full' : ''}`}>
            <span
              className={`${
                isPhoneView ? 'hidden' : 'hidden sm:inline'
              } text-xs font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap`}
            >
              Language
            </span>
            <div
              role="group"
              aria-label="Target firmware language"
              className={`flex items-center gap-0.5 rounded-md border border-stone-300 bg-stone-200/70 p-0.5 dark:border-stone-700 dark:bg-stone-800 ${
                isPhoneView ? 'w-full' : ''
              }`}
            >
              {FRAMEWORKS.map((fw) => {
                const active = framework === fw.id;
                return (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => onSelectFramework(fw.id)}
                    className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      isPhoneView ? 'flex-1 text-center' : 'shrink-0'
                    } ${
                      active
                        ? 'bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-100'
                        : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                    }`}
                  >
                    {fw.label}
                  </button>
                );
              })}
            </div>
          </div>

          {!isPhoneView && (
            <span className="hidden 2xl:inline text-xs text-stone-500 dark:text-stone-400 font-mono">
              {selectedBoard.chip} · {selectedBoard.clockMhz}MHz · {selectedBoard.flashMb} · LED GPIO{selectedBoard.defaultLedPin}
            </span>
          )}
        </div>

        <div className={`flex flex-wrap items-center gap-1.5 ${isPhoneView ? 'w-full' : 'sm:gap-2'}`}>
          {!isPhoneView && lastSavedLabel && (
            <span className="hidden 2xl:inline text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
              {lastSavedLabel}
            </span>
          )}

          <button
            type="button"
            onClick={onOpenPublish}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-700 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 dark:border-teal-600 dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-900/60"
          >
            <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Publish</span>
          </button>

          <button
            type="button"
            onClick={onOpenSaved}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Saved ({savedCount})</span>
          </button>

          <button
            type="button"
            onClick={onCopyCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copied ? 'Copied!' : isPhoneView ? 'Copy' : 'Copy Code'}</span>
          </button>

          <button
            type="button"
            onClick={onExportZip}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isPhoneView ? 'ZIP' : 'Export ZIP'}</span>
          </button>

          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <FileText className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <span>{isPhoneView ? 'PDF' : 'Datasheet PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleViewMode}
            aria-pressed={isPhoneView}
            title={isPhoneView ? 'Switch back to Windows / Desktop web view' : 'Switch Windows web to Phone web view'}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isPhoneView
                ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800 dark:border-teal-500 dark:bg-teal-600'
                : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {isPhoneView ? (
              <>
                <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Desktop View</span>
              </>
            ) : (
              <>
                <Smartphone className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span>Phone View</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white p-1.5 text-stone-700 hover:bg-stone-100 transition-colors dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
