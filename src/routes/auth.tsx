import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { localGoogleSignIn, localAppleSignIn } from "@/lib/local-storage-db";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — قفشات أفلام" },
      {
        name: "description",
        content: "سجّل الدخول لرفع ومشاركة القفشات.",
      },
      { property: "og:title", content: "تسجيل الدخول — قفشات أفلام" },
      {
        property: "og:description",
        content: "سجّل الدخول لرفع ومشاركة القفشات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function isSupabaseConfigured(): boolean {
  const url = import.meta.env["VITE_SUPABASE_URL"] || "";
  return Boolean(url && !url.includes("placeholder-project.supabase.co"));
}

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isAppleDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isAppleDevice);
  }, []);

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) {
        localGoogleSignIn("google.device.user@gmail.com");
        toast.success("تم تسجيل الدخول بحساب Google بنجاح 🎉");
        await navigate({ to: "/" });
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الدخول عبر Google");
    } finally {
      setBusy(false);
    }
  };

  const signInWithApple = async () => {
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) {
        localAppleSignIn("apple.device.user@icloud.com");
        toast.success("تم تسجيل الدخول بحساب Apple بنجاح 🎉");
        await navigate({ to: "/" });
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الدخول عبر Apple");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح 🎉");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح 🎉");
      }
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  };

  const googleButton = (
    <button
      key="google-btn"
      type="button"
      disabled={busy}
      onClick={signInWithGoogle}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-bold transition hover:bg-secondary/80 active:scale-98 disabled:opacity-50"
    >
      <GoogleIcon className="size-4 shrink-0" />
      <span>المتابعة باستخدام Google</span>
    </button>
  );

  const appleButton = (
    <button
      key="apple-btn"
      type="button"
      disabled={busy}
      onClick={signInWithApple}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-bold transition hover:bg-secondary/80 active:scale-98 disabled:opacity-50"
    >
      <AppleIcon className="size-4 shrink-0 fill-current" />
      <span>المتابعة باستخدام Apple</span>
    </button>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-extrabold">
          {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>

        <form onSubmit={submit} className="glass-panel mt-5 space-y-3 rounded-3xl p-5">
          {mode === "signup" && (
            <input
              className="field"
              placeholder="الاسم الظاهر"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="field"
            type="email"
            dir="ltr"
            placeholder="البريد الإلكتروني"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            dir="ltr"
            placeholder="كلمة المرور (6 أحرف على الأقل)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "..." : mode === "signin" ? "دخول" : "إنشاء الحساب"}
          </button>

          <div className="relative my-2 py-1 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-background/50 px-2">أو</span>
            <div className="absolute inset-0 top-1/2 h-px -translate-y-1/2 bg-border/60" />
          </div>

          {/* Show native preferred button first based on device */}
          {isIOS ? (
            <>
              {appleButton}
              {googleButton}
            </>
          ) : (
            <>
              {googleButton}
              {appleButton}
            </>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full pt-1 text-center text-xs text-muted-foreground transition hover:text-foreground"
          >
            {mode === "signin" ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل الدخول"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 170" fill="currentColor">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.7-7.93-12.01-14.54-6.3-9.69-11.23-20.91-14.79-33.65-3.56-12.75-5.34-24.81-5.34-36.21 0-14.49 3.56-26.63 10.68-36.42 7.12-9.79 16.29-14.79 27.52-15 4.36 0 9.24 1.15 14.65 3.46 5.4 2.31 9.38 3.52 11.93 3.63 2.18-.11 6.37-1.37 12.56-3.78 6.19-2.41 11.29-3.46 15.3-3.15 11.64.91 20.89 5.34 27.75 13.29-10.45 6.35-15.6 15.11-15.46 26.27.15 8.78 3.47 16.14 9.96 22.09 6.49 5.95 14.33 9.4 23.53 10.35-2.07 6.49-4.59 13.14-7.56 19.98l-1.92 4.31zM119.22 33.36c-.11 4.13-1.63 8.35-4.57 12.65-2.94 4.31-6.83 7.74-11.67 10.31-.77-3.92-.37-8.11 1.2-12.58 1.57-4.47 4.14-8.56 7.72-12.28 3.49-3.69 7.37-6.2 11.64-7.52.41 3.14.74 6.27.99 9.42h-5.31z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
