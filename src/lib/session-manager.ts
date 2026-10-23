import { supabase } from "@/integrations/supabase/client";
import { saveLocalSession } from "./local-storage-db";

const DEVICE_ID_KEY = "qafsha_device_id";
const SESSION_DEVICE_KEY = "qafsha_session_device";
const SESSION_LAST_ACTIVE_KEY = "qafsha_session_last_active";

// Default inactivity timeout: 7 days in milliseconds (configurable)
export const DEFAULT_SESSION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 1. Device Identification
 * Generates and stores a unique persistent ID for this specific physical browser instance.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${crypto.randomUUID()}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "ephemeral_device";
  }
}

/**
 * Generates a lightweight device fingerprint based on local client characteristics.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const userAgent = navigator.userAgent;
  const screenRes = `${window.screen.width}x${window.screen.height}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${userAgent}|${screenRes}|${tz}`;
}

/**
 * Binds the current active session to this physical device.
 */
export function bindSessionToDevice(): void {
  if (typeof window === "undefined") return;
  try {
    const deviceId = getOrCreateDeviceId();
    const fingerprint = getDeviceFingerprint();
    const payload = {
      deviceId,
      fingerprint,
      boundAt: Date.now(),
    };
    localStorage.setItem(SESSION_DEVICE_KEY, JSON.stringify(payload));
    updateSessionActivity();
  } catch (err) {
    console.warn("Failed to bind session to device", err);
  }
}

/**
 * Verifies if the session stored in localStorage belongs to this current physical device.
 * Prevents account takeover when browser sync / cloud backup copies localStorage to another device.
 */
export function verifyDeviceSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(SESSION_DEVICE_KEY);
    if (!raw) return true; // first-time session
    const parsed = JSON.parse(raw);
    const currentDeviceId = getOrCreateDeviceId();
    return parsed.deviceId === currentDeviceId;
  } catch {
    return true;
  }
}

/**
 * 3. Session Timeout & Inactivity Tracking
 */
export function updateSessionActivity(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // ignore storage write errors
  }
}

export function isSessionExpired(timeoutMs = DEFAULT_SESSION_TIMEOUT_MS): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_LAST_ACTIVE_KEY);
    if (!raw) return false;
    const lastActive = Number(raw);
    if (isNaN(lastActive)) return false;
    return Date.now() - lastActive > timeoutMs;
  } catch {
    return false;
  }
}

/**
 * 2. Secure Logout
 * Destroys session locally or globally across devices, clears storage, cookies, and tokens.
 *
 * @param options.global - If true, revokes the refresh token globally in Supabase (logs out all devices).
 *                        If false (default), only terminates the session on THIS device.
 */
export async function performSecureLogout(options: { global?: boolean } = {}): Promise<void> {
  const isGlobal = options.global ?? false;

  // 1. Supabase Auth sign out
  try {
    await supabase.auth.signOut({
      scope: isGlobal ? "global" : "local",
    });
  } catch (err) {
    console.warn("Supabase signOut error", err);
  }

  // 2. Clear local storage session
  try {
    saveLocalSession(null);
    localStorage.removeItem(SESSION_DEVICE_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVE_KEY);

    // Remove any leftover supabase auth keys
    Object.keys(localStorage).forEach((key) => {
      if (key.includes("supabase.auth.token") || key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn("localStorage cleanup error", err);
  }

  // 3. Clear sessionStorage
  try {
    sessionStorage.clear();
  } catch {
    // ignore sessionStorage clearance errors
  }

  // 4. Clear any auth cookies
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.includes("auth") || name.includes("token") || name.includes("session")) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    }
  }

  // 5. Trigger custom event for immediate UI response
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-session-terminated"));
  }
}
