import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { appleProvider, auth, FIREBASE_AUTH_DOMAIN, googleProvider } from '../firebase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  reasonMessage?: string | null;
  onUserRefreshed?: () => void;
}

type EmailMode = 'signin' | 'signup' | 'reset';

interface AuthErrorDiagnosis {
  message: string;
  isAppleSetupIssue: boolean;
  showRedirectRetry: boolean;
}

function diagnoseAuthError(err: unknown, providerLabel?: string): AuthErrorDiagnosis {
  const code = (err as { code?: string })?.code ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  const isApple = providerLabel === 'Apple Sign-In';

  if (code === 'auth/operation-not-allowed') {
    return {
      message: `${providerLabel || 'This sign-in method'} is not enabled yet in Firebase Authentication. Configure Apple in Firebase Console → Authentication → Sign-in method, or sign in with Google below.`,
      isAppleSetupIssue: isApple,
      showRedirectRetry: false,
    };
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return {
      message: `Domain "${host}" is not authorized in Firebase Authentication → Settings → Authorized domains. Add it in Firebase Console to enable OAuth sign-in.`,
      isAppleSetupIssue: isApple,
      showRedirectRetry: false,
    };
  }
  if (
    code === 'auth/popup-blocked' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/operation-not-supported-in-this-environment'
  ) {
    return {
      message:
        'Browser blocked the sign-in popup or third-party cookies inside this frame. Try Redirect Sign-In (outside embedded frame) or use Google / Email sign-in.',
      isAppleSetupIssue: isApple,
      showRedirectRetry: isApple,
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      message: 'Sign-in popup was closed before completing.',
      isAppleSetupIssue: false,
      showRedirectRetry: isApple,
    };
  }
  if (code === 'auth/missing-or-invalid-nonce' || code === 'auth/internal-error') {
    return {
      message:
        'Apple Sign-In rejected the OAuth callback (check Apple Developer Services ID, Return URL, and Key ID in Firebase Console).',
      isAppleSetupIssue: isApple,
      showRedirectRetry: isApple,
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      message: 'An account with this email already exists. Switch to Sign In instead.',
      isAppleSetupIssue: false,
      showRedirectRetry: false,
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      message: isApple
        ? 'Apple OAuth credential validation failed. Verify your Apple Services ID, Team ID, and Private Key in Firebase Console → Authentication → Sign-in method → Apple.'
        : 'Incorrect email or password. Please check your credentials and retry.',
      isAppleSetupIssue: isApple,
      showRedirectRetry: false,
    };
  }
  if (code === 'auth/weak-password') {
    return {
      message: 'Password must be at least 6 characters long.',
      isAppleSetupIssue: false,
      showRedirectRetry: false,
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      message: 'Please enter a valid email address.',
      isAppleSetupIssue: false,
      showRedirectRetry: false,
    };
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return {
      message:
        'An account already exists with this email under another sign-in provider (e.g. Google or Email). Sign in with that provider first.',
      isAppleSetupIssue: false,
      showRedirectRetry: false,
    };
  }
  return {
    message: msg || 'Authentication failed. Please try again.',
    isAppleSetupIssue: isApple,
    showRedirectRetry: false,
  };
}

export function AuthModal({ open, onClose, user, reasonMessage, onUserRefreshed }: AuthModalProps) {
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleSetupHelp, setAppleSetupHelp] = useState<boolean>(false);
  const [showRedirectRetry, setShowRedirectRetry] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Complete any pending OAuth redirect flow (e.g., Apple redirect sign-in)
  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then((res) => {
        if (active && res?.user) {
          onUserRefreshed?.();
          if (open) onClose();
        }
      })
      .catch((err) => {
        if (!active) return;
        const diag = diagnoseAuthError(err, 'Apple Sign-In');
        setError(diag.message);
        setAppleSetupHelp(diag.isAppleSetupIssue);
      });
    return () => {
      active = false;
    };
  }, [open, onClose, onUserRefreshed]);

  if (!open) return null;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const redirectHandlerUrl = `https://${FIREBASE_AUTH_DOMAIN}/__/auth/handler`;

  const handleGoogleSignIn = async () => {
    setLoading('google');
    setError(null);
    setNotice(null);
    setAppleSetupHelp(false);
    setShowRedirectRetry(false);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      const diag = diagnoseAuthError(err, 'Google Sign-In');
      setError(diag.message);
    } finally {
      setLoading(null);
    }
  };

  const handleAppleSignIn = async (preferRedirect = false) => {
    setLoading('apple');
    setError(null);
    setNotice(null);
    setAppleSetupHelp(false);
    setShowRedirectRetry(false);
    try {
      if (preferRedirect) {
        if (isInIframe) {
          setError(
            'Apple blocks redirect sign-in inside an embedded preview iframe. Open this app in a standalone browser tab to use Apple Redirect Sign-In, or sign in with Google/Email.'
          );
          setAppleSetupHelp(true);
          return;
        }
        await signInWithRedirect(auth, appleProvider);
        return;
      }
      await signInWithPopup(auth, appleProvider);
      onClose();
    } catch (err) {
      const diag = diagnoseAuthError(err, 'Apple Sign-In');
      setError(diag.message);
      setAppleSetupHelp(diag.isAppleSetupIssue);
      setShowRedirectRetry(diag.showRedirectRetry);
    } finally {
      setLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setAppleSetupHelp(false);
    setShowRedirectRetry(false);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (emailMode === 'reset') {
      setLoading('email');
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('Password reset link sent! Check your inbox.');
        setEmailMode('signin');
      } catch (err) {
        setError(diagnoseAuthError(err, 'Email/Password').message);
      } finally {
        setLoading(null);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading('email');
    try {
      if (emailMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 60) });
        }
        await sendEmailVerification(cred.user);
        setNotice(
          'Account created! We sent a verification link to your email. Verify it before publishing public or private cloud sketches.'
        );
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onClose();
      }
    } catch (err) {
      setError(diagnoseAuthError(err, 'Email/Password').message);
    } finally {
      setLoading(null);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setLoading('verify');
    setError(null);
    try {
      await sendEmailVerification(user);
      setNotice('Verification email resent! Click the link in your inbox, then click Refresh Status.');
    } catch (err) {
      setError(diagnoseAuthError(err).message);
    } finally {
      setLoading(null);
    }
  };

  const handleRefreshVerification = async () => {
    if (!user) return;
    setLoading('refresh');
    setError(null);
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        onUserRefreshed?.();
        setNotice('Email verified! You can now publish and save private cloud sketches.');
      } else {
        setError('Your email is still unverified. Check your spam folder or resend the verification email.');
      }
    } catch (err) {
      setError(diagnoseAuthError(err).message);
    } finally {
      setLoading(null);
    }
  };

  const handleSignOut = async () => {
    setLoading('signout');
    try {
      await signOut(auth);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-lg border border-stone-300 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5 dark:border-stone-800">
          <div>
            <h2 id="auth-modal-title" className="font-display text-base font-semibold text-stone-900 dark:text-stone-50">
              {user ? 'Your Rs-ESP Account' : 'Sign In to Rs-ESP'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {user
                ? 'Publish code to the Community or save private sketches to your account.'
                : 'Sign in with Google, Apple, or Email to upload, privatize, and share ESP code.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="rounded p-1 text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!user && reasonMessage && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
            >
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <span>{reasonMessage}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1.5">
                <p>{error}</p>
                {showRedirectRetry && !isInIframe && (
                  <button
                    type="button"
                    onClick={() => void handleAppleSignIn(true)}
                    className="inline-flex items-center gap-1 rounded bg-stone-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span>Retry Apple with Redirect</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {appleSetupHelp && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-950 space-y-1.5 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">Apple Sign-In Firebase Setup Checklist:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>
                  In <strong>Firebase Console → Authentication → Sign-in method</strong>, enable <strong>Apple</strong> and add your Apple Developer Services ID, Team ID, Key ID, and Private Key.
                </li>
                <li>
                  In Apple Developer Services ID Return URLs, register:{' '}
                  <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[10px] dark:bg-stone-900">
                    {redirectHandlerUrl}
                  </code>
                </li>
                {currentHost && (
                  <li>
                    In <strong>Authentication → Settings → Authorized domains</strong>, add{' '}
                    <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[10px] dark:bg-stone-900">
                      {currentHost}
                    </code>
                    .
                  </li>
                )}
              </ol>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover border border-stone-300 dark:border-stone-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
                    {(user.displayName || user.email || 'E').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {user.displayName || 'ESP Builder'}
                  </p>
                  <p className="truncate text-xs text-stone-500 dark:text-stone-400">{user.email}</p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    user.emailVerified
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>

              {!user.emailVerified && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-medium">Email verification required before publishing or saving private cloud sketches.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!loading}
                      onClick={handleResendVerification}
                      className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-stone-900 dark:text-amber-200"
                    >
                      {loading === 'verify' ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                    <button
                      type="button"
                      disabled={!!loading}
                      onClick={handleRefreshVerification}
                      className="inline-flex items-center gap-1 rounded bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>{loading === 'refresh' ? 'Checking...' : 'Refresh Status'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {reasonMessage && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                  >
                    <span>Continue to Code Studio</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={!!loading}
                  onClick={handleSignOut}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Social OAuth Providers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!!loading}
                  onClick={handleGoogleSignIn}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:hover:bg-stone-800"
                >
                  {loading === 'google' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  disabled={!!loading}
                  onClick={() => void handleAppleSignIn(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                >
                  {loading === 'apple' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43Zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45Z" />
                    </svg>
                  )}
                  <span>Continue with Apple</span>
                </button>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-stone-200 dark:border-stone-800" />
                <span className="mx-3 shrink text-[11px] uppercase tracking-wider text-stone-400">
                  or with email
                </span>
                <div className="flex-grow border-t border-stone-200 dark:border-stone-800" />
              </div>

              {/* Email / Password Tabs */}
              <div className="flex items-center gap-1 rounded-md border border-stone-200 bg-stone-100 p-0.5 text-xs dark:border-stone-800 dark:bg-stone-950">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signin');
                    setError(null);
                  }}
                  className={`flex-1 rounded-sm py-1.5 font-medium transition-colors ${
                    emailMode === 'signin'
                      ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signup');
                    setError(null);
                  }}
                  className={`flex-1 rounded-sm py-1.5 font-medium transition-colors ${
                    emailMode === 'signup'
                      ? 'bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {emailMode === 'signup' && (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Display Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      maxLength={60}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Maker"
                      className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                  />
                </div>

                {emailMode !== 'reset' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="auth-password" className="text-xs font-medium text-stone-700 dark:text-stone-300">
                        Password
                      </label>
                      {emailMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailMode('reset');
                            setError(null);
                          }}
                          className="text-[11px] text-teal-700 hover:underline dark:text-teal-400"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!!loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  {loading === 'email' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {emailMode === 'signup'
                      ? 'Create Email Account'
                      : emailMode === 'reset'
                        ? 'Send Password Reset Email'
                        : 'Sign In with Email'}
                  </span>
                </button>

                {emailMode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => setEmailMode('signin')}
                    className="w-full text-center text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400"
                  >
                    Back to Sign In
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
