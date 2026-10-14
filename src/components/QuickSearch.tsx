import { useMemo, useRef, useState } from "react";
import { Pause, Play, Search, Send, X, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ALL, filterClips, shareClip, useClips, type Clip } from "@/lib/clips";
import { ClipVisual } from "./ClipVisual";

export function QuickSearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-label="بحث ومشاركة سريعة"
        onClick={() => setOpen(true)}
        className="fixed bottom-28 left-4 z-40 grid size-14 place-items-center rounded-full gradient-violet shadow-glow transition hover:scale-105"
      >
        <Zap className="size-6" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-md gap-0 overflow-hidden rounded-3xl border-border bg-popover p-0 [&>button]:hidden" dir="rtl">
          <DialogTitle className="sr-only">بحث ومشاركة سريعة</DialogTitle>
          {open && <QuickSearchPanel onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickSearchPanel({ onClose }: { onClose: () => void }) {
  const { data = [] } = useClips();
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const results = useMemo(() => filterClips(data, q, ALL).slice(0, 30), [data, q]);

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم القفشة، الممثل، أو الفيلم..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button aria-label="إغلاق" onClick={onClose} className="p-1 text-muted-foreground"><X className="size-4" /></button>
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {results.map((c) => (
          <QuickRow key={c.id} clip={c} previewing={preview === c.id} onPreview={() => setPreview(preview === c.id ? null : c.id)} />
        ))}
        {results.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">لا نتائج</li>}
      </ul>
    </div>
  );
}

function QuickRow({ clip, previewing, onPreview }: { clip: Clip; previewing: boolean; onPreview: () => void }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-2">
      <button onClick={onPreview} className={`relative size-14 shrink-0 overflow-hidden rounded-xl ${clip.gradient}`} aria-label="معاينة">
        {previewing ? (
          <ClipVisual clip={clip} mediaRef={ref} autoPlay active loop />
        ) : (
          (clip.gifUrl ?? clip.coverUrl) && <img src={(clip.gifUrl ?? clip.coverUrl)!} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-background/30">
          {previewing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{clip.title}</p>
        <p className="truncate text-xs text-muted-foreground">{[clip.author, clip.source, clip.category].filter(Boolean).join(" · ")}</p>
      </div>
      <button onClick={() => shareClip(clip)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
        <Send className="size-3" /> مشاركة
      </button>
    </li>
  );
}
