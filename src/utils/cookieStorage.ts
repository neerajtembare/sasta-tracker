/**
 * Persistent LocalStorage Identity Utility
 * Stores rider profile & crew identity locally without bloating HTTP Cookie headers.
 */

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function setPersistentCookie(_name: string, _value: string, _days = 365): void {
  // Deprecated: profile and friends JSON must not be sent in HTTP Cookie headers.
}

export function getPersistentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const escapedName = escapeRegExp(encodeURIComponent(name));
    const match = document.cookie.match(new RegExp('(?:^|; )' + escapedName + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function removePersistentCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch {}
}

/**
 * Reads identity data from LocalStorage, migrating and removing any legacy Cookie copy once.
 */
export function getSavedIdentity(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const localVal = localStorage.getItem(key);
      if (localVal !== null) {
        if (getPersistentCookie(key) !== null) {
          removePersistentCookie(key);
        }
        return localVal;
      }
    }
  } catch {}

  const legacyCookie = getPersistentCookie(key);
  if (legacyCookie !== null) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, legacyCookie);
      }
    } catch {}
    removePersistentCookie(key);
    return legacyCookie;
  }

  return null;
}

/**
 * Persists identity data solely in LocalStorage and removes any stale Cookie copy.
 */
export function saveIdentity(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
  removePersistentCookie(key);
}
