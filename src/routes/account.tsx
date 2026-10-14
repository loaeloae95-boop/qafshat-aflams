import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
  const { user, loading } = useSession();
  const navigate = useNavigate();
  return (
    <AppShell>
      <h1 className="mb-5 font-display text-2xl font-extrabold">حسابي</h1>
      {!loading && !user && <SignInPrompt text="أنشئ حساباً لرفع قفشاتك ومشاركتها" />}
      {user && (
        <div className="glass-panel space-y-4 rounded-3xl p-5">
          <div>
            <p className="text-xs text-muted-foreground">البريد</p>
            <p className="text-sm font-bold" dir="ltr">{user.email}</p>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="w-full rounded-2xl bg-secondary py-3 text-sm font-bold"
          >
            تسجيل الخروج
          </button>
        </div>
      )}
      <div className="glass-panel mt-4 rounded-3xl p-5 text-sm text-muted-foreground">
        <p className="font-bold text-foreground">📱 ثبّت التطبيق على هاتفك</p>
        <p className="mt-1">من متصفح الهاتف اختر «إضافة إلى الشاشة الرئيسية» ليظهر قفشات أفلام كأيقونة تطبيق.</p>
      </div>
    </AppShell>
  );
}
