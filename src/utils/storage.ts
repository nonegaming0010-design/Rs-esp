import type { SavedSketch, WorkspaceDraft } from '../types/esp';

export type AppViewMode = 'desktop' | 'phone';

const WORKSPACE_DRAFT_KEY = 'rs_esp_workspace_draft_v1';
const SAVED_SKETCHES_KEY = 'rs_esp_saved_sketches_v1';
const VIEW_MODE_KEY = 'rs_esp_view_mode_v1';
const MAX_SAVED_SKETCHES = 60;

export function normalizeViewMode(value: unknown): AppViewMode {
  return value === 'phone' ? 'phone' : 'desktop';
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadViewMode(): AppViewMode {
  if (!hasStorage()) return 'desktop';
  try {
    return normalizeViewMode(window.localStorage.getItem(VIEW_MODE_KEY));
  } catch {
    return 'desktop';
  }
}

export function saveViewMode(mode: AppViewMode): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, normalizeViewMode(mode));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspaceDraft(): WorkspaceDraft | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceDraft>;
    if (!parsed || typeof parsed.code !== 'string' || typeof parsed.boardId !== 'string') {
      return null;
    }
    return {
      boardId: parsed.boardId,
      framework: parsed.framework === 'micropython' || parsed.framework === 'espidf' ? parsed.framework : 'arduino',
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : 'Untitled ESP Sketch',
      code: parsed.code,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      wiring: Array.isArray(parsed.wiring) ? parsed.wiring : [],
      libraries: Array.isArray(parsed.libraries) ? parsed.libraries : [],
      baudRate: typeof parsed.baudRate === 'number' && parsed.baudRate > 0 ? parsed.baudRate : 115200,
      isDark: Boolean(parsed.isDark),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceDraft(draft: WorkspaceDraft): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(WORKSPACE_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedSketches(): SavedSketch[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SAVED_SKETCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedSketch =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.code === 'string'
    );
  } catch {
    return [];
  }
}

export function persistSavedSketches(sketches: SavedSketch[]): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(
      SAVED_SKETCHES_KEY,
      JSON.stringify(sketches.slice(0, MAX_SAVED_SKETCHES))
    );
    return true;
  } catch {
    return false;
  }
}
