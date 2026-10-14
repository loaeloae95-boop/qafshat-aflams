import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClipGrid } from "@/components/ClipGrid";
import { ALL, CLIP_CATEGORIES, filterClips, useClips } from "@/lib/clips";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "قفشات أفلام — شارك أشهر المقاطع" },
      { name: "description", content: "ابحث وشارك أشهر قفشات الأفلام والمسرحيات صوتاً وصورة." },
      { property: "og:title", content: "قفشات أفلام" },
      { property: "og:description", content: "ابحث وشارك أشهر قفشات الأفلام والمسرحيات صوتاً وصورة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: all = [], isLoading } = useClips();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(ALL);

  const tabs = useMemo(() => {
    const extra = all.map((c) => c.category).filter((c): c is string => !!c && !(CLIP_CATEGORIES as readonly string[]).includes(c));
    return [ALL, ...CLIP_CATEGORIES, ...Array.from(new Set(extra))];
  }, [all]);
  const filtered = useMemo(() => filterClips(all, query, active), [all, query, active]);

  return (
    <AppShell>
      <header className="text-center">
        <h1 className="font-display text-2xl font-extrabold">قفشات أفلام</h1>
        <p className="text-xs text-muted-foreground">شارك الضحكة</p>
      </header>
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن قفشة، ممثل، أو فيلم..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition",
              active === c ? "gradient-violet shadow-glow" : "bg-surface text-muted-foreground ring-1 ring-border",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <ClipGrid clips={filtered} />
      </div>
      {!isLoading && filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">لا توجد قفشات هنا بعد — ارفع أول قفشة من تبويب «رفع»</p>
      )}
    </AppShell>
  );
}
