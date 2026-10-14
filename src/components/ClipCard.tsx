import { useRef } from "react";
import { Music, Play, Share2, Trash2 } from "lucide-react";
import { shareClip, type Clip } from "@/lib/clips";
import { usePlayer } from "./player";

export function ClipCard({ clip, list, index, onDelete }: { clip: Clip; list: Clip[]; index: number; onDelete?: (() => void) | undefined }) {
  const { playMini, openReels, mini } = usePlayer();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = mini?.id === clip.id;

  const onClick = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      openReels(list, index);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      playMini(clip);
    }, 250);
  };

  const thumb = clip.mediaType === "audio" ? (clip.gifUrl ?? clip.coverUrl) : clip.coverUrl;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={clip.title}
      onClick={onClick}
      className={`group relative aspect-[3/4] w-full cursor-pointer select-none overflow-hidden rounded-2xl shadow-card ring-1 transition hover:scale-[1.02] ${clip.gradient} ${isActive ? "ring-2 ring-primary" : "ring-foreground/10"}`}
    >
      {thumb ? (
        <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : clip.mediaType === "video" ? (
        <video src={`${clip.mediaUrl}#t=0.5`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
      <div className="absolute right-2 top-2 rounded-full bg-background/60 p-1">
        {clip.mediaType === "audio" ? <Music className="size-3" /> : <Play className="size-3" />}
      </div>
      <button
        aria-label="مشاركة"
        onClick={(e) => { e.stopPropagation(); shareClip(clip); }}
        className="absolute left-2 top-2 rounded-full bg-background/60 p-1.5"
      >
        <Share2 className="size-3" />
      </button>
      {onDelete && (
        <button
          aria-label="حذف"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute left-2 top-10 rounded-full bg-destructive/80 p-1.5"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2">
        <p className="line-clamp-2 text-xs font-bold leading-tight">{clip.title}</p>
        {(clip.source || clip.author) && <p className="truncate text-[10px] text-muted-foreground">{clip.source || clip.author}</p>}
      </div>
    </div>
  );
}
