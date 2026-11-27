import type { User } from 'firebase/auth';
import {
  Code2,
  Edit3,
  Globe,
  Heart,
  Loader2,
  Lock,
  MessageSquare,
  Search,
  Send,
  Star,
  Trash2,
  UploadCloud,
  UserCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getBoardById } from '../data/boards';
import {
  addSketchComment,
  deleteCloudSketch,
  deleteSketchComment,
  fetchLikedSketchIdsForUser,
  subscribeMySketches,
  subscribePublicSketches,
  subscribeSketchComments,
  toggleCloudSketchVisibility,
  toggleSketchLike,
} from '../services/cloudSketches';
import type { BoardFamily, CloudComment, CloudSketch, FrameworkId } from '../types/esp';
import { formatRelativeTime } from '../utils/cloudValidation';

interface CommunityViewProps {
  user: User | null;
  isAdmin?: boolean;
  isPhoneView?: boolean;
  onOpenAuth: () => void;
  onOpenPublishModal: (sketchToEdit?: CloudSketch) => void;
  onLoadCloudSketch: (sketch: CloudSketch) => void;
}

function CommentSection({
  sketchId,
  user,
  isAdmin,
  onOpenAuth,
}: {
  sketchId: string;
  user: User | null;
  isAdmin?: boolean;
  onOpenAuth: () => void;
}) {
  const [comments, setComments] = useState<CloudComment[]>([]);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeSketchComments(sketchId, setComments);
    return () => unsub();
  }, [sketchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await addSketchComment(sketchId, body, user);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 space-y-2.5 dark:border-stone-800 dark:bg-stone-950/70">
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">No comments yet. Start the discussion!</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-2 rounded border border-stone-200 bg-white px-2.5 py-2 text-xs dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-800 dark:text-stone-100">{c.authorName}</span>
                  <span className="text-[11px] text-stone-400">{formatRelativeTime(c.createdAtMs)}</span>
                </div>
                <p className="mt-0.5 text-stone-700 dark:text-stone-300 break-words">{c.body}</p>
              </div>
              {(user?.uid === c.authorUid || isAdmin) && (
                <button
                  type="button"
                  onClick={() => deleteSketchComment(sketchId, c.id)}
                  aria-label="Delete comment"
                  className="rounded p-1 text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor={`comment-input-${sketchId}`} className="sr-only">
          Add a comment
        </label>
        <input
          id={`comment-input-${sketchId}`}
          type="text"
          maxLength={600}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={user ? 'Write a comment or wiring tip...' : 'Sign in to leave a comment...'}
          className="flex-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        />
        <button
          type="submit"
          disabled={posting}
          className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          <span>Post</span>
        </button>
      </form>
    </div>
  );
}

export function CommunityView({
  user,
  isAdmin = false,
  isPhoneView = false,
  onOpenAuth,
  onOpenPublishModal,
  onLoadCloudSketch,
}: CommunityViewProps) {
  const [feedTab, setFeedTab] = useState<'public' | 'mine'>('public');
  const [publicSketches, setPublicSketches] = useState<CloudSketch[]>([]);
  const [mySketches, setMySketches] = useState<CloudSketch[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [boardFilter, setBoardFilter] = useState<'all' | BoardFamily>('all');
  const [frameworkFilter, setFrameworkFilter] = useState<'all' | FrameworkId>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'liked'>('newest');
  const [expandedCodeIds, setExpandedCodeIds] = useState<Record<string, boolean>>({});
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingPublic(true);
    const unsub = subscribePublicSketches(
      (list) => {
        setPublicSketches(list);
        setLoadingPublic(false);
      },
      (msg) => {
        setActionError(msg);
        setLoadingPublic(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setMySketches([]);
      return;
    }
    const unsub = subscribeMySketches(user.uid, setMySketches, setActionError);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || publicSketches.length === 0) {
      setLikedIds(new Set());
      return;
    }
    let cancelled = false;
    fetchLikedSketchIdsForUser(
      publicSketches.map((s) => s.id),
      user.uid
    ).then((ids) => {
      if (!cancelled) setLikedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [user, publicSketches]);

  const activeList = feedTab === 'mine' ? mySketches : publicSketches;

  const filteredSketches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = activeList.filter((s) => {
      if (boardFilter !== 'all') {
        const board = getBoardById(s.boardId);
        if (board.family !== boardFilter) return false;
      }
      if (frameworkFilter !== 'all' && s.framework !== frameworkFilter) {
        return false;
      }
      if (q) {
        const hay = `${s.title} ${s.summary} ${s.authorName} ${s.boardName} ${s.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'liked') {
      return [...list].sort((a, b) => b.likesCount - a.likesCount || b.updatedAtMs - a.updatedAtMs);
    }
    return [...list].sort((a, b) => {
      const fDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (fDiff !== 0) return fDiff;
      return b.updatedAtMs - a.updatedAtMs;
    });
  }, [activeList, boardFilter, frameworkFilter, searchQuery, sortBy]);

  const handleLike = async (sketch: CloudSketch) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setActionError(null);
    try {
      const nowLiked = await toggleSketchLike(sketch.id, user);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (nowLiked) next.add(sketch.id);
        else next.delete(sketch.id);
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update like.');
    }
  };

  const handleToggleVisibility = async (sketch: CloudSketch) => {
    setActionError(null);
    const nextVis = sketch.visibility === 'public' ? 'private' : 'public';
    try {
      await toggleCloudSketchVisibility(sketch.id, nextVis);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to change visibility.');
    }
  };

  const handleDelete = async (sketchId: string) => {
    setActionError(null);
    try {
      await deleteCloudSketch(sketchId);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete sketch.');
    }
  };

  return (
    <section aria-label="Community ESP Code Feed" className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Rs-ESP Community &amp; Cloud Sketches
            </h1>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              Publish your ESP32 &amp; ESP8266 projects publicly, keep private backups in your account, or fork community code into Studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!user && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:hover:bg-stone-800"
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign In / Join</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenPublishModal()}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload / Publish Code</span>
            </button>
          </div>
        </div>

        {/* Feed Tabs + Filters */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3 dark:border-stone-800">
          <div className="flex items-center gap-1 rounded-md border border-stone-200 bg-stone-100 p-0.5 text-xs dark:border-stone-800 dark:bg-stone-950">
            <button
              type="button"
              onClick={() => setFeedTab('public')}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors ${
                feedTab === 'public'
                  ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Public Feed ({publicSketches.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFeedTab('mine')}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors ${
                feedTab === 'mine'
                  ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>My Sketches ({user ? mySketches.length : 0})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search community sketches"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, author, tag..."
                className="w-48 rounded-md border border-stone-300 bg-stone-50 pl-8 pr-2.5 py-1.5 text-xs focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>

            <select
              aria-label="Filter by board family"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value as 'all' | BoardFamily)}
              className="rounded-md border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs dark:border-stone-700 dark:bg-stone-950"
            >
              <option value="all">All Boards</option>
              <option value="esp32">ESP32</option>
              <option value="esp8266">ESP8266</option>
            </select>

            <select
              aria-label="Filter by language"
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value as 'all' | FrameworkId)}
              className="rounded-md border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs dark:border-stone-700 dark:bg-stone-950"
            >
              <option value="all">All Languages</option>
              <option value="arduino">Arduino C++</option>
              <option value="micropython">MicroPython</option>
              <option value="espidf">ESP-IDF</option>
            </select>

            <select
              aria-label="Sort sketches"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'liked')}
              className="rounded-md border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs dark:border-stone-700 dark:bg-stone-950"
            >
              <option value="newest">Newest</option>
              <option value="liked">Most Liked</option>
            </select>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      {feedTab === 'mine' && !user ? (
        <div className="rounded-lg border border-stone-300 bg-white p-10 text-center space-y-3 dark:border-stone-800 dark:bg-stone-900">
          <Lock className="mx-auto h-8 w-8 text-stone-400" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            Sign in to view your Public &amp; Private sketches
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Your private sketches are protected by your Google, Apple, or Email account so only you can view or publish them.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Sign In / Create Account
          </button>
        </div>
      ) : loadingPublic && feedTab === 'public' ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white p-12 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-900">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading community sketches...</span>
        </div>
      ) : filteredSketches.length === 0 ? (
        <div className="rounded-lg border border-stone-300 bg-white p-10 text-center space-y-3 dark:border-stone-800 dark:bg-stone-900">
          <Globe className="mx-auto h-8 w-8 text-stone-400" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            {feedTab === 'mine'
              ? 'You have no cloud sketches yet'
              : publicSketches.length === 0
                ? 'No community sketches published yet'
                : 'No published sketches match your filter'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {feedTab === 'mine'
              ? 'Upload a firmware file or publish your active Code Studio sketch as Public or Private.'
              : 'Be the first to share an ESP32 or ESP8266 project with the community!'}
          </p>
          <button
            type="button"
            onClick={() => onOpenPublishModal()}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload / Publish Code</span>
          </button>
        </div>
      ) : (
        <div className={`grid gap-4 ${isPhoneView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {filteredSketches.map((sketch) => {
            const isOwner = user?.uid === sketch.authorUid;
            const isLiked = likedIds.has(sketch.id);
            const codeLines = sketch.code.split('\n');
            const expanded = !!expandedCodeIds[sketch.id];
            const previewCode = expanded ? sketch.code : codeLines.slice(0, 9).join('\n');
            const fwLabel =
              sketch.framework === 'micropython'
                ? 'MicroPython'
                : sketch.framework === 'espidf'
                  ? 'ESP-IDF'
                  : 'Arduino C++';

            return (
              <article
                key={sketch.id}
                className="flex flex-col rounded-lg border border-stone-300 bg-white overflow-hidden dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="p-4 space-y-3 flex-1">
                  {/* Author + Visibility */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {sketch.authorPhoto ? (
                        <img
                          src={sketch.authorPhoto}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover border border-stone-300 dark:border-stone-700"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white shrink-0">
                          {sketch.authorName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {sketch.authorName}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          {formatRelativeTime(sketch.updatedAtMs)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {sketch.featured && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                          <span>Featured</span>
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                          sketch.visibility === 'private'
                            ? 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200'
                            : 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                        }`}
                      >
                        {sketch.visibility === 'private' ? (
                          <Lock className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Globe className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{sketch.visibility === 'private' ? 'Private' : 'Public'}</span>
                      </span>
                      <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        {sketch.boardName}
                      </span>
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        {fwLabel}
                      </span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
                      {sketch.title}
                    </h2>
                    {sketch.summary && (
                      <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                        {sketch.summary}
                      </p>
                    )}
                  </div>

                  {sketch.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sketch.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Code Snippet */}
                  <div className="rounded-md border border-stone-800 bg-stone-950 overflow-hidden">
                    <pre className="p-3 font-mono text-[11px] leading-5 text-stone-200 overflow-x-auto max-h-60 workbench-scroll">
                      {previewCode}
                    </pre>
                    {codeLines.length > 9 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCodeIds((prev) => ({ ...prev, [sketch.id]: !prev[sketch.id] }))
                        }
                        className="w-full border-t border-stone-800 bg-stone-900/80 py-1 text-[11px] font-medium text-teal-300 hover:bg-stone-900"
                      >
                        {expanded ? 'Collapse code' : `Show all ${codeLines.length} lines`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-xs dark:border-stone-800 dark:bg-stone-950/60">
                  <div className="flex items-center gap-2">
                    {sketch.visibility === 'public' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleLike(sketch)}
                          aria-pressed={isLiked}
                          className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-medium transition-colors tabular-nums ${
                            isLiked
                              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300'
                              : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                          }`}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{sketch.likesCount}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenCommentsId((prev) => (prev === sketch.id ? null : sketch.id))
                          }
                          aria-expanded={openCommentsId === sketch.id}
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                        >
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Comments</span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(sketch)}
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                        >
                          {sketch.visibility === 'public' ? (
                            <>
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              <span>Make Private</span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-3 w-3" aria-hidden="true" />
                              <span>Publish</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenPublishModal(sketch)}
                          aria-label={`Edit ${sketch.title}`}
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                        >
                          <Edit3 className="h-3 w-3" aria-hidden="true" />
                        </button>

                        {confirmDeleteId === sketch.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(sketch.id)}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sketch.id)}
                            aria-label={`Delete ${sketch.title}`}
                            className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-stone-600 hover:text-red-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onLoadCloudSketch(sketch)}
                      className="inline-flex items-center gap-1 rounded bg-teal-700 px-3 py-1 font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Open in Studio</span>
                    </button>
                  </div>
                </div>

                {openCommentsId === sketch.id && sketch.visibility === 'public' && (
                  <CommentSection
                    sketchId={sketch.id}
                    user={user}
                    isAdmin={isAdmin}
                    onOpenAuth={onOpenAuth}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
