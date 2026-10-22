import { useEffect, useRef, useState } from "react";

const thumbnailCache = new Map<string, string[]>();

/**
 * Extracts a sequence of thumbnail frames across a video's duration.
 */
export async function extractVideoThumbnails(
  src: string,
  duration: number,
  count = 10,
): Promise<string[]> {
  const cacheKey = `${src}_${Math.round(duration)}_${count}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  if (typeof window === "undefined" || !duration || duration <= 0) {
    return [];
  }

  return new Promise<string[]>((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    const frames: string[] = [];

    // Target thumbnail resolution (fast & compact)
    const targetW = 96;
    const targetH = 54;
    canvas.width = targetW;
    canvas.height = targetH;

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(frames.length > 0 ? frames : []);
    }, 12000);

    const step = duration / (count + 1);
    let currentIndex = 0;

    const captureNext = () => {
      if (isCleanedUp) return;
      if (currentIndex >= count) {
        clearTimeout(timeout);
        cleanup();
        thumbnailCache.set(cacheKey, frames);
        resolve(frames);
        return;
      }

      // Sample timestamps avoiding exact 0 or end edge
      const targetTime = Math.min(duration - 0.05, Math.max(0.05, (currentIndex + 0.5) * step));

      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, targetW, targetH);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
            frames.push(dataUrl);
          } catch (e) {
            console.warn("Frame capture skipped", e);
          }
        }
        currentIndex++;
        captureNext();
      };

      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = targetTime;
    };

    video.onloadeddata = () => {
      captureNext();
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(frames);
    };

    video.src = src;
  });
}

/**
 * React hook to retrieve video thumbnails for timeline display
 */
export function useVideoThumbnails(src: string | undefined, duration: number, count = 10) {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const prevSrc = useRef<string>("");

  useEffect(() => {
    if (!src || duration <= 0) {
      setThumbnails([]);
      return;
    }

    const key = `${src}_${Math.round(duration)}_${count}`;
    if (thumbnailCache.has(key)) {
      setThumbnails(thumbnailCache.get(key)!);
      return;
    }

    let active = true;
    setLoading(true);
    extractVideoThumbnails(src, duration, count)
      .then((thumbs) => {
        if (active) {
          setThumbnails(thumbs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [src, duration, count]);

  return { thumbnails, loading };
}
