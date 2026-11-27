import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Code2,
  Globe,
  Lock,
  Megaphone,
  MessageSquare,
  Search,
  Shield,
  Star,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  addDelegatedAdmin,
  adminDeleteComment,
  adminDeleteSketch,
  adminSetSketchModeration,
  removeDelegatedAdmin,
  saveSiteConfig,
  subscribeAdminsList,
  subscribeAllSketchesAdmin,
  subscribeAllUsersAdmin,
  subscribeSketchCommentsAdmin,
} from '../services/adminService';
import type { CloudComment, CloudSketch, UserProfile } from '../types/esp';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  isBootstrapAdminEmail,
  type AdminRecord,
  type SiteConfig,
} from '../utils/adminHelpers';
import { formatRelativeTime } from '../utils/cloudValidation';

interface AdminPanelViewProps {
  user: User;
  siteConfig: SiteConfig;
  isPhoneView?: boolean;
  onLoadCloudSketch: (sketch: CloudSketch) => void;
}

type AdminTab = 'sketches' | 'notice' | 'users';

function AdminCommentsDrawer({ sketchId }: { sketchId: string }) {
  const [comments, setComments] = useState<CloudComment[]>([]);

  useEffect(() => {
    const unsub = subscribeSketchCommentsAdmin(sketchId, setComments);
    return () => unsub();
  }, [sketchId]);

  return (
    <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 space-y-2 dark:border-stone-800 dark:bg-stone-950">
      <p className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
        Comments on this sketch ({comments.length})
      </p>
      {comments.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">No comments on this sketch.</p>
      ) : (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
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
              <button
                type="button"
                onClick={() => void adminDeleteComment(sketchId, c.id)}
                aria-label="Delete comment as admin"
                className="rounded border border-stone-200 p-1 text-stone-500 hover:border-red-400 hover:text-red-600 dark:border-stone-700"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminPanelView({
  user,
  siteConfig,
  isPhoneView = false,
  onLoadCloudSketch,
}: AdminPanelViewProps) {
  const [tab, setTab] = useState<AdminTab>('sketches');
  const [sketches, setSketches] = useState<CloudSketch[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [visFilter, setVisFilter] = useState<'all' | 'public' | 'private' | 'featured'>('all');
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [announcementEnabled, setAnnouncementEnabled] = useState(siteConfig.announcementEnabled);
  const [announcementText, setAnnouncementText] = useState(siteConfig.announcementText);
  const [allowNewPublicSketches, setAllowNewPublicSketches] = useState(
    siteConfig.allowNewPublicSketches
  );
  const [savingConfig, setSavingConfig] = useState(false);

  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPrimaryOwner = isBootstrapAdminEmail(user.email);

  useEffect(() => {
    setAnnouncementEnabled(siteConfig.announcementEnabled);
    setAnnouncementText(siteConfig.announcementText);
    setAllowNewPublicSketches(siteConfig.allowNewPublicSketches);
  }, [siteConfig]);

  useEffect(() => {
    const unsubSketches = subscribeAllSketchesAdmin(setSketches, setErrorMsg);
    const unsubUsers = isPrimaryOwner ? subscribeAllUsersAdmin(setUsers, setErrorMsg) : () => {};
    const unsubAdmins = isPrimaryOwner ? subscribeAdminsList(setAdmins, setErrorMsg) : () => {};
    return () => {
      unsubSketches();
      unsubUsers();
      unsubAdmins();
    };
  }, [isPrimaryOwner]);

  const stats = useMemo(() => {
    let pub = 0;
    let priv = 0;
    let featured = 0;
    let likes = 0;
    for (const s of sketches) {
      if (s.visibility === 'public') pub += 1;
      else priv += 1;
      if (s.featured) featured += 1;
      likes += s.likesCount;
    }
    return { pub, priv, featured, likes, totalUsers: users.length };
  }, [sketches, users.length]);

  const filteredSketches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sketches.filter((s) => {
      if (visFilter === 'public' && s.visibility !== 'public') return false;
      if (visFilter === 'private' && s.visibility !== 'private') return false;
      if (visFilter === 'featured' && !s.featured) return false;
      if (!q) return true;
      return `${s.title} ${s.authorName} ${s.authorUid} ${s.boardName} ${s.tags.join(' ')}`
        .toLowerCase()
        .includes(q);
    });
  }, [sketches, searchQuery, visFilter]);

  const handleModeration = async (
    sketch: CloudSketch,
    updates: { visibility?: 'public' | 'private'; featured?: boolean }
  ) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await adminSetSketchModeration(sketch.id, updates);
      setStatusMsg(`Updated "${sketch.title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update sketch.');
    }
  };

  const handleDeleteSketch = async (sketchId: string, title: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await adminDeleteSketch(sketchId);
      setConfirmDeleteId(null);
      setStatusMsg(`Deleted sketch "${title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete sketch.');
    }
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await saveSiteConfig(user, {
        announcementEnabled,
        announcementText,
        allowNewPublicSketches,
      });
      setStatusMsg('Platform notice & publishing settings saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await addDelegatedAdmin(user, {
        uid: newAdminUid,
        email: newAdminEmail,
        displayName: newAdminName,
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setStatusMsg('Delegated admin added.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add admin.');
    }
  };

  return (
    <section aria-label="Rs-ESP Admin Console" className="space-y-4">
      {/* Header + Stats */}
      <div className="rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                Rs-ESP Admin Console
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              Signed in as <span className="font-mono font-semibold">{user.email}</span> · Moderate sketches &amp; comments, curate featured projects, and manage platform notices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-md border border-stone-200 bg-stone-100 p-0.5 text-xs dark:border-stone-800 dark:bg-stone-950">
            <button
              type="button"
              onClick={() => setTab('sketches')}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors ${
                tab === 'sketches'
                  ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sketches ({sketches.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('notice')}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors ${
                tab === 'notice'
                  ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Notice &amp; Controls</span>
            </button>
            {isPrimaryOwner && (
              <button
                type="button"
                onClick={() => setTab('users')}
                className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium transition-colors ${
                  tab === 'users'
                    ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Users &amp; Admins ({users.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Grid */}
        <div
          className={`mt-4 grid gap-2.5 border-t border-stone-200 pt-3 text-xs dark:border-stone-800 ${
            isPhoneView ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-5'
          }`}
        >
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Public Sketches</p>
            <p className="mt-0.5 font-mono text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {stats.pub}
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Private Sketches</p>
            <p className="mt-0.5 font-mono text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {stats.priv}
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Featured Picks</p>
            <p className="mt-0.5 font-mono text-base font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {stats.featured}
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Total Likes</p>
            <p className="mt-0.5 font-mono text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {stats.likes}
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Registered Creators</p>
            <p className="mt-0.5 font-mono text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {isPrimaryOwner ? stats.totalUsers : '—'}
            </p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {tab === 'sketches' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-300 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search all cloud sketches"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, author name, UID, board, tag..."
                className="w-full rounded-md border border-stone-300 bg-stone-50 pl-8 pr-3 py-1.5 text-xs focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              {(['all', 'public', 'private', 'featured'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setVisFilter(f)}
                  className={`rounded border px-2.5 py-1 font-medium capitalize ${
                    visFilter === f
                      ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredSketches.length === 0 ? (
            <div className="rounded-lg border border-stone-300 bg-white p-8 text-center text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-900">
              No sketches match your moderation filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSketches.map((sketch) => (
                <article
                  key={sketch.id}
                  className="rounded-lg border border-stone-300 bg-white overflow-hidden dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-50">
                          {sketch.title}
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
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
                          <span>{sketch.visibility}</span>
                        </span>
                        {sketch.featured && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                            <span>Featured</span>
                          </span>
                        )}
                        <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                          {sketch.boardName}
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        By <span className="font-semibold">{sketch.authorName}</span> · UID:{' '}
                        <code className="font-mono text-[11px]">{sketch.authorUid}</code> · Updated{' '}
                        {formatRelativeTime(sketch.updatedAtMs)} · {sketch.likesCount} likes
                      </p>
                      {sketch.summary && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                          {sketch.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleModeration(sketch, { featured: !sketch.featured })}
                        className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-medium ${
                          sketch.featured
                            ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200'
                        }`}
                      >
                        <Star className={`h-3 w-3 ${sketch.featured ? 'fill-current' : ''}`} aria-hidden="true" />
                        <span>{sketch.featured ? 'Unfeature' : 'Feature'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleModeration(sketch, {
                            visibility: sketch.visibility === 'public' ? 'private' : 'public',
                          })
                        }
                        className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200"
                      >
                        {sketch.visibility === 'public' ? (
                          <>
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            <span>Hide (Private)</span>
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
                        onClick={() =>
                          setOpenCommentsId((prev) => (prev === sketch.id ? null : sketch.id))
                        }
                        className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200"
                      >
                        <MessageSquare className="h-3 w-3" aria-hidden="true" />
                        <span>Comments</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onLoadCloudSketch(sketch)}
                        className="inline-flex items-center gap-1 rounded bg-teal-700 px-2.5 py-1 font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                      >
                        <Code2 className="h-3 w-3" aria-hidden="true" />
                        <span>Inspect Code</span>
                      </button>

                      {confirmDeleteId === sketch.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteSketch(sketch.id, sketch.title)}
                            className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded border border-stone-300 bg-white px-2 py-1 text-stone-600 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(sketch.id)}
                          aria-label={`Delete ${sketch.title}`}
                          className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-stone-600 hover:border-red-400 hover:text-red-600 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {openCommentsId === sketch.id && <AdminCommentsDrawer sketchId={sketch.id} />}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'notice' && (
        <form
          onSubmit={handleSaveNotice}
          className="rounded-lg border border-stone-300 bg-white p-5 space-y-4 dark:border-stone-800 dark:bg-stone-900"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              Global Announcement Banner &amp; Community Controls
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Display a site-wide notice bar across Rs-ESP for maintenance alerts, hardware challenges, or community guidelines.
            </p>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-stone-800 dark:text-stone-200">
            <input
              type="checkbox"
              checked={announcementEnabled}
              onChange={(e) => setAnnouncementEnabled(e.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            <span>Enable global announcement banner</span>
          </label>

          <div>
            <label
              htmlFor="admin-announcement-text"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
            >
              Announcement Text (max 280 chars)
            </label>
            <textarea
              id="admin-announcement-text"
              rows={3}
              maxLength={280}
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="e.g. Weekend Challenge: Build an ESP32-S3 MQTT weather node and share it in Community!"
              className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-stone-800 dark:text-stone-200">
            <input
              type="checkbox"
              checked={allowNewPublicSketches}
              onChange={(e) => setAllowNewPublicSketches(e.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            <span>Allow community members to publish new public sketches</span>
          </label>

          <button
            type="submit"
            disabled={savingConfig}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{savingConfig ? 'Saving...' : 'Save Platform Settings'}</span>
          </button>
        </form>
      )}

      {tab === 'users' && isPrimaryOwner && (
        <div className={`grid gap-4 ${isPhoneView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {/* Creator Directory */}
          <div className="rounded-lg border border-stone-300 bg-white p-4 space-y-3 dark:border-stone-800 dark:bg-stone-900">
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              Registered Creators ({users.length})
            </h2>
            {users.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">No creator profiles recorded yet.</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {users.map((u) => (
                  <li
                    key={u.uid}
                    className="flex items-center justify-between gap-2 rounded border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-950"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">{u.displayName}</p>
                      <p className="truncate font-mono text-[11px] text-stone-500 dark:text-stone-400">
                        UID: {u.uid}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewAdminUid(u.uid);
                        setNewAdminName(u.displayName);
                      }}
                      className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                    >
                      Select UID
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delegated Admin Management */}
          <div className="rounded-lg border border-stone-300 bg-white p-4 space-y-4 dark:border-stone-800 dark:bg-stone-900">
            <div>
              <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
                Admin Access &amp; Moderation Team
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Primary owner: <span className="font-mono font-semibold">{BOOTSTRAP_ADMIN_EMAIL}</span>
              </p>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-2.5 border-t border-stone-200 pt-3 dark:border-stone-800">
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                Grant Admin Access by User UID
              </p>
              <input
                type="text"
                required
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                placeholder="Firebase Auth UID"
                className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 font-mono text-xs dark:border-stone-700 dark:bg-stone-950"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Display Name"
                  className="rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs dark:border-stone-700 dark:bg-stone-950"
                />
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Email (optional note)"
                  className="rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs dark:border-stone-700 dark:bg-stone-950"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Delegated Admin</span>
              </button>
            </form>

            <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                Delegated Admins ({admins.length})
              </p>
              {admins.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  No delegated admins added yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {admins.map((a) => (
                    <li
                      key={a.uid}
                      className="flex items-center justify-between gap-2 rounded border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-950"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900 dark:text-stone-100">
                          {a.displayName} {a.email ? `(${a.email})` : ''}
                        </p>
                        <p className="truncate font-mono text-[11px] text-stone-500">{a.uid}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeDelegatedAdmin(a.uid)}
                        aria-label={`Remove admin ${a.displayName}`}
                        className="rounded border border-stone-300 bg-white p-1 text-stone-500 hover:text-red-600 dark:border-stone-700 dark:bg-stone-900"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
