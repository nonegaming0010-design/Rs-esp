import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
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
  CLOUD_LIMITS,
  generateSafeDocId,
  sanitizeCloudSketchInput,
  sanitizeCommentBody,
  sanitizeDisplayName,
} from '../utils/cloudValidation';

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: unknown }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function mapSketchDoc(docId: string, data: Record<string, unknown>): CloudSketch {
  return {
    id: typeof data.id === 'string' ? data.id : docId,
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'ESP Builder',
    authorPhoto: typeof data.authorPhoto === 'string' ? data.authorPhoto : '',
    title: typeof data.title === 'string' ? data.title : 'Untitled Sketch',
    summary: typeof data.summary === 'string' ? data.summary : '',
    code: typeof data.code === 'string' ? data.code : '',
    boardId: typeof data.boardId === 'string' ? data.boardId : 'esp32-devkit-v1',
    boardName: typeof data.boardName === 'string' ? data.boardName : 'ESP32 DevKit v1',
    framework:
      data.framework === 'micropython' || data.framework === 'espidf' ? data.framework : 'arduino',
    visibility: data.visibility === 'private' ? 'private' : 'public',
    tags: Array.isArray(data.tags) ? data.tags.filter((x): x is string => typeof x === 'string') : [],
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
}

export async function syncUserProfile(user: User, customBio?: string): Promise<UserProfile | null> {
  if (!user.emailVerified) return null;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = sanitizeDisplayName(user.displayName, user.email);
  const photoURL = (user.photoURL ?? '').slice(0, CLOUD_LIMITS.PHOTO_URL_MAX);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const bio = (customBio ?? '').trim().slice(0, CLOUD_LIMITS.BIO_MAX);
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        photoURL,
        bio,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { uid: user.uid, displayName, photoURL, bio };
    }
    const existing = snap.data() as Record<string, unknown>;
    const bio =
      customBio !== undefined
        ? customBio.trim().slice(0, CLOUD_LIMITS.BIO_MAX)
        : typeof existing.bio === 'string'
          ? existing.bio
          : '';
    await updateDoc(ref, {
      displayName,
      photoURL,
      bio,
      updatedAt: serverTimestamp(),
    });
    return { uid: user.uid, displayName, photoURL, bio };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribePublicSketches(
  onData: (sketches: CloudSketch[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  const path = 'sketches';
  const q = query(collection(db, 'sketches'), where('visibility', '==', 'public'), limit(80));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapSketchDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(error.message || 'Unable to load community sketches.');
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeMySketches(
  userUid: string,
  onData: (sketches: CloudSketch[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  const path = 'sketches';
  const q = query(collection(db, 'sketches'), where('authorUid', '==', userUid), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapSketchDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(error.message || 'Unable to load your cloud sketches.');
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function publishOrUpdateCloudSketch(
  user: User,
  input: {
    existingSketchId?: string;
    title: string;
    summary: string;
    code: string;
    boardId: string;
    boardName: string;
    framework: FrameworkId;
    visibility: CloudSketchVisibility;
    tags: string[];
    libraries: string[];
    wiring: WiringItem[];
    baudRate: number;
  }
): Promise<string> {
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before publishing or saving cloud sketches.');
  }

  const sanitized = sanitizeCloudSketchInput(input);
  if (!sanitized.ok) {
    throw new Error(sanitized.error);
  }

  const authorName = sanitizeDisplayName(user.displayName, user.email);
  const authorPhoto = (user.photoURL ?? '').slice(0, CLOUD_LIMITS.PHOTO_URL_MAX);

  if (input.existingSketchId && CLOUD_LIMITS.ID_PATTERN.test(input.existingSketchId)) {
    const path = `sketches/${input.existingSketchId}`;
    try {
      await updateDoc(doc(db, 'sketches', input.existingSketchId), {
        authorName,
        authorPhoto,
        ...sanitized.payload,
        updatedAt: serverTimestamp(),
      });
      return input.existingSketchId;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  const sketchId = generateSafeDocId('sk');
  const path = `sketches/${sketchId}`;
  try {
    await setDoc(doc(db, 'sketches', sketchId), {
      id: sketchId,
      authorUid: user.uid,
      authorName,
      authorPhoto,
      ...sanitized.payload,
      likesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return sketchId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function toggleCloudSketchVisibility(
  sketchId: string,
  nextVisibility: CloudSketchVisibility
): Promise<void> {
  const path = `sketches/${sketchId}`;
  try {
    await updateDoc(doc(db, 'sketches', sketchId), {
      visibility: nextVisibility,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCloudSketch(sketchId: string): Promise<void> {
  const path = `sketches/${sketchId}`;
  try {
    await deleteDoc(doc(db, 'sketches', sketchId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchLikedSketchIdsForUser(
  sketchIds: string[],
  userUid: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  if (!userUid || sketchIds.length === 0) return liked;

  const checks = await Promise.allSettled(
    sketchIds.map(async (id) => {
      const snap = await getDoc(doc(db, 'sketches', id, 'likes', userUid));
      return { id, exists: snap.exists() };
    })
  );

  for (const res of checks) {
    if (res.status === 'fulfilled' && res.value.exists) {
      liked.add(res.value.id);
    }
  }
  return liked;
}

export async function toggleSketchLike(sketchId: string, user: User): Promise<boolean> {
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before liking community sketches.');
  }

  const sketchRef = doc(db, 'sketches', sketchId);
  const likeRef = doc(db, 'sketches', sketchId, 'likes', user.uid);
  const path = `sketches/${sketchId}/likes/${user.uid}`;

  try {
    const [sketchSnap, likeSnap] = await Promise.all([getDoc(sketchRef), getDoc(likeRef)]);
    if (!sketchSnap.exists()) {
      throw new Error('Sketch no longer exists.');
    }
    const sketchData = sketchSnap.data() as Record<string, unknown>;
    const currentLikes = typeof sketchData.likesCount === 'number' ? sketchData.likesCount : 0;

    const batch = writeBatch(db);
    if (likeSnap.exists()) {
      batch.delete(likeRef);
      batch.update(sketchRef, { likesCount: Math.max(0, currentLikes - 1) });
      await batch.commit();
      return false;
    } else {
      batch.set(likeRef, { uid: user.uid, createdAt: serverTimestamp() });
      batch.update(sketchRef, { likesCount: currentLikes + 1 });
      await batch.commit();
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeSketchComments(
  sketchId: string,
  onData: (comments: CloudComment[]) => void
): Unsubscribe {
  const path = `sketches/${sketchId}/comments`;
  const q = query(
    collection(db, 'sketches', sketchId, 'comments'),
    where('sketchVisibility', '==', 'public'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const comments = snapshot.docs
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
      onData(comments);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function addSketchComment(
  sketchId: string,
  rawBody: string,
  user: User
): Promise<void> {
  if (!user.emailVerified) {
    throw new Error('Please verify your email address before posting comments.');
  }
  const validated = sanitizeCommentBody(rawBody);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const commentId = generateSafeDocId('cmt');
  const path = `sketches/${sketchId}/comments/${commentId}`;
  try {
    await setDoc(doc(db, 'sketches', sketchId, 'comments', commentId), {
      id: commentId,
      sketchId,
      sketchVisibility: 'public',
      authorUid: user.uid,
      authorName: sanitizeDisplayName(user.displayName, user.email),
      authorPhoto: (user.photoURL ?? '').slice(0, CLOUD_LIMITS.PHOTO_URL_MAX),
      body: validated.body,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteSketchComment(sketchId: string, commentId: string): Promise<void> {
  const path = `sketches/${sketchId}/comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'sketches', sketchId, 'comments', commentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
