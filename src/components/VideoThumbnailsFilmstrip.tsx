import { memo } from "react";
import { useVideoThumbnails } from "@/lib/video-thumbnails";
import { cn } from "@/lib/utils";

export type VideoThumbnailsFilmstripProps = {
  src: string;
  duration: number;
  width: number;
  inTime?: number;
  outTime?: number;
  className?: string;
};

export const VideoThumbnailsFilmstrip = memo(function VideoThumbnailsFilmstrip({
  src,
  duration,
  width,
  inTime = 0,
  outTime,
  className,
}: VideoThumbnailsFilmstripProps) {
  // Calculate how many thumbnails to fit based on width (approx ~42px per frame)
  const thumbCount = Math.max(4, Math.min(24, Math.ceil(width / 42)));
  const { thumbnails, loading } = useVideoThumbnails(src, duration, thumbCount);

  return (
    <div
      className={cn(
        "relative size-full overflow-hidden flex items-stretch select-none pointer-events-none",
        className,
      )}
    >
      {/* Top and Bottom Film Strip Sprocket Perforations */}
      <div className="absolute inset-x-0 top-0 h-1.5 z-10 flex justify-between px-0.5 opacity-60">
        {Array.from({ length: Math.max(3, Math.floor(width / 14)) }).map((_, i) => (
          <span key={i} className="h-1 w-1 rounded-[1px] bg-white/40" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1.5 z-10 flex justify-between px-0.5 opacity-60">
        {Array.from({ length: Math.max(3, Math.floor(width / 14)) }).map((_, i) => (
          <span key={i} className="h-1 w-1 rounded-[1px] bg-white/40" />
        ))}
      </div>

      {/* Render Extracted Frame Thumbnails */}
      {thumbnails.length > 0 ? (
        <div className="flex size-full items-stretch">
          {thumbnails.map((thumb, idx) => (
            <div
              key={idx}
              className="relative h-full flex-1 min-w-[28px] border-r border-black/40 overflow-hidden bg-black/40"
            >
              <img
                src={thumb}
                alt=""
                className="size-full object-cover pointer-events-none"
                loading="eager"
              />
            </div>
          ))}
        </div>
      ) : (
        /* Smooth Filmstrip Skeleton while generating */
        <div className="flex size-full items-stretch bg-violet-950/40">
          {Array.from({ length: thumbCount }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "relative h-full flex-1 border-r border-white/10 bg-gradient-to-r from-violet-900/40 to-fuchsia-900/40",
                loading && "animate-pulse",
              )}
            />
          ))}
        </div>
      )}

      {/* Subtle overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />
    </div>
  );
});
