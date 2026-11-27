import type { User } from 'firebase/auth';
import { LogIn, Shield, Usb } from 'lucide-react';

export type AppSection = 'studio' | 'preview3d' | 'projects' | 'community' | 'pinouts' | 'serial' | 'admin';

interface TopNavProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  connectionMode: 'disconnected' | 'usb' | 'virtual';
  onConnectClick: () => void;
  user: User | null;
  onAuthClick: () => void;
  isAdmin?: boolean;
  isPhoneView?: boolean;
}

const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
  { id: 'studio', label: 'Code Studio' },
  { id: 'preview3d', label: '3D Preview' },
  { id: 'projects', label: '120+ Projects' },
  { id: 'community', label: 'Community' },
  { id: 'pinouts', label: 'Pinouts' },
  { id: 'serial', label: 'Upload & Serial' },
];

export function TopNav({
  activeSection,
  onNavigate,
  connectionMode,
  onConnectClick,
  user,
  onAuthClick,
  isAdmin = false,
  isPhoneView = false,
}: TopNavProps) {
  const ctaLabel =
    connectionMode === 'usb'
      ? isPhoneView
        ? 'USB On'
        : 'USB Connected'
      : connectionMode === 'virtual'
        ? isPhoneView
          ? 'Virtual'
          : 'Virtual ESP'
        : isPhoneView
          ? 'Connect'
          : 'Connect Board';

  const accountLabel = user
    ? (user.displayName || user.email?.split('@')[0] || 'Account').slice(0, isPhoneView ? 12 : 18)
    : 'Sign In';

  const items = isAdmin ? [...NAV_ITEMS, { id: 'admin' as const, label: 'Admin' }] : NAV_ITEMS;

  const renderNavButtons = () =>
    items.map((item) => {
      const active = activeSection === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          aria-current={active ? 'page' : undefined}
          className={`relative inline-flex items-center gap-1 px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 rounded ${
            active
              ? 'text-teal-800 dark:text-teal-400'
              : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
          }`}
        >
          {item.id === 'admin' && <Shield className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{item.label}</span>
          {active && (
            <span
              aria-hidden="true"
              className="absolute inset-x-2 bottom-0 h-0.5 bg-teal-700 dark:bg-teal-400"
            />
          )}
        </button>
      );
    });

  return (
    <header className="sticky top-0 z-30 border-b border-stone-300 bg-white dark:border-stone-800 dark:bg-stone-950">
      <div
        className={`mx-auto flex max-w-[1440px] items-center justify-between ${
          isPhoneView ? 'h-12 gap-2 px-3' : 'h-12 md:h-14 gap-4 md:gap-8 px-4 sm:px-6'
        }`}
      >
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('studio');
          }}
          className={`font-display font-bold tracking-tight text-stone-900 dark:text-stone-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 rounded ${
            isPhoneView ? 'text-lg' : 'text-xl'
          }`}
        >
          Rs-ESP
        </a>

        <nav
          aria-label="Main navigation"
          className={isPhoneView ? 'hidden' : 'hidden md:flex items-center gap-5'}
        >
          {renderNavButtons()}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onAuthClick}
            className={`inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800 ${
              isPhoneView ? 'px-2.5 py-1.5' : 'px-3 py-1.5 md:py-2'
            }`}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{accountLabel}</span>
          </button>

          <button
            type="button"
            onClick={onConnectClick}
            className={`inline-flex items-center gap-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              isPhoneView ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5 md:py-2'
            } ${
              connectionMode === 'usb'
                ? 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500'
                : connectionMode === 'virtual'
                  ? 'bg-stone-800 text-white hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600'
                  : 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500'
            }`}
          >
            <Usb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{ctaLabel}</span>
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className={`items-center gap-2 overflow-x-auto border-t border-stone-200 px-3 h-10 dark:border-stone-800 ${
          isPhoneView ? 'flex' : 'flex md:hidden'
        }`}
      >
        {renderNavButtons()}
      </nav>
    </header>
  );
}
