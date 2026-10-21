import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight, Download, Film, Image as ImageIcon, Layers, Music, Pause, Play, Plus, Scissors, Sparkles,
  Sticker, Trash2, Type, Volume2, VolumeX, Wand2, X,
} from "lucide-react";
import { GifPicker } from "@/components/GifPicker";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  FILTERS, projectTotal, segAt, segLen, splitAud, splitSegs, tc, trimAud, trimSeg, trimSpan, uid,
  type Aud, type Seg, type Stk, type Txt,
} from "@/lib/editor-model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "محرر القفشات — قفشات أفلام" },
      { name: "description", content: "حرّر الفيديو والصوت، قصّ وقسّم، أضف GIF وملصقات ونصوص وفلاتر، وصدّر مقطعاً جاهزاً." },
      { property: "og:title", content: "محرر القفشات — قفشات أفلام" },
      { property: "og:description", content: "محرر فيديو وصوت على الجوال مع GIF وفلاتر ونصوص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Editor,
});

const W = 720, H = 1280, PPS = 50;
type Tab = "edit" | "filters" | "stickers" | "overlays" | "text";
type Sel = { kind: "seg" | "aud" | "txt" | "stk"; id: string } | null;
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function mediaDuration(url: string, tag: "video" | "audio") {
  return new Promise<number>((res, rej) => {
    const el = document.createElement(tag);
    el.preload = "metadata";
    el.onloadedmetadata = () => res(isFinite(el.duration) ? el.duration : 10);
    el.onerror = () => rej(new Error("تعذّر قراءة الملف"));
    el.src = url;
  });
}

function Editor() {
  const { user } = useSession();
  const [segs, setSegs] = useState<Seg[]>([]);
  const [auds, setAuds] = useState<Aud[]>([]);
  const [txts, setTxts] = useState<Txt[]>([]);
  const [stks, setStks] = useState<Stk[]>([]);
  const [filter, setFilter] = useState("none");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [picker, setPicker] = useState<null | "sticker" | "main">(null);
  const [draft, setDraft] = useState("");
  const [exporting, setExporting] = useState(0);
  const [out, setOut] = useState<{ url: string; blob: Blob; ext: string } | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useRef(new Map<string, HTMLMediaElement>());
  const imgs = useRef(new Map<string, HTMLImageElement>());
  const gains = useRef(new Map<HTMLMediaElement, GainNode>());
  const actx = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const imgHost = useRef<HTMLDivElement>(null);
  const clock = useRef({ playing: false, t0: 0, at: 0 });
  const st = useRef({ segs, auds, txts, stks, filter, t });
  st.current = { segs, auds, txts, stks, filter, t };
  const total = projectTotal(segs, auds, txts, stks);
  const totalRef = useRef(total);
  totalRef.current = total;

  // ---------- media element registry ----------
  const elFor = (src: string, tag: "video" | "audio") => {
    let el = els.current.get(src);
    if (!el) {
      el = document.createElement(tag);
      el.src = src; el.preload = "auto"; el.crossOrigin = "anonymous";
      if (el instanceof HTMLVideoElement) el.playsInline = true;
      els.current.set(src, el);
      connect(el);
    }
    return el;
  };
  const imgFor = (src: string) => {
    let im = imgs.current.get(src);
    if (!im) {
      im = new Image(); im.crossOrigin = "anonymous"; im.src = src;
      im.style.cssText = "position:absolute;width:2px;height:2px;opacity:0.01;pointer-events:none";
      imgHost.current?.appendChild(im); // keeps GIF animating for canvas draws
      imgs.current.set(src, im);
    }
    return im;
  };
  const connect = (el: HTMLMediaElement) => {
    const a = actx.current;
    if (!a || gains.current.has(el)) return;
    const g = a.ctx.createGain();
    a.ctx.createMediaElementSource(el).connect(g);
    g.connect(a.ctx.destination); g.connect(a.dest);
    gains.current.set(el, g);
  };
  const ensureAudio = async () => {
    if (!actx.current) {
      const ctx = new AudioContext();
      actx.current = { ctx, dest: ctx.createMediaStreamDestination() };
      els.current.forEach(connect);
    }
    if (actx.current.ctx.state === "suspended") await actx.current.ctx.resume();
  };
  const setVol = (el: HTMLMediaElement, v: number) => {
    const g = gains.current.get(el);
    if (g) g.gain.value = v; else el.volume = Math.min(1, v);
  };

  // ---------- render + sync loop ----------
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = clock.current;
      let now = st.current.t;
      if (c.playing) {
        now = c.at + (performance.now() - c.t0) / 1000;
        if (now >= totalRef.current) { now = totalRef.current; c.playing = false; setPlaying(false); }
        setT(now);
      }
      const { segs, auds, txts, stks, filter } = st.current;
      const hit = segAt(segs, now);
      // video sync
      const activeEl = hit?.seg.kind === "video" ? els.current.get(hit.seg.src) : undefined;
      els.current.forEach((el, src) => {
        const isVideoSrc = el instanceof HTMLVideoElement;
        if (isVideoSrc) {
          if (el === activeEl && hit) {
            setVol(el, hit.seg.mute ? 0 : 1);
            if (Math.abs(el.currentTime - hit.local) > (c.playing ? 0.3 : 0.05)) el.currentTime = hit.local;
            if (c.playing && el.paused) void el.play().catch(() => {});
            if (!c.playing && !el.paused) el.pause();
          } else if (!el.paused) el.pause();
          return;
        }
        const a = auds.find((x) => x.src === src && now >= x.start && now < x.start + segLen(x));
        if (a && c.playing) {
          const local = a.in + (now - a.start);
          setVol(el, a.mute ? 0 : a.volume);
          if (Math.abs(el.currentTime - local) > 0.3) el.currentTime = local;
          if (el.paused) void el.play().catch(() => {});
        } else if (!el.paused) el.pause();
      });
      // draw
      const cv = canvas.current; const g = cv?.getContext("2d");
      if (!cv || !g) return;
      g.filter = "none"; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      const src: CanvasImageSource | undefined = hit ? (hit.seg.kind === "video" ? (activeEl as HTMLVideoElement) : imgFor(hit.seg.src)) : undefined;
      if (src) {
        const sw = src instanceof HTMLVideoElement ? src.videoWidth : (src as HTMLImageElement).naturalWidth;
        const sh = src instanceof HTMLVideoElement ? src.videoHeight : (src as HTMLImageElement).naturalHeight;
        if (sw && sh) {
          const k = Math.min(W / sw, H / sh);
          g.filter = FILTERS.find((f) => f.id === filter)?.css ?? "none";
          g.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
          g.filter = "none";
        }
      }
      for (const s of stks) {
        if (now < s.start || now >= s.end) continue;
        const im = imgFor(s.src);
        if (!im.naturalWidth) continue;
        const w = s.w * W, h = (w * im.naturalHeight) / im.naturalWidth;
        g.drawImage(im, s.x * W - w / 2, s.y * H - h / 2, w, h);
      }
      for (const x of txts) {
        if (now < x.start || now >= x.end) continue;
        g.font = `800 ${x.size}px Cairo, Tajawal, sans-serif`;
        g.textAlign = "center"; g.direction = "rtl"; g.lineJoin = "round";
        g.lineWidth = x.size / 6; g.strokeStyle = "rgba(0,0,0,0.85)";
        g.strokeText(x.text, W / 2, x.y * H); g.fillStyle = x.color; g.fillText(x.text, W / 2, x.y * H);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = async () => {
    if (!total) return;
    await ensureAudio();
    const from = t >= total - 0.05 ? 0 : t;
    clock.current = { playing: true, t0: performance.now(), at: from };
    setPlaying(true);
  };
  const pause = () => { clock.current.playing = false; setPlaying(false); };
  const seek = (v: number) => { pause(); setT(Math.max(0, Math.min(total, v))); };

  // ---------- adding media ----------
  const addVideo = async (f: File) => {
    const src = URL.createObjectURL(f);
    const d = await mediaDuration(src, "video");
    elFor(src, "video");
    setSegs((s) => [...s, { id: uid(), kind: "video", src, name: f.name, in: 0, out: d, srcDur: d, mute: false }]);
  };
  const addAudio = async (f: File) => {
    const src = URL.createObjectURL(f);
    const d = await mediaDuration(src, "audio");
    elFor(src, "audio");
    const id = uid();
    setAuds((a) => [...a, { id, src, name: f.name, in: 0, out: d, srcDur: d, start: 0, volume: 1, mute: false }]);
    setSel({ kind: "aud", id });
  };
  const addGifMain = (src: string, name = "GIF") => {
    imgFor(src);
    const id = uid();
    // GIF on the main track defaults to the length of the audio under it so they export in sync.
    const len = Math.max(3, ...st.current.auds.map((a) => a.start + segLen(a))) ;
    setSegs((s) => [...s, { id, kind: "gif", src, name, in: 0, out: Math.min(len, 60), srcDur: 600, mute: true }]);
    setSel({ kind: "seg", id });
  };
  const addSticker = (src: string) => {
    imgFor(src);
    const id = uid();
    setStks((s) => [...s, { id, src, start: t, end: Math.max(t + 3, Math.min(total, t + 3)), x: 0.5, y: 0.35, w: 0.45 }]);
    setSel({ kind: "stk", id });
  };
  const addText = () => {
    if (!draft.trim()) return;
    const id = uid();
    setTxts((x) => [...x, { id, text: draft.trim(), start: t, end: t + 3, color: "#ffffff", size: 64, y: 0.82 }]);
    setDraft(""); setSel({ kind: "txt", id });
  };

  // ---------- edit ops ----------
  const split = () => {
    if (sel?.kind === "aud") setAuds((a) => splitAud(a, sel.id, t));
    else setSegs((s) => splitSegs(s, t));
  };
  const remove = () => {
    if (!sel) return;
    if (sel.kind === "seg") setSegs((s) => s.filter((x) => x.id !== sel.id));
    if (sel.kind === "aud") setAuds((s) => s.filter((x) => x.id !== sel.id));
    if (sel.kind === "txt") setTxts((s) => s.filter((x) => x.id !== sel.id));
    if (sel.kind === "stk") setStks((s) => s.filter((x) => x.id !== sel.id));
    setSel(null);
  };

  const drag = (e: React.PointerEvent, apply: (dSec: number) => void) => {
    e.stopPropagation(); e.preventDefault();
    pause();
    const x0 = e.clientX;
    let raf = 0, last = x0;
    // Listen on window: the handle re-renders while dragging, so element listeners get lost.
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      last = ev.clientX;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; apply(((last - x0) * 1.5) / PPS); });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const dragSeg = (e: React.PointerEvent, s: Seg, side: "l" | "r") => drag(e, (d) => setSegs((all) => all.map((x) => (x.id === s.id ? trimSeg(s, side, d) : x))));
  const dragAud = (e: React.PointerEvent, a: Aud, side: "l" | "r" | "m") => drag(e, (d) => setAuds((all) => all.map((x) => (x.id === a.id ? trimAud(a, side, d) : x))));
  const dragTxt = (e: React.PointerEvent, a: Txt, side: "l" | "r" | "m") => drag(e, (d) => setTxts((all) => all.map((x) => (x.id === a.id ? trimSpan(a, side, d) : x))));
  const dragStk = (e: React.PointerEvent, a: Stk, side: "l" | "r" | "m") => drag(e, (d) => setStks((all) => all.map((x) => (x.id === a.id ? trimSpan(a, side, d) : x))));

  // ---------- export ----------
  const exportVideo = async () => {
    if (!total || !canvas.current) { toast.error("أضف فيديو أو GIF أولاً"); return; }
    await ensureAudio();
    setSel(null); setOut(null);
    const stream = canvas.current.captureStream(30);
    actx.current!.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const mime = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    setT(0);
    await new Promise((r) => setTimeout(r, 300)); // let first frames seek
    rec.start(250);
    clock.current = { playing: true, t0: performance.now(), at: 0 };
    setPlaying(true);
    const tick = setInterval(() => {
      const p = (performance.now() - clock.current.t0) / 1000 / total;
      setExporting(Math.min(99, Math.max(1, Math.round(p * 100))));
      if (!clock.current.playing) { clearInterval(tick); rec.stop(); }
    }, 200);
    setExporting(1);
    await done;
    setExporting(0);
    const type = mime.split(";")[0] || "video/webm";
    const blob = new Blob(chunks, { type });
    setOut({ blob, url: URL.createObjectURL(blob), ext: type.includes("mp4") ? "mp4" : "webm" });
  };

  const saveToLibrary = async () => {
    if (!out || !user) { toast.error("سجّل الدخول للحفظ"); return; }
    const title = window.prompt("اسم القفشة", txts[0]?.text ?? "قفشة جديدة")?.trim();
    if (!title) return;
    const path = `${user.id}/video-${crypto.randomUUID()}.${out.ext}`;
    const up = await supabase.storage.from("media").upload(path, out.blob, { contentType: out.blob.type });
    if (up.error) { toast.error(up.error.message); return; }
    const { error } = await supabase.from("clips").insert({ user_id: user.id, title, media_type: "video", media_url: path, duration_seconds: total });
    if (error) toast.error(error.message); else toast.success("تم الحفظ في مكتبتك 🎉");
  };

  // ---------- UI helpers ----------
  const selSeg = sel?.kind === "seg" ? segs.find((x) => x.id === sel.id) : undefined;
  const selAud = sel?.kind === "aud" ? auds.find((x) => x.id === sel.id) : undefined;
  const selTxt = sel?.kind === "txt" ? txts.find((x) => x.id === sel.id) : undefined;
  const selStk = sel?.kind === "stk" ? stks.find((x) => x.id === sel.id) : undefined;
  const width = Math.max(total + 4, 10) * PPS;
  const filePick = (accept: string, fn: (f: File) => Promise<void> | void) => (
    <input type="file" accept={accept} className="hidden" onChange={async (e) => {
      const f = e.target.files?.[0]; e.target.value = "";
      if (f) try { await fn(f); } catch (err) { toast.error(err instanceof Error ? err.message : "فشل"); }
    }} />
  );
  const Handle = ({ side, on }: { side: "l" | "r"; on: (e: React.PointerEvent) => void }) => (
    <span onPointerDown={on} className={cn("absolute inset-y-0 z-10 flex w-5 cursor-ew-resize touch-none items-center justify-center bg-primary-foreground", side === "l" ? "left-0 rounded-l-md" : "right-0 rounded-r-md")}>
      <span className="h-3 w-0.5 rounded bg-background" />
    </span>
  );
  const Block = ({ active, left, w, cls, label, onSel, onL, onR, onM }: {
    active: boolean; left: number; w: number; cls: string; label: React.ReactNode; onSel: () => void;
    onL: (e: React.PointerEvent) => void; onR: (e: React.PointerEvent) => void; onM?: (e: React.PointerEvent) => void;
  }) => (
    <div
      onClick={(e) => { e.stopPropagation(); onSel(); }}
      onPointerDown={active && onM ? onM : undefined}
      style={{ left, width: Math.max(w, 8) }}
      className={cn("absolute inset-y-1 overflow-hidden rounded-md px-3 text-[10px] font-bold leading-[2.6rem] transition-shadow touch-none", cls, active && "ring-2 ring-primary-foreground shadow-glow")}
    >
      <span className="pointer-events-none truncate">{label}</span>
      {active && <><Handle side="l" on={onL} /><Handle side="r" on={onR} /></>}
    </div>
  );

  let acc = 0;
  const tabs: { id: Tab; label: string; icon: typeof Film }[] = [
    { id: "edit", label: "تعديل", icon: Scissors },
    { id: "filters", label: "الفلاتر", icon: Wand2 },
    { id: "stickers", label: "ملصقات", icon: Sticker },
    { id: "overlays", label: "تراكيب", icon: Layers },
    { id: "text", label: "شرح", icon: Type },
  ];

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <div ref={imgHost} className="pointer-events-none fixed left-0 top-0" aria-hidden />
      {/* top bar */}
      <header className="flex items-center justify-between px-4 py-3">
        <Link to="/studio" className="rounded-full bg-surface p-2"><ArrowRight className="size-5" /></Link>
        <h1 className="font-display text-base font-extrabold">محرر القفشات</h1>
        <button onClick={exportVideo} disabled={!!exporting} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
          <Download className="size-4" />{exporting ? `${exporting}%` : "تصدير"}
        </button>
      </header>

      {/* preview */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="relative h-full max-h-full" style={{ aspectRatio: "9 / 16" }}>
          <canvas ref={canvas} width={W} height={H} className="size-full rounded-2xl bg-black object-contain shadow-glow" onClick={() => (playing ? pause() : play())} />
          {!total && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-muted-foreground">
              أضف فيديو أو GIF من الأسفل للبدء
            </div>
          )}
        </div>
      </div>

      {/* transport */}
      <div className="flex items-center justify-between px-4 py-2 text-xs" dir="ltr">
        <span className="font-bold tabular-nums">{tc(t)} / {tc(total)}</span>
        <button onClick={() => (playing ? pause() : play())} className="rounded-full bg-surface p-2">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <div className="flex gap-2">
          <button onClick={split} title="تقسيم" className="rounded-full bg-surface p-2"><Scissors className="size-4" /></button>
          <button onClick={remove} disabled={!sel} title="حذف" className="rounded-full bg-surface p-2 disabled:opacity-40"><Trash2 className="size-4" /></button>
        </div>
      </div>

      {/* timeline */}
      <div className="mx-6 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-surface/50 px-4" dir="ltr">
        <div className="relative select-none" style={{ width }}
          onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / PPS); setSel(null); }}>
          <div className="relative h-6 text-[9px] text-muted-foreground">
            {Array.from({ length: Math.ceil(width / PPS) }, (_, i) => (
              <span key={i} className="absolute top-0 h-full border-l border-border/60 pl-1" style={{ left: i * PPS }}>{tc(i)}</span>
            ))}
          </div>
          <div className="relative h-12">
            {segs.map((s) => {
              const left = acc * PPS; acc += segLen(s);
              return (
                <Block key={s.id} active={sel?.id === s.id} left={left} w={segLen(s) * PPS}
                  cls={s.kind === "gif" ? "gradient-teal" : "gradient-violet"}
                  label={<>{s.kind === "gif" ? <ImageIcon className="me-1 inline size-3" /> : <Film className="me-1 inline size-3" />}{s.name}</>}
                  onSel={() => setSel({ kind: "seg", id: s.id })}
                  onL={(e) => dragSeg(e, s, "l")} onR={(e) => dragSeg(e, s, "r")} />
              );
            })}
            <label onPointerDown={stop} className="absolute inset-y-2 flex cursor-pointer items-center gap-1 rounded-md bg-secondary px-2 text-[10px] font-bold" style={{ left: acc * PPS + 6 }}>
              <Plus className="size-3" />فيديو{filePick("video/*", addVideo)}
            </label>
          </div>
          <div className="relative h-12">
            {auds.map((a) => (
              <Block key={a.id} active={sel?.id === a.id} left={a.start * PPS} w={segLen(a) * PPS}
                cls={cn("gradient-indigo", a.mute && "opacity-50")}
                label={<>{a.mute ? <VolumeX className="me-1 inline size-3" /> : <Music className="me-1 inline size-3" />}{a.name}</>}
                onSel={() => setSel({ kind: "aud", id: a.id })}
                onL={(e) => dragAud(e, a, "l")} onR={(e) => dragAud(e, a, "r")} onM={(e) => dragAud(e, a, "m")} />
            ))}
            {!auds.length && (
              <label onPointerDown={stop} className="absolute inset-y-2 left-1.5 flex cursor-pointer items-center gap-1 rounded-md bg-secondary px-3 text-[10px] font-bold">
                <Music className="size-3" />إضافة صوت{filePick("audio/*", addAudio)}
              </label>
            )}
          </div>
          {(txts.length > 0 || stks.length > 0) && (
            <div className="relative h-10">
              {stks.map((s) => (
                <Block key={s.id} active={sel?.id === s.id} left={s.start * PPS} w={(s.end - s.start) * PPS} cls="bg-accent text-accent-foreground"
                  label={<><Sticker className="me-1 inline size-3" />ملصق</>} onSel={() => setSel({ kind: "stk", id: s.id })}
                  onL={(e) => dragStk(e, s, "l")} onR={(e) => dragStk(e, s, "r")} onM={(e) => dragStk(e, s, "m")} />
              ))}
              {txts.map((x) => (
                <Block key={x.id} active={sel?.id === x.id} left={x.start * PPS} w={(x.end - x.start) * PPS} cls="bg-secondary"
                  label={<><Type className="me-1 inline size-3" />{x.text}</>} onSel={() => setSel({ kind: "txt", id: x.id })}
                  onL={(e) => dragTxt(e, x, "l")} onR={(e) => dragTxt(e, x, "r")} onM={(e) => dragTxt(e, x, "m")} />
              ))}
            </div>
          )}
          <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary-foreground" style={{ left: t * PPS }}>
            <span className="absolute -left-1.5 -top-0.5 size-3.5 rounded-full bg-primary-foreground" />
          </div>
        </div>
      </div>

      {/* tool panel */}
      <div className="min-h-[7.5rem] space-y-2 px-4 py-3 text-xs">
        {tab === "edit" && (
          selAud ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setAuds((a) => a.map((x) => (x.id === selAud.id ? { ...x, mute: !x.mute } : x)))} className="rounded-full bg-surface p-2">
                  {selAud.mute ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <input type="range" min={0} max={2} step={0.05} value={selAud.volume} dir="ltr" className="flex-1 accent-primary"
                  onChange={(e) => setAuds((a) => a.map((x) => (x.id === selAud.id ? { ...x, volume: +e.target.value } : x)))} />
                <span className="w-10 text-center font-bold">{Math.round(selAud.volume * 100)}%</span>
              </div>
              <p className="text-muted-foreground">اسحب الأطراف للقص، اسحب المقطع لتحريكه، أو قسّمه عند المؤشر.</p>
            </div>
          ) : selSeg ? (
            <div className="flex flex-wrap items-center gap-2">
              {selSeg.kind === "video" && (
                <button onClick={() => setSegs((s) => s.map((x) => (x.id === selSeg.id ? { ...x, mute: !x.mute } : x)))} className="flex items-center gap-1 rounded-full bg-surface px-3 py-2 font-bold">
                  {selSeg.mute ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}{selSeg.mute ? "صوت الفيديو مكتوم" : "كتم صوت الفيديو"}
                </button>
              )}
              <span className="text-muted-foreground" dir="ltr">{segLen(selSeg).toFixed(1)}s</span>
              <span className="text-muted-foreground">اسحب الأطراف البيضاء لقص البداية/النهاية.</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <label className="tool-btn"><Film className="size-5" />إضافة فيديو{filePick("video/*", addVideo)}</label>
              <label className="tool-btn"><Music className="size-5" />إضافة صوت{filePick("audio/*", addAudio)}</label>
              <button className="tool-btn" onClick={() => setPicker("main")}><Sparkles className="size-5" />GIF رئيسي</button>
            </div>
          )
        )}
        {tab === "filters" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={cn("shrink-0 rounded-xl px-4 py-3 font-bold transition hover:scale-105", filter === f.id ? "gradient-violet shadow-glow" : "bg-surface")}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tab === "stickers" && (
          selStk ? <StickerControls s={selStk} set={(p) => setStks((a) => a.map((x) => (x.id === selStk.id ? { ...x, ...p } : x)))} /> : (
            <div className="grid grid-cols-2 gap-2">
              <button className="tool-btn" onClick={() => setPicker("sticker")}><Sparkles className="size-5" />ملصق GIF بالذكاء الاصطناعي</button>
              <button className="tool-btn" onClick={() => setPicker("main")}><ImageIcon className="size-5" />GIF على المسار الرئيسي</button>
            </div>
          )
        )}
        {tab === "overlays" && (
          selStk ? <StickerControls s={selStk} set={(p) => setStks((a) => a.map((x) => (x.id === selStk.id ? { ...x, ...p } : x)))} /> : (
            <div className="grid grid-cols-2 gap-2">
              <label className="tool-btn"><Layers className="size-5" />صورة فوق الفيديو{filePick("image/*", (f) => addSticker(URL.createObjectURL(f)))}</label>
              <label className="tool-btn"><ImageIcon className="size-5" />صورة/GIF رئيسية{filePick("image/*", (f) => addGifMain(URL.createObjectURL(f), f.name))}</label>
            </div>
          )
        )}
        {tab === "text" && (
          selTxt ? (
            <div className="space-y-2">
              <input className="field" value={selTxt.text} onChange={(e) => setTxts((a) => a.map((x) => (x.id === selTxt.id ? { ...x, text: e.target.value } : x)))} />
              <div className="flex items-center gap-2" dir="ltr">
                <input type="color" value={selTxt.color} onChange={(e) => setTxts((a) => a.map((x) => (x.id === selTxt.id ? { ...x, color: e.target.value } : x)))} className="size-8 rounded" />
                <input type="range" min={28} max={120} value={selTxt.size} className="flex-1 accent-primary" onChange={(e) => setTxts((a) => a.map((x) => (x.id === selTxt.id ? { ...x, size: +e.target.value } : x)))} />
                <input type="range" min={0.08} max={0.95} step={0.01} value={selTxt.y} className="flex-1 accent-primary" onChange={(e) => setTxts((a) => a.map((x) => (x.id === selTxt.id ? { ...x, y: +e.target.value } : x)))} />
              </div>
            </div>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addText(); }}>
              <input className="field flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب الشرح..." />
              <button className="rounded-xl bg-primary px-4 font-bold text-primary-foreground">إضافة</button>
            </form>
          )
        )}
      </div>

      {/* bottom nav */}
      <nav className="grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex flex-col items-center gap-1 py-3 text-[11px] transition", tab === id ? "font-bold text-primary" : "text-muted-foreground")}>
            <Icon className="size-5" />{label}
          </button>
        ))}
      </nav>

      <GifPicker
        open={picker !== null}
        onOpenChange={(o) => !o && setPicker(null)}
        initialKeywords={[...txts.map((x) => x.text), ...auds.map((a) => a.name.replace(/\.[^.]+$/, ""))].slice(0, 3).concat(txts.length || auds.length ? [] : ["ضحك"])}
        selected=""
        onSelect={(url) => { if (picker === "main") addGifMain(url); else addSticker(url); setPicker(null); }}
      />

      {out && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-6 backdrop-blur">
          <div className="glass-panel w-full max-w-sm space-y-3 rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold">المقطع جاهز</h2>
              <button onClick={() => setOut(null)}><X className="size-5" /></button>
            </div>
            <video src={out.url} controls playsInline className="max-h-[55vh] w-full rounded-2xl bg-black" />
            <div className="grid grid-cols-2 gap-2">
              <a href={out.url} download={`qafsha.${out.ext}`} className="rounded-2xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground">تنزيل</a>
              <button onClick={saveToLibrary} className="rounded-2xl gradient-violet py-3 text-sm font-bold">حفظ في مكتبتي</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StickerControls({ s, set }: { s: Stk; set: (p: Partial<Stk>) => void }) {
  const row = (label: string, k: "x" | "y" | "w", min: number, max: number) => (
    <label className="flex items-center gap-2"><span className="w-12 font-bold">{label}</span>
      <input type="range" dir="ltr" min={min} max={max} step={0.01} value={s[k]} onChange={(e) => set({ [k]: +e.target.value })} className="flex-1 accent-primary" />
    </label>
  );
  return <div className="space-y-1">{row("أفقي", "x", 0, 1)}{row("عمودي", "y", 0, 1)}{row("الحجم", "w", 0.1, 1)}</div>;
}
