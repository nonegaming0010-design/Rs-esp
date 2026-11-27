import type { User } from 'firebase/auth';

export const BOOTSTRAP_ADMIN_EMAIL = 'nonegaming0010@gmail.com';

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}

export function isVerifiedAdminUser(user: User | null | undefined, hasAdminDoc = false): boolean {
  if (!user || !user.emailVerified) return false;
  return isBootstrapAdminEmail(user.email) || hasAdminDoc;
}

export interface SiteConfig {
  announcementEnabled: boolean;
  announcementText: string;
  allowNewPublicSketches: boolean;
  updatedBy: string;
  updatedAtMs: number;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  announcementEnabled: false,
  announcementText: '',
  allowNewPublicSketches: true,
  updatedBy: '',
  updatedAtMs: 0,
};

export interface AdminRecord {
  uid: string;
  email: string;
  displayName: string;
  addedBy: string;
  createdAtMs: number;
}

export function sanitizeSiteConfigInput(input: {
  announcementEnabled: boolean;
  announcementText: string;
  allowNewPublicSketches: boolean;
}): {
  announcementEnabled: boolean;
  announcementText: string;
  allowNewPublicSketches: boolean;
} {
  return {
    announcementEnabled: Boolean(input.announcementEnabled),
    announcementText: input.announcementText.trim().slice(0, 280),
    allowNewPublicSketches: Boolean(input.allowNewPublicSketches),
  };
}
