import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ClipGrid } from "@/components/ClipGrid";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useSession } from "@/hooks/use-auth";
import { useClips, useDeleteClip } from "@/lib/clips";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "مكتبتي — قفشات أفلام" },
      { name: "description", content: "القفشات التي رفعتها." },
      { property: "og:title", content: "مكتبتي — قفشات أفلام" },
      { property: "og:description", content: "القفشات التي رفعتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

function Library() {
  const { user, loading } = useSession();
  const { data = [] } = useClips();
  const del = useDeleteClip();
  const mine = data.filter((c) => c.userId === user?.id);
  return (
    <AppShell>
      <h1 className="mb-5 font-display text-2xl font-extrabold">مكتبتي</h1>
      {!loading && !user ? (
        <SignInPrompt text="سجّل الدخول لرؤية قفشاتك" />
      ) : (
        <>
          <ClipGrid clips={mine} onDelete={(c) => confirm("حذف هذه القفشة؟") && del.mutate(c.id)} />
          {mine.length === 0 && <p className="mt-10 text-center text-sm text-muted-foreground">لم ترفع أي قفشة بعد</p>}
        </>
      )}
    </AppShell>
  );
}
