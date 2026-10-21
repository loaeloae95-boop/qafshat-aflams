import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { searchGifs, type GifResult } from "@/lib/ai-clip.functions";
import { cn } from "@/lib/utils";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function GifPicker({
  open,
  onOpenChange,
  initialKeywords,
  selected,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialKeywords: string[];
  selected: string;
  onSelect: (url: string) => void;
}) {
  const find = useServerFn(searchGifs);
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const run = async (keywords: string[]) => {
    const kw = keywords
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (!kw.length) return;
    setBusy(true);
    setNote("");
    try {
      const r = await find({ data: { keywords: kw } });
      setGifs(r.gifs);
      if (r.missingKey) setNote("مفتاح Giphy غير مضبوط.");
      else if (!r.gifs.length) setNote("لا توجد نتائج، جرّب كلمة أخرى.");
    } catch {
      setNote("تعذّر البحث، حاول مجدداً.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const kw = initialKeywords.length ? initialKeywords : ["funny", "laugh"];
    if (!gifs.length) run(kw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="glass-panel max-w-md rounded-3xl border-border"
        onClick={stop}
        onPointerDown={stop}
        onKeyDown={stop}
        onSubmit={stop}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <Sparkles className="size-4" /> اختر صورة متحركة
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            className="field ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                run([q]);
              }
            }}
            placeholder='ابحث: "عادل إمام"، "ضحك"...'
          />
        </div>
        {!q && initialKeywords.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            نتائج مقترحة من الذكاء الاصطناعي: {initialKeywords.slice(0, 3).join("، ")}
          </p>
        )}
        <div className="relative grid min-h-48 grid-cols-3 grid-rows-2 gap-2">
          {busy && (
            <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-background/60 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          {gifs.slice(0, 6).map((g, i) => {
            const on = selected === g.url;
            return (
              <button
                key={g.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(g.url);
                  onOpenChange(false);
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-xl bg-surface animate-in fade-in zoom-in-95 fill-mode-both transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow hover:ring-2 hover:ring-primary/60",
                  on && "ring-2 ring-primary",
                )}
              >
                <img
                  src={g.preview}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                {on && (
                  <span className="absolute left-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
        <p className="text-center text-[10px] text-muted-foreground">Powered by GIPHY</p>
      </DialogContent>
    </Dialog>
  );
}
