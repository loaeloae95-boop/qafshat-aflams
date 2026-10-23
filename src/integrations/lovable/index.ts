import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google", opts?: SignInOptions) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo:
              opts?.redirect_uri ||
              (typeof window !== "undefined" ? window.location.origin : undefined),
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
              ...opts?.extraParams,
            },
          },
        });
        if (data?.url && typeof window !== "undefined") {
          window.location.href = data.url;
        }
        return { redirected: Boolean(data?.url), error };
      } catch (err) {
        return {
          redirected: false,
          error: err instanceof Error ? err : new Error("OAuth failed"),
        };
      }
    },
  },
};
