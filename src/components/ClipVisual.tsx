import { useEffect, type MutableRefObject } from "react";
import { Music } from "lucide-react";
import type { Clip } from "@/lib/clips";

let current: HTMLMediaElement | null = null;

/** Renders the media for a clip. Audio clips show their GIF (or cover) as the animated background. */
export function ClipVisual({
  clip,
  mediaRef,
  autoPlay,
  active,
  loop,
  fit = "cover",
  onPlayingChange,
}: {
  clip: Clip;
  mediaRef: MutableRefObject<HTMLMediaElement | null>;
  autoPlay?: boolean;
  active?: boolean;
  loop?: boolean;
  fit?: "cover" | "contain";
  onPlayingChange?: (p: boolean) => void;
}) {
  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    if (autoPlay && active) {
      if (current && current !== m) current.pause();
      current = m;
      m.play().catch(() => onPlayingChange?.(false));
    } else if (!active) {
      m.pause();
    }
  }, [autoPlay, active, mediaRef, onPlayingChange]);

  const handlers = {
    onPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (current && current !== e.currentTarget) current.pause();
      current = e.currentTarget;
      onPlayingChange?.(true);
    },
    onPause: () => onPlayingChange?.(false),
    onEnded: () => onPlayingChange?.(false),
  };
  const objectFit = fit === "cover" ? "object-cover" : "object-contain";

  if (clip.mediaType === "video") {
    return (
      <video
        ref={(el) => { mediaRef.current = el; }}
        src={clip.mediaUrl}
        poster={clip.coverUrl ?? undefined}
        playsInline
        loop={loop}
        preload="metadata"
        className={`absolute inset-0 h-full w-full ${objectFit}`}
        {...handlers}
      />
    );
  }
  const bg = clip.gifUrl ?? clip.coverUrl;
  return (
    <>
      {bg ? (
        <img src={bg} alt="" className={`absolute inset-0 h-full w-full ${objectFit}`} />
      ) : (
        <div className="absolute inset-0 grid place-items-center"><Music className="size-8 opacity-70" /></div>
      )}
      <audio ref={(el) => { mediaRef.current = el; }} src={clip.mediaUrl} loop={loop} preload="metadata" {...handlers} />
    </>
  );
}
