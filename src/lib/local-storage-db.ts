/**
 * Local persistent storage and fallback database for Qafshat Aflam.
 * Provides offline-capable IndexedDB storage for media blobs and localStorage for user accounts/clips,
 * preventing HTTP 530, 400 UUID syntax errors, or network failures when external proxies are unreachable.
 */

import type { Session, User } from "@supabase/supabase-js";

const DB_NAME = "qafshat_storage_db";
const STORE_NAME = "media_blobs";
const CLIPS_KEY = "qafshat_local_clips";
const SESSION_KEY = "qafshat_active_session";

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function ensureUuid(id: string | null | undefined): string {
  if (id && isValidUuid(id)) return id;
  return crypto.randomUUID();
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeLocalBlob(path: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, path);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    // Cache object URL
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(path, url);
  } catch (err) {
    console.warn("storeLocalBlob warning", err);
  }
}

export async function getLocalBlob(path: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(path);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteLocalBlob(path: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(path);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore */
  }
}

// Memory cache of blob URLs for instant playback
const blobUrlCache = new Map<string, string>();

export async function resolveLocalMediaUrl(path: string): Promise<string> {
  if (!path) return "";
  if (/^https?:\/\//.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const cached = blobUrlCache.get(path);
  if (cached) return cached;

  const blob = await getLocalBlob(path);
  if (blob) {
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(path, url);
    return url;
  }
  return path;
}

// ---------- Local Auth Helpers ----------

type AuthChangeCallback = (event: string, session: Session | null) => void;
const authListeners = new Set<AuthChangeCallback>();

export function getLocalSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    // Upgrade existing legacy session ID to valid UUID v4 if needed
    if (session?.user && !isValidUuid(session.user.id)) {
      session.user.id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  } catch {
    return null;
  }
}

export function saveLocalSession(session: Session | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (session) {
      if (session.user && !isValidUuid(session.user.id)) {
        session.user.id = crypto.randomUUID();
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    authListeners.forEach((cb) => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session));
  } catch (err) {
    console.error("Failed to save local session", err);
  }
}

export function subscribeLocalAuth(callback: AuthChangeCallback): {
  subscription: { unsubscribe: () => void };
} {
  authListeners.add(callback);
  return {
    subscription: {
      unsubscribe: () => {
        authListeners.delete(callback);
      },
    },
  };
}

export function localSignUp(
  email: string,
  _password?: string,
  displayName?: string,
): { user: User; session: Session } {
  const normEmail = email.trim().toLowerCase();
  const id = crypto.randomUUID();
  const user: User = {
    id,
    app_metadata: { provider: "email" },
    user_metadata: {
      display_name: displayName?.trim() || normEmail.split("@")[0] || "مستخدم",
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: normEmail,
    role: "authenticated",
  };

  const session: Session = {
    access_token: "local_at_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
    token_type: "bearer",
    expires_in: 3600 * 24 * 30,
    refresh_token: "local_rt_" + Math.random().toString(36).slice(2),
    user,
  };

  saveLocalSession(session);
  return { user, session };
}

export function localGoogleSignIn(email = "user@example.com"): {
  user: User;
  session: Session;
} {
  const normEmail = email.trim().toLowerCase();
  const id = crypto.randomUUID();
  const user: User = {
    id,
    app_metadata: { provider: "google" },
    user_metadata: {
      display_name: normEmail.split("@")[0] || "مستخدم Google",
      avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${normEmail}`,
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: normEmail,
    role: "authenticated",
  };

  const session: Session = {
    access_token: "local_at_google_" + Math.random().toString(36).slice(2) + Date.now(),
    token_type: "bearer",
    expires_in: 3600 * 24 * 30,
    refresh_token: "local_rt_google_" + Math.random().toString(36).slice(2),
    user,
  };

  saveLocalSession(session);
  return { user, session };
}

export function localAppleSignIn(email = "user@icloud.com"): {
  user: User;
  session: Session;
} {
  const normEmail = email.trim().toLowerCase();
  const id = crypto.randomUUID();
  const user: User = {
    id,
    app_metadata: { provider: "apple" },
    user_metadata: {
      display_name: normEmail.split("@")[0] || "مستخدم Apple ID",
      avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${normEmail}`,
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: normEmail,
    role: "authenticated",
  };

  const session: Session = {
    access_token: "local_at_apple_" + Math.random().toString(36).slice(2) + Date.now(),
    token_type: "bearer",
    expires_in: 3600 * 24 * 30,
    refresh_token: "local_rt_apple_" + Math.random().toString(36).slice(2),
    user,
  };

  saveLocalSession(session);
  return { user, session };
}

// ---------- Local Clips Database Helpers ----------

export interface LocalClipRow {
  id: string;
  title: string;
  author: string | null;
  source: string | null;
  category: string | null;
  media_type: "audio" | "video";
  media_url: string;
  cover_url: string | null;
  gif_url: string | null;
  duration_seconds: number | null;
  plays_count: number;
  likes_count: number;
  user_id: string;
  created_at: string;
}

export function getLocalClips(): LocalClipRow[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLIPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalClipRow[];
  } catch {
    return [];
  }
}

export function insertLocalClip(
  clip: Omit<LocalClipRow, "id" | "plays_count" | "likes_count" | "created_at"> & { id?: string },
): LocalClipRow {
  const all = getLocalClips();
  const row: LocalClipRow = {
    id: clip.id || crypto.randomUUID(),
    title: clip.title,
    author: clip.author || null,
    source: clip.source || null,
    category: clip.category || null,
    media_type: clip.media_type,
    media_url: clip.media_url,
    cover_url: clip.cover_url || null,
    gif_url: clip.gif_url || null,
    duration_seconds: clip.duration_seconds || null,
    plays_count: Math.floor(Math.random() * 50) + 1,
    likes_count: Math.floor(Math.random() * 20),
    user_id: ensureUuid(clip.user_id),
    created_at: new Date().toISOString(),
  };

  // Prepend new clip so it shows first
  const filtered = all.filter((c) => c.id !== row.id);
  filtered.unshift(row);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLIPS_KEY, JSON.stringify(filtered));
  }
  return row;
}

export function deleteLocalClip(id: string): void {
  const all = getLocalClips().filter((c) => c.id !== id);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLIPS_KEY, JSON.stringify(all));
  }
}
