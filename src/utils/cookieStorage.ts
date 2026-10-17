/**
 * Persistent Cookie & LocalStorage Dual-Storage Utility
 * Ensures rider profile & crew identity persist across phone restarts,
 * browser cleans, and PWA installs on iOS and Android.
 */

export function setPersistentCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn('Cookie write failed:', e);
  }
}

export function getPersistentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)'));
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
 * Dual Read: Checks Cookie first (survives site data resets in some browsers),
 * then falls back to LocalStorage.
 */
export function getSavedIdentity(key: string): string | null {
  // 1. Try Cookie
  const cookieVal = getPersistentCookie(key);
  if (cookieVal) return cookieVal;

  // 2. Fallback to LocalStorage
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}

  return null;
}

/**
 * Dual Write: Writes to both Persistent Cookie and LocalStorage simultaneously.
 */
export function saveIdentity(key: string, value: string): void {
  setPersistentCookie(key, value, 365);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
}
