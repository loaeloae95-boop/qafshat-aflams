import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useSession } from "@/hooks/use-auth";
import { getOrCreateDeviceId } from "@/lib/session-manager";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي — قفشات أفلام" },
      { name: "description", content: "إدارة حسابك في قفشات أفلام." },
      { property: "og:title", content: "حسابي — قفشات أفلام" },
      { property: "og:description", content: "إدارة حسابك في قفشات أفلام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Account() {
  const { user, loading, signOut } = useSession();
  const navigate = useNavigate();
  const deviceId = typeof window !== "undefined" ? getOrCreateDeviceId() : "";

  const handleLogout = async (global = false) => {
    try {
      await signOut({ global });
      toast.success(
        global ? "تم تسجيل الخروج من كافة الأجهزة بنجاح" : "تم تسجيل الخروج من هذا الجهاز بنجاح",
      );
      navigate({ to: "/" });
    } catch {
      toast.error("حدث خطأ أثناء تسجيل الخروج");
    }
  };

  return (
    <AppShell>
      <h1 className="mb-5 font-display text-2xl font-extrabold">حسابي والأمان</h1>
      {!loading && !user && <SignInPrompt text="أنشئ حساباً لرفع قفشاتك ومشاركتها" />}
      {user && (
        <div className="space-y-4">
          <div className="glass-panel space-y-4 rounded-3xl p-5">
            <div>
              <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
              <p className="text-sm font-bold" dir="ltr">
                {user.email}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-surface/60 p-3 text-xs">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground">الجلسة مرتبطة بهذا الجهاز فقط</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
                  معرّف الجهاز: {deviceId.slice(0, 18)}...
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleLogout(false)}
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-secondary hover:bg-secondary/80 py-3 text-sm font-bold transition active:scale-98"
              >
                <LogOut className="size-4" />
                تسجيل الخروج من هذا الجهاز فقط
              </button>

              <button
                type="button"
                onClick={() => void handleLogout(true)}
                className="flex items-center justify-center gap-2 w-full rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 py-2.5 text-xs font-bold transition active:scale-98"
              >
                <Smartphone className="size-4" />
                تسجيل الخروج وإنهاء الجلسة في جميع الأجهزة
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="glass-panel mt-4 rounded-3xl p-5 text-sm text-muted-foreground">
        <p className="font-bold text-foreground">📱 ثبّت التطبيق على هاتفك</p>
        <p className="mt-1">
          من متصفح الهاتف اختر «إضافة إلى الشاشة الرئيسية» ليظهر قفشات أفلام كأيقونة تطبيق.
        </p>
      </div>
    </AppShell>
  );
}
