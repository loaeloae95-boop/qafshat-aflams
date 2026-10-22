import { supabase } from "../supabase/client";
import { localGoogleSignIn } from "@/lib/local-storage-db";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: string, _opts?: SignInOptions) => {
      if (provider === "google") {
        const { session } = localGoogleSignIn();
        try {
          await supabase.auth.setSession(session);
        } catch (err) {
          console.warn("setSession error:", err);
        }
        return { redirected: false, error: null };
      }
      return { redirected: false, error: new Error("Unsupported provider") };
    },
  },
};
