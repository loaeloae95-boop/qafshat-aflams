import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getLocalSession, subscribeLocalAuth } from "@/lib/local-storage-db";
import {
  bindSessionToDevice,
  isSessionExpired,
  performSecureLogout,
  updateSessionActivity,
  verifyDeviceSession,
} from "@/lib/session-manager";

export function useSession() {
  const [session, setSession] = useState<Session | null>(() => {
    if (!verifyDeviceSession() || isSessionExpired()) {
      return null;
    }
    return getLocalSession();
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verify device binding and timeout on startup
    if (!verifyDeviceSession() || isSessionExpired()) {
      void performSecureLogout();
      setSession(null);
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const active = data?.session ?? getLocalSession();
        if (active) {
          bindSessionToDevice();
          updateSessionActivity();
        }
        setSession(active);
        setLoading(false);
      })
      .catch(() => {
        const local = getLocalSession();
        setSession(local);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const active = s ?? getLocalSession();
      if (active) {
        bindSessionToDevice();
        updateSessionActivity();
      }
      setSession(active);
    });

    const localSub = subscribeLocalAuth((_e, s) => {
      if (s) {
        bindSessionToDevice();
        updateSessionActivity();
      }
      setSession(s);
    });

    // 2. Track user activity to refresh timeout
    let lastActivity = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 60_000) {
        // throttle every 1 minute
        lastActivity = now;
        updateSessionActivity();
      }
    };

    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });

    const handleTerminated = () => setSession(null);
    window.addEventListener("auth-session-terminated", handleTerminated);

    return () => {
      sub?.subscription?.unsubscribe();
      localSub.subscription.unsubscribe();
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("auth-session-terminated", handleTerminated);
    };
  }, []);

  const signOut = async (options?: { global?: boolean }) => {
    setLoading(true);
    await performSecureLogout(options);
    setSession(null);
    setLoading(false);
  };

  return {
    session,
    user: session?.user ?? null,
    loading,
    signOut,
  };
}
