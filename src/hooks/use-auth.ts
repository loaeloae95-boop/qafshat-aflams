import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getLocalSession, subscribeLocalAuth } from "@/lib/local-storage-db";

export function useSession() {
  const [session, setSession] = useState<Session | null>(() => getLocalSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const active = data?.session ?? getLocalSession();
        setSession(active);
        setLoading(false);
      })
      .catch(() => {
        setSession(getLocalSession());
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? getLocalSession());
    });

    const localSub = subscribeLocalAuth((_e, s) => {
      setSession(s);
    });

    return () => {
      sub?.subscription?.unsubscribe();
      localSub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
