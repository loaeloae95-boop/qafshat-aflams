import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Scissors } from "lucide-react";
import { fmtTime } from "@/lib/media-tools";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Player + dual-range timeline for picking a [start, end] window of a video or audio file. */
export function MediaTrimmer({
  file,
  type,
  gifUrl,
  range,
  onRange,
  onDuration,
}: {
  file: File;
  type: "video" | "audio";
  gifUrl?: string | null;
  range: [number, number];
  onRange: (r: [number, number]) => void;
  onDuration: (d: number) => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const ref = useRef<HTMLMediaElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [start, end] = range;

  const onMeta = () => {
    const d = ref.current?.duration ?? 0;
    if (!isFinite(d)) return;
    setDuration(d);
    onDuration(d);
    onRange([0, d]);
  };
  const onTime = () => {
    const m = ref.current;
    if (!m) return;
    setNow(m.currentTime);
    if (m.currentTime >= end) { m.pause(); m.currentTime = start; }
  };
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const m = ref.current;
    if (!m) return;
    if (m.paused) { if (m.currentTime < start || m.currentTime >= end) m.currentTime = start; void m.play(); } else m.pause();
  };
  const setStart = (v: number) => onRange([Math.min(Math.max(0, v), end - 0.5), end]);
  const setEnd = (v: number) => onRange([start, Math.max(Math.min(duration, v), start + 0.5)]);

  const pct = (v: number) => (duration ? (v / duration) * 100 : 0);
  const thumb =
    "pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-foreground [&::-webkit-slider-thumb]:shadow-glow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary-foreground";

  const media = {
    src: url,
    preload: "metadata" as const,
    onLoadedMetadata: onMeta,
    onTimeUpdate: onTime,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-3" onClick={stop}>
      <div className="relative aspect-video overflow-hidden rounded-xl gradient-indigo">
        {type === "video" ? (
          <video ref={(el) => { ref.current = el; }} playsInline className="absolute inset-0 size-full object-contain" {...media} />
        ) : (
          <>
            {gifUrl ? <img src={gifUrl} alt="" className="absolute inset-0 size-full object-cover" /> : null}
            <audio ref={(el) => { ref.current = el; }} {...media} />
          </>
        )}
        <button type="button" aria-label="تشغيل" onClick={toggle} className="glass-panel absolute bottom-3 right-3 rounded-full p-3">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
      </div>

      <div className="relative h-8" dir="ltr" onPointerDown={stop}>
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-secondary" />
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full gradient-violet" style={{ left: `${pct(start)}%`, width: `${pct(end - start)}%` }} />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-accent" style={{ left: `${pct(now)}%` }} />
        <input aria-label="البداية" type="range" min={0} max={duration || 1} step={0.1} value={start} onChange={(e) => setStart(+e.target.value)} onClick={stop} className={thumb} />
        <input aria-label="النهاية" type="range" min={0} max={duration || 1} step={0.1} value={end} onChange={(e) => setEnd(+e.target.value)} onClick={stop} className={thumb} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="space-y-1">
          <span className="block font-bold">البداية (ث)</span>
          <input type="number" className="field" dir="ltr" min={0} step={0.1} value={start.toFixed(1)} onClick={stop} onChange={(e) => setStart(+e.target.value)} />
        </label>
        <div className="grid place-items-center rounded-xl bg-secondary p-2 text-center">
          <span className="text-muted-foreground">الآن</span>
          <span className="font-bold" dir="ltr">{fmtTime(now)}</span>
        </div>
        <label className="space-y-1">
          <span className="block font-bold">النهاية (ث)</span>
          <input type="number" className="field" dir="ltr" min={0} step={0.1} value={end.toFixed(1)} onClick={stop} onChange={(e) => setEnd(+e.target.value)} />
        </label>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Scissors className="size-3" /> المدة المختارة: <span dir="ltr">{fmtTime(Math.max(0, end - start))}</span> — يُقصّ المقطع على جهازك قبل الرفع
      </p>
    </div>
  );
}
