/**
 * Guest Mode Management Helper
 * Manages guest mode state across client-side sessionStorage and browser cookies
 * for seamless integration with Next.js SSR middleware.
 */

const GUEST_COOKIE_NAME = "chess_guest_mode";
const GUEST_SESSION_COOKIE_NAME = "chess_guest_session_id";
const GUEST_STORAGE_KEY = "chess_guest_session_id";
const GUEST_CREATED_KEY = "chess_guest_created_at";
const GUEST_COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined" || !document.cookie) return null;
  const cookies = document.cookie.split(";");
  for (const raw of cookies) {
    const eqIdx = raw.indexOf("=");
    const key = (eqIdx > -1 ? raw.slice(0, eqIdx) : raw).trim();
    if (key === name) {
      const val = eqIdx > -1 ? raw.slice(eqIdx + 1).trim() : "";
      if (!val) return null;
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

function removeCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  if (typeof window !== "undefined" && window.location?.hostname) {
    document.cookie = `${name}=; path=/; domain=${window.location.hostname}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

/**
 * Returns the current guest session ID from sessionStorage, falling back to
 * the browser cookie (e.g. when opening an email confirmation or OAuth callback in a new tab).
 */
export function getGuestSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(GUEST_STORAGE_KEY);
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch {}

  const cookieGuestId = getCookieValue(GUEST_SESSION_COOKIE_NAME);
  if (cookieGuestId && cookieGuestId.trim()) {
    return cookieGuestId.trim();
  }

  return null;
}

/**
 * Initializes and activates a new or refreshed Guest Mode session.
 * Sets both sessionStorage (for API client & workspace store) and cookies (for Next.js middleware).
 */
export function enterGuestMode(): string {
  if (typeof window === "undefined") return "";

  try {
    localStorage.removeItem("chess_ai_conversations_v4");
  } catch {}

  const freshGuestId =
    "guest_" +
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36));

  try {
    sessionStorage.setItem(GUEST_STORAGE_KEY, freshGuestId);
    sessionStorage.setItem(GUEST_CREATED_KEY, new Date().toISOString());
    delete (window as any).__CHESSLOOK_WORKSPACE_SNAPSHOT__;
  } catch (e) {
    console.warn("Could not write to sessionStorage:", e);
  }

  // Set cookies for Next.js middleware
  setCookie(GUEST_COOKIE_NAME, "true", GUEST_COOKIE_MAX_AGE);
  setCookie(GUEST_SESSION_COOKIE_NAME, freshGuestId, GUEST_COOKIE_MAX_AGE);

  return freshGuestId;
}

/**
 * Clears guest mode session and cookies thoroughly (used during login, account claiming, or logout).
 */
export function exitGuestMode(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(GUEST_STORAGE_KEY);
    sessionStorage.removeItem(GUEST_CREATED_KEY);
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("chess_guest_")) {
        sessionStorage.removeItem(key);
      }
    }
    delete (window as any).__CHESSLOOK_WORKSPACE_SNAPSHOT__;
  } catch {}

  removeCookie(GUEST_COOKIE_NAME);
  removeCookie(GUEST_SESSION_COOKIE_NAME);
}

/**
 * Checks if the current client is in an active guest session.
 */
export function isGuestModeActive(): boolean {
  if (typeof window === "undefined") return false;

  if (getGuestSessionId()) {
    return true;
  }

  return getCookieValue(GUEST_COOKIE_NAME) === "true";
}
