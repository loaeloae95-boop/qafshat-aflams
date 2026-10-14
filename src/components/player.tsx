import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Pause, Play, Share2, X } from "lucide-react";
import { shareClip, type Clip } from "@/lib/clips";
import { ClipVisual } from "./ClipVisual";

type PlayerCtx = {
  mini: Clip | null;
  playMini: (clip: Clip) => void;
  closeMini: () => void;
  openReels: (list: Clip[], index: number) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);
export const usePlayer = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside provider");
  return c;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [mini, setMini] = useState<Clip | null>(null);
  const [reels, setReels] = useState<{ list: Clip[]; index: number } | null>(null);
  return (
    <Ctx.Provider
      value={{
        mini,
        playMini: setMini,
        closeMini: () => setMini(null),
        openReels: (list, index) => {
          setMini(null);
          setReels({ list, index });
        },
      }}
    >
      {children}
      {mini && <MiniPlayer clip={mini} onClose={() => setMini(null)} onExpand={() => { setReels({ list: [mini], index: 0 }); setMini(null); }} />}
      {reels && <ReelsViewer list={reels.list} start={reels.index} onClose={() => setReels(null)} />}
    </Ctx.Provider>
  );
}

function MiniPlayer({ clip, onClose, onExpand }: { clip: Clip; onClose: () => void; onExpand: () => void }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(true);
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 animate-in slide-in-from-bottom-4">
      <div className="glass-panel flex items-center gap-3 rounded-2xl p-2 shadow-card">
        <div className={`relative size-16 shrink-0 overflow-hidden rounded-xl ${clip.gradient}`}>
          <ClipVisual clip={clip} mediaRef={ref} autoPlay active={playing} onPlayingChange={setPlaying} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{clip.title}</p>
          <p className="truncate text-xs text-muted-foreground">{[clip.author, clip.source].filter(Boolean).join(" · ") || clip.category}</p>
        </div>
        <button aria-label="تشغيل/إيقاف" className="rounded-full bg-primary p-2 text-primary-foreground" onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button aria-label="مشاركة" className="p-1.5 text-muted-foreground" onClick={() => shareClip(clip)}><Share2 className="size-4" /></button>
        <button aria-label="ملء الشاشة" className="p-1.5 text-muted-foreground" onClick={onExpand}><Maximize2 className="size-4" /></button>
        <button aria-label="إغلاق" className="p-1.5 text-muted-foreground" onClick={onClose}><X className="size-4" /></button>
      </div>
    </div>
  );
}

function ReelsViewer({ list, start, onClose }: { list: Clip[]; start: number; onClose: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.scrollTo({ top: start * el.clientHeight });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [start, onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-background">
      <button aria-label="إغلاق" onClick={onClose} className="glass-panel absolute right-4 top-4 z-10 rounded-full p-2">
        <X className="size-5" />
      </button>
      <div
        ref={container}
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight))}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll"
      >
        {list.map((clip, i) => (
          <ReelItem key={clip.id} clip={clip} active={i === active} />
        ))}
      </div>
    </div>
  );
}

function ReelItem({ clip, active }: { clip: Clip; active: boolean }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <section className={`relative mx-auto h-full w-full max-w-md snap-start snap-always overflow-hidden ${clip.gradient}`}>
      <div className="absolute inset-0" onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}>
        <ClipVisual clip={clip} mediaRef={ref} autoPlay={active} active={active} loop onPlayingChange={setPlaying} fit="contain" />
      </div>
      {!playing && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Play className="size-16 opacity-80" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-5 pb-8">
        <p className="font-display text-lg font-extrabold">{clip.title}</p>
        <p className="text-sm text-muted-foreground">{[clip.author, clip.source, clip.category].filter(Boolean).join(" · ")}</p>
      </div>
      <button aria-label="مشاركة" onClick={() => shareClip(clip)} className="glass-panel absolute bottom-24 left-4 rounded-full p-3">
        <Share2 className="size-5" />
      </button>
    </section>
  );
}
