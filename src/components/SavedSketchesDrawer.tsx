import { BookmarkPlus, Check, FolderOpen, Pencil, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getBoardById } from '../data/boards';
import type { SavedSketch } from '../types/esp';

interface SavedSketchesDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTitle: string;
  savedSketches: SavedSketch[];
  onSaveCurrent: (customTitle: string) => void;
  onLoadSaved: (sketch: SavedSketch) => void;
  onRenameSaved: (id: string, nextTitle: string) => void;
  onDeleteSaved: (id: string) => void;
}

function formatSavedTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Saved locally';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SavedSketchesDrawer({
  open,
  onClose,
  activeTitle,
  savedSketches,
  onSaveCurrent,
  onLoadSaved,
  onRenameSaved,
  onDeleteSaved,
}: SavedSketchesDrawerProps) {
  const [newTitle, setNewTitle] = useState(activeTitle);
  const [filterQuery, setFilterQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    if (open) {
      setNewTitle(activeTitle);
    }
  }, [open, activeTitle]);

  const filteredSketches = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return savedSketches;
    return savedSketches.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.boardId.toLowerCase().includes(q) ||
        s.framework.toLowerCase().includes(q)
    );
  }, [savedSketches, filterQuery]);

  if (!open) return null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTitle.trim() || activeTitle || 'Custom ESP Sketch';
    onSaveCurrent(cleaned);
  };

  const commitRename = (id: string) => {
    const cleaned = editingTitle.trim();
    if (cleaned) {
      onRenameSaved(id, cleaned);
    }
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/45"
      role="dialog"
      aria-modal="true"
      aria-label="Saved Sketches Library"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-stone-300 bg-white text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <div>
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-50">
              Saved Sketches ({savedSketches.length})
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Stored locally in your browser across sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved sketches"
            className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Save Current Form */}
        <form
          onSubmit={handleSaveSubmit}
          className="border-b border-stone-200 bg-stone-50 p-4 space-y-2 dark:border-stone-800 dark:bg-stone-950/50"
        >
          <label
            htmlFor="save-sketch-title"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300"
          >
            Save Current Studio Sketch
          </label>
          <div className="flex items-center gap-2">
            <input
              id="save-sketch-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Garage Relay MQTT"
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save</span>
            </button>
          </div>
        </form>

        {/* Search Saved List */}
        {savedSketches.length > 0 && (
          <div className="border-b border-stone-200 px-4 py-2.5 dark:border-stone-800">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <label htmlFor="saved-sketch-filter" className="sr-only">
                Filter saved sketches
              </label>
              <input
                id="saved-sketch-filter"
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter saved sketches..."
                className="w-full rounded-md border border-stone-300 bg-stone-50 pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 workbench-scroll">
          {savedSketches.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                No saved sketches yet
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Your active edits auto-save automatically. Save named snapshots above to switch between custom and AI-generated firmware anytime.
              </p>
              <button
                type="button"
                onClick={() => onSaveCurrent(newTitle.trim() || activeTitle || 'Custom ESP Sketch')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save Active Sketch</span>
              </button>
            </div>
          ) : filteredSketches.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-8">
              No saved sketches match "{filterQuery}".
            </p>
          ) : (
            filteredSketches.map((sketch) => {
              const board = getBoardById(sketch.boardId);
              const isEditing = editingId === sketch.id;
              return (
                <div
                  key={sketch.id}
                  className="rounded-md border border-stone-300 bg-white p-3 dark:border-stone-800 dark:bg-stone-950"
                >
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {board.shortName} · {sketch.framework === 'micropython' ? 'MicroPython' : sketch.framework === 'espidf' ? 'ESP-IDF' : 'Arduino C++'} · {formatSavedTime(sketch.updatedAt)}
                  </p>

                  {isEditing ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(sketch.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        aria-label="Rename sketch"
                        className="flex-1 rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(sketch.id)}
                        aria-label="Confirm rename"
                        className="rounded border border-stone-300 p-1 text-teal-700 hover:bg-stone-100 dark:border-stone-700 dark:text-teal-400 dark:hover:bg-stone-800"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="mt-1 font-display text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {sketch.title}
                    </h3>
                  )}

                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(sketch.id);
                          setEditingTitle(sketch.title);
                        }}
                        aria-label={`Rename ${sketch.title}`}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSaved(sketch.id)}
                        aria-label={`Delete ${sketch.title}`}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onLoadSaved(sketch);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                    >
                      <FolderOpen className="h-3 w-3" aria-hidden="true" />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
