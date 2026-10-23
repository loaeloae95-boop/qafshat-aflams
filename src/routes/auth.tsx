import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Smartphone, ShieldCheck, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { localGoogleSignIn, localAppleSignIn } from "@/lib/local-storage-db";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — قفشات أفلام" },
      {
        name: "description",
        content: "سجّل الدخول بحساب جهازك أو بريدك الإلكتروني لرفع ومشاركة القفشات.",
      },
      { property: "og:title", content: "تسجيل الدخول — قفشات أفلام" },
      {
        property: "og:description",
        content: "سجّل الدخول بحساب جهازك أو بريدك الإلكتروني لرفع ومشاركة القفشات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type DevicePlatform = "ios" | "android" | "other";

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
  const [platform, setPlatform] = useState<DevicePlatform>("other");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);

    if (isIOS) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
    else setPlatform("other");
  }, []);

  const handleDeviceNativeSignIn = async () => {
    if (platform === "ios") {
      await signInWithApple();
    } else {
      await signInWithGoogle();
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) {
        // Fallback for preview / demo environment
        localGoogleSignIn("google.device.user@gmail.com");
        toast.success("تم الدخول بحساب Google المحفوظ بالجهاز (تجريبي) 🎉");
        await navigate({ to: "/" });
        return;
      }

      // Real Supabase Google OAuth with prompt: 'select_account'
      // This forces Chrome / Android to display the native account selector with device accounts
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
      toast.error(err instanceof Error ? err.message : "تعذر تسجيل الدخول عبر Google");
    } finally {
      setBusy(false);
    }
  };

  const signInWithApple = async () => {
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) {
        // Fallback for preview / demo environment
        localAppleSignIn("apple.device.user@icloud.com");
        toast.success("تم الدخول بحساب Apple ID / الآب ستور (تجريبي) 🎉");
        await navigate({ to: "/" });
        return;
      }

      // Real Supabase Apple OAuth (Sign in with Apple)
      // On iOS devices, this triggers the native Face ID / Touch ID system sheet
      // linked to the App Store and iCloud account saved on the iPhone.
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
      toast.error(err instanceof Error ? err.message : "تعذر تسجيل الدخول عبر Apple");
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

  const isIOS = platform === "ios";
  const isAndroid = platform === "android";

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Smartphone className="size-6" />
          </div>
          <h1 className="font-display text-2xl font-extrabold">
            {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            سجّل دخولك بضغطة واحدة باستخدام الحساب المحفوظ على جهازك
          </p>
        </div>

        {/* 1. Quick Native Device Sign-In Section */}
        <div className="glass-panel rounded-3xl p-5 mb-5 space-y-3 border border-primary/20 shadow-lg shadow-primary/5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="size-4 text-amber-400" />
              <span>تسجيل الدخول السريع بحساب الجهاز</span>
            </div>
            {isIOS && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                جهاز آيفون 
              </span>
            )}
            {isAndroid && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                جهاز أندرويد 🤖
              </span>
            )}
          </div>

          {/* Smart 1-Click Master Button for Detected Device */}
          <button
            type="button"
            disabled={busy}
            onClick={handleDeviceNativeSignIn}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary to-amber-500 py-3.5 px-4 text-sm font-extrabold text-primary-foreground shadow-md transition hover:brightness-110 active:scale-98 disabled:opacity-50"
          >
            {isIOS ? (
              <>
                <AppleIcon className="size-5 fill-current" />
                <span>الدخول الفوري بحساب الآب ستور (Apple ID)</span>
              </>
            ) : isAndroid ? (
              <>
                <GoogleIcon className="size-5" />
                <span>الدخول الفوري بحساب جوجل ستور (Gmail)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="size-5" />
                <span>المتابعة بحسابك المحفوظ (Google / Apple)</span>
              </>
            )}
          </button>

          {/* Secondary Individual Buttons */}
          <div className="pt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Apple Button */}
            <button
              type="button"
              disabled={busy}
              onClick={signInWithApple}
              className={`flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/60 hover:bg-black/80 py-2.5 px-3 text-xs font-bold text-white transition active:scale-98 disabled:opacity-50 ${
                isIOS ? "ring-1 ring-white/40" : ""
              }`}
            >
              <AppleIcon className="size-4 fill-white" />
              <span>حساب Apple {isIOS ? "(الآب ستور)" : ""}</span>
            </button>

            {/* Google Button */}
            <button
              type="button"
              disabled={busy}
              onClick={signInWithGoogle}
              className={`flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-surface/80 hover:bg-surface py-2.5 px-3 text-xs font-bold text-foreground transition active:scale-98 disabled:opacity-50 ${
                isAndroid ? "ring-1 ring-primary/40" : ""
              }`}
            >
              <GoogleIcon className="size-4" />
              <span>حساب Google {isAndroid ? "(Play Store)" : ""}</span>
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground/80 text-center leading-relaxed pt-1">
            {isIOS
              ? "يتم استخدام حساب Apple ID (الآب ستور) المسجّل في آيفون مع ميزة Face ID بدون كتابة كلمة سر."
              : isAndroid
                ? "يتم فتح قائمة حسابات Google المسجلة في جهازك (جوجل ستور) لتسجيل الدخول بلمسة واحدة."
                : "يمكنك تسجيل الدخول مباشرة بحساب Google أو Apple المحفوظ على متصفحك أو جهازك."}
          </p>
        </div>

        {/* 2. Traditional Email & Password Form */}
        <div className="glass-panel rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Mail className="size-3.5" />
            <span>أو التسجيل عبر البريد الإلكتروني</span>
          </div>

          <form onSubmit={submit} className="space-y-3">
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
              placeholder="البريد الإلكتروني (مثال: name@example.com)"
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
              className="w-full rounded-2xl bg-secondary py-3 text-sm font-bold hover:bg-secondary/80 transition active:scale-98 disabled:opacity-50"
            >
              {busy ? "جارٍ المعالجة..." : mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1 transition"
          >
            {mode === "signin"
              ? "ليس لديك حساب؟ أنشئ حساباً جديداً"
              : "لديك حساب بالفعل؟ سجّل الدخول"}
          </button>
        </div>
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
