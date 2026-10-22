import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Pause, Play, Share2, X } from "lucide-react";
import { shareClip, type Clip } from "@/lib/clips";
import { ClipVisual } from "./ClipVisual";
import { VerticalActionSidebar } from "./VerticalActionSidebar";

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
      {mini && (
        <MiniPlayer
          clip={mini}
          onClose={() => setMini(null)}
          onExpand={() => {
            setReels({ list: [mini], index: 0 });
            setMini(null);
          }}
        />
      )}
      {reels && (
        <ReelsViewer list={reels.list} start={reels.index} onClose={() => setReels(null)} />
      )}
    </Ctx.Provider>
  );
}

function MiniPlayer({
  clip,
  onClose,
  onExpand,
}: {
  clip: Clip;
  onClose: () => void;
  onExpand: () => void;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(true);
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 animate-in slide-in-from-bottom-4">
      <div className="glass-panel flex items-center gap-3 rounded-2xl p-2 shadow-card">
        <div className={`relative size-16 shrink-0 overflow-hidden rounded-xl ${clip.gradient}`}>
          <ClipVisual
            clip={clip}
            mediaRef={ref}
            autoPlay
            active={playing}
            onPlayingChange={setPlaying}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{clip.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[clip.author, clip.source].filter(Boolean).join(" · ") || clip.category}
          </p>
        </div>
        <button
          aria-label="تشغيل/إيقاف"
          className="rounded-full bg-primary p-2 text-primary-foreground"
          onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          aria-label="مشاركة"
          className="p-1.5 text-muted-foreground"
          onClick={() => shareClip(clip)}
        >
          <Share2 className="size-4" />
        </button>
        <button aria-label="ملء الشاشة" className="p-1.5 text-muted-foreground" onClick={onExpand}>
          <Maximize2 className="size-4" />
        </button>
        <button aria-label="إغلاق" className="p-1.5 text-muted-foreground" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ReelsViewer({
  list,
  start,
  onClose,
}: {
  list: Clip[];
  start: number;
  onClose: () => void;
}) {
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
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="glass-panel absolute right-4 top-4 z-10 rounded-full p-2"
      >
        <X className="size-5" />
      </button>
      <div
        ref={container}
        onScroll={(e) =>
          setActive(Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight))
        }
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
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [bgMode, setBgMode] = useState<"blurred" | "transparent">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("qafsha_player_bg_mode") as "blurred" | "transparent") || "blurred"
      );
    }
    return "blurred";
  });

  const toggleBgMode = () => {
    const next = bgMode === "blurred" ? "transparent" : "blurred";
    setBgMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("qafsha_player_bg_mode", next);
    }
  };

  // Keep background ambient video in exact sync with primary video
  useEffect(() => {
    const primary = ref.current;
    const ambient = bgVideoRef.current;
    if (!primary || !ambient || clip.mediaType !== "video") return;

    const onPlay = () => void ambient.play().catch(() => {});
    const onPause = () => ambient.pause();
    const onTimeUpdate = () => {
      if (Math.abs(ambient.currentTime - primary.currentTime) > 0.25) {
        ambient.currentTime = primary.currentTime;
      }
    };

    primary.addEventListener("play", onPlay);
    primary.addEventListener("pause", onPause);
    primary.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      primary.removeEventListener("play", onPlay);
      primary.removeEventListener("pause", onPause);
      primary.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [clip.mediaType]);

  const thumb =
    clip.mediaType === "audio" ? (clip.gifUrl ?? clip.coverUrl) : (clip.coverUrl ?? clip.gifUrl);

  return (
    <section
      className={`relative mx-auto h-full w-full max-w-md snap-start snap-always overflow-hidden ${
        bgMode === "transparent" ? "bg-black/80 backdrop-blur-md" : "bg-black"
      }`}
    >
      {/* 2. Blurred Video Ambient Reflection (Background Option) */}
      {bgMode === "blurred" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 select-none">
          {clip.mediaType === "video" ? (
            <video
              ref={bgVideoRef}
              src={clip.mediaUrl}
              muted
              playsInline
              loop
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover scale-125 filter blur-[25px] brightness-[0.65] saturate-[1.4] opacity-85 transition-opacity duration-500"
            />
          ) : thumb ? (
            <img
              src={thumb}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover scale-125 filter blur-[25px] brightness-[0.65] saturate-[1.4] opacity-85 transition-opacity duration-500"
            />
          ) : (
            <div className={`absolute inset-0 ${clip.gradient} opacity-50 filter blur-[25px]`} />
          )}
          <div className="absolute inset-0 bg-black/25" />
        </div>
      )}

      {/* Primary Media Display */}
      <div
        className="relative z-10 size-full cursor-pointer"
        onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}
      >
        <ClipVisual
          clip={clip}
          mediaRef={ref}
          autoPlay={active}
          active={active}
          loop
          onPlayingChange={setPlaying}
          fit="contain"
        />
      </div>

      {/* Play/Pause Center Indicator */}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="rounded-full bg-black/40 p-4 backdrop-blur-sm">
            <Play className="size-14 text-white opacity-90 fill-white/20" />
          </div>
        </div>
      )}

      {/* 3. Vertical Action Sidebar (TikTok Style: Reaction with Clown Logo, Bookmark, Share Count, Background Toggle) */}
      <VerticalActionSidebar
        clip={clip}
        clipId={clip.id}
        clipTitle={clip.title}
        clipAuthor={clip.author ?? undefined}
        clipSource={clip.source ?? undefined}
        bgMode={bgMode}
        onToggleBgMode={toggleBgMode}
        className="z-30 bottom-24 right-3"
      />

      {/* Bottom Info Overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-5 pb-8">
        <p className="font-display text-lg font-extrabold text-white drop-shadow">{clip.title}</p>
        <p className="text-sm text-white/80 drop-shadow">
          {[clip.author, clip.source, clip.category].filter(Boolean).join(" · ")}
        </p>
      </div>
    </section>
  );
}
