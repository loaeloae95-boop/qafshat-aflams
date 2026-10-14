import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { ClipGrid } from "@/components/ClipGrid";
import { useClips } from "@/lib/clips";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "الرائج — قفشات أفلام" },
      { name: "description", content: "أكثر القفشات تشغيلاً وإعجاباً الآن." },
      { property: "og:title", content: "الرائج — قفشات أفلام" },
      { property: "og:description", content: "أكثر القفشات تشغيلاً وإعجاباً الآن." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Trending,
});

function Trending() {
  const { data = [] } = useClips();
  const sorted = useMemo(() => [...data].sort((a, b) => b.plays + b.likes - (a.plays + a.likes)), [data]);
  return (
    <AppShell>
      <h1 className="mb-5 font-display text-2xl font-extrabold">🔥 الرائج</h1>
      <ClipGrid clips={sorted} />
    </AppShell>
  );
}
