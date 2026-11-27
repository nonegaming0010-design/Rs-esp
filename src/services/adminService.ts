import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CloudComment,
  CloudSketch,
  CloudSketchVisibility,
  FrameworkId,
  UserProfile,
  WiringItem,
} from '../types/esp';
import {
  DEFAULT_SITE_CONFIG,
  sanitizeSiteConfigInput,
  type AdminRecord,
  type SiteConfig,
} from '../utils/adminHelpers';
import { CLOUD_LIMITS, sanitizeDisplayName } from '../utils/cloudValidation';

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (
    ts &&
    typeof ts === 'object' &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function subscribeIsDelegatedAdmin(
  uid: string,
  onChange: (isDelegated: boolean) => void
): Unsubscribe {
  const path = `admins/${uid}`;
  return onSnapshot(
    doc(db, 'admins', uid),
    (snap) => {
      onChange(snap.exists());
    },
    (err) => {
      // Permission denied is expected when non-admin reads another doc, but own doc read is allowed
      if ((err as { code?: string })?.code === 'permission-denied') {
        onChange(false);
        return;
      }
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeSiteConfig(onChange: (config: SiteConfig) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'siteConfig', 'global'),
    (snap) => {
      if (!snap.exists()) {
        onChange(DEFAULT_SITE_CONFIG);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      onChange({
        announcementEnabled: Boolean(d.announcementEnabled),
        announcementText: typeof d.announcementText === 'string' ? d.announcementText : '',
        allowNewPublicSketches: d.allowNewPublicSketches !== false,
        updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : '',
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    () => {
      onChange(DEFAULT_SITE_CONFIG);
    }
  );
}

export async function saveSiteConfig(
  adminUser: User,
  input: {
    announcementEnabled: boolean;
    announcementText: string;
    allowNewPublicSketches: boolean;
  }
): Promise<void> {
  const path = 'siteConfig/global';
  const clean = sanitizeSiteConfigInput(input);
  try {
    await setDoc(doc(db, 'siteConfig', 'global'), {
      ...clean,
      updatedBy: sanitizeDisplayName(adminUser.displayName, adminUser.email),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeAllSketchesAdmin(
  onData: (sketches: CloudSketch[]) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  const path = 'sketches';
  const q = query(collection(db, 'sketches'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
            authorName: typeof data.authorName === 'string' ? data.authorName : 'ESP Builder',
            authorPhoto: typeof data.authorPhoto === 'string' ? data.authorPhoto : '',
            title: typeof data.title === 'string' ? data.title : 'Untitled Sketch',
            summary: typeof data.summary === 'string' ? data.summary : '',
            code: typeof data.code === 'string' ? data.code : '',
            boardId: typeof data.boardId === 'string' ? data.boardId : 'esp32-devkit-v1',
            boardName: typeof data.boardName === 'string' ? data.boardName : 'ESP32 DevKit v1',
            framework: (data.framework === 'micropython' || data.framework === 'espidf'
              ? data.framework
              : 'arduino') as FrameworkId,
            visibility: (data.visibility === 'private' ? 'private' : 'public') as CloudSketchVisibility,
            tags: Array.isArray(data.tags)
              ? data.tags.filter((x): x is string => typeof x === 'string')
              : [],
            libraries: Array.isArray(data.libraries)
              ? data.libraries.filter((x): x is string => typeof x === 'string')
              : [],
            wiring: Array.isArray(data.wiring) ? (data.wiring as WiringItem[]) : [],
            baudRate: typeof data.baudRate === 'number' ? data.baudRate : 115200,
            likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
            featured: Boolean(data.featured),
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (err) => {
      onError?.(err.message || 'Unable to list sketches as admin.');
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function adminSetSketchModeration(
  sketchId: string,
  updates: { visibility?: CloudSketchVisibility; featured?: boolean }
): Promise<void> {
  const path = `sketches/${sketchId}`;
  try {
    await updateDoc(doc(db, 'sketches', sketchId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminDeleteSketch(sketchId: string): Promise<void> {
  const path = `sketches/${sketchId}`;
  try {
    await deleteDoc(doc(db, 'sketches', sketchId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeSketchCommentsAdmin(
  sketchId: string,
  onData: (comments: CloudComment[]) => void
): Unsubscribe {
  const path = `sketches/${sketchId}/comments`;
  const q = query(collection(db, 'sketches', sketchId, 'comments'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            sketchId: typeof data.sketchId === 'string' ? data.sketchId : sketchId,
            sketchVisibility: 'public' as const,
            authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
            authorName: typeof data.authorName === 'string' ? data.authorName : 'ESP Builder',
            authorPhoto: typeof data.authorPhoto === 'string' ? data.authorPhoto : '',
            body: typeof data.body === 'string' ? data.body : '',
            createdAtMs: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function adminDeleteComment(sketchId: string, commentId: string): Promise<void> {
  const path = `sketches/${sketchId}/comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'sketches', sketchId, 'comments', commentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeAllUsersAdmin(
  onData: (users: UserProfile[]) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  const path = 'users';
  const q = query(collection(db, 'users'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: typeof data.uid === 'string' ? data.uid : d.id,
          displayName: typeof data.displayName === 'string' ? data.displayName : 'ESP Builder',
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
          bio: typeof data.bio === 'string' ? data.bio : '',
        };
      });
      onData(list);
    },
    (err) => {
      onError?.(err.message || 'Unable to load creator directory.');
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAdminsList(
  onData: (admins: AdminRecord[]) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  const path = 'admins';
  const q = query(collection(db, 'admins'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: typeof data.uid === 'string' ? data.uid : d.id,
          email: typeof data.email === 'string' ? data.email : '',
          displayName: typeof data.displayName === 'string' ? data.displayName : 'Admin',
          addedBy: typeof data.addedBy === 'string' ? data.addedBy : '',
          createdAtMs: toMillis(data.createdAt),
        };
      });
      onData(list);
    },
    (err) => {
      onError?.(err.message || 'Unable to load delegated admins.');
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function addDelegatedAdmin(
  ownerUser: User,
  target: { uid: string; email: string; displayName: string }
): Promise<void> {
  const uid = target.uid.trim();
  if (!CLOUD_LIMITS.ID_PATTERN.test(uid)) {
    throw new Error('Invalid Firebase UID format.');
  }
  const email = target.email.trim().slice(0, 120);
  const displayName = target.displayName.trim().slice(0, 60) || 'Admin';
  const path = `admins/${uid}`;
  try {
    await setDoc(doc(db, 'admins', uid), {
      uid,
      email,
      displayName,
      addedBy: sanitizeDisplayName(ownerUser.displayName, ownerUser.email),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeDelegatedAdmin(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
