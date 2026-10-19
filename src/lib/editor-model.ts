// Pure timeline model for the editor. No browser APIs here (safe for SSR and tests).
export type Seg = { id: string; kind: "video" | "gif"; src: string; name: string; in: number; out: number; srcDur: number; mute: boolean };
export type Aud = { id: string; src: string; name: string; in: number; out: number; srcDur: number; start: number; volume: number; mute: boolean };
export type Txt = { id: string; text: string; start: number; end: number; color: string; size: number; y: number };
export type Stk = { id: string; src: string; start: number; end: number; x: number; y: number; w: number };

export const MIN_LEN = 0.3;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const segLen = (s: { in: number; out: number }) => s.out - s.in;

export const videoTotal = (segs: Seg[]) => segs.reduce((a, s) => a + segLen(s), 0);
export const projectTotal = (segs: Seg[], auds: Aud[], txts: Txt[] = [], stks: Stk[] = []) =>
  Math.max(videoTotal(segs), ...auds.map((a) => a.start + segLen(a)), ...txts.map((t) => t.end), ...stks.map((s) => s.end), 0);

/** Which segment plays at project time t, and the source-local time inside it. */
export function segAt(segs: Seg[], t: number): { seg: Seg; local: number; offset: number } | null {
  let acc = 0;
  for (const s of segs) {
    const l = segLen(s);
    if (t < acc + l) return { seg: s, local: s.in + (t - acc), offset: acc };
    acc += l;
  }
  return null;
}

export function splitSegs(segs: Seg[], t: number): Seg[] {
  const hit = segAt(segs, t);
  if (!hit || hit.local - hit.seg.in < MIN_LEN || hit.seg.out - hit.local < MIN_LEN) return segs;
  return segs.flatMap((s) => (s.id !== hit.seg.id ? [s] : [{ ...s, out: hit.local }, { ...s, id: uid(), in: hit.local }]));
}

export function splitAud(auds: Aud[], id: string, t: number): Aud[] {
  return auds.flatMap((a) => {
    if (a.id !== id) return [a];
    const local = a.in + (t - a.start);
    if (local - a.in < MIN_LEN || a.out - local < MIN_LEN) return [a];
    return [{ ...a, out: local }, { ...a, id: uid(), in: local, start: t }];
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function trimSeg(s: Seg, side: "l" | "r", d: number): Seg {
  return side === "l" ? { ...s, in: clamp(s.in + d, 0, s.out - MIN_LEN) } : { ...s, out: clamp(s.out + d, s.in + MIN_LEN, s.srcDur) };
}
export function trimAud(a: Aud, side: "l" | "r" | "m", d: number): Aud {
  if (side === "m") return { ...a, start: Math.max(0, a.start + d) };
  if (side === "r") return { ...a, out: clamp(a.out + d, a.in + MIN_LEN, a.srcDur) };
  const nin = clamp(a.in + d, 0, a.out - MIN_LEN);
  return { ...a, in: nin, start: Math.max(0, a.start + (nin - a.in)) };
}
export function trimSpan<T extends { start: number; end: number }>(x: T, side: "l" | "r" | "m", d: number): T {
  if (side === "m") { const s = Math.max(0, x.start + d); return { ...x, start: s, end: s + (x.end - x.start) }; }
  if (side === "l") return { ...x, start: clamp(x.start + d, 0, x.end - MIN_LEN) };
  return { ...x, end: Math.max(x.start + MIN_LEN, x.end + d) };
}

export const tc = (t: number) => {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const FILTERS = [
  { id: "none", label: "أصلي", css: "none" },
  { id: "vivid", label: "حيوي", css: "saturate(1.6) contrast(1.1)" },
  { id: "bw", label: "أبيض وأسود", css: "grayscale(1) contrast(1.15)" },
  { id: "sepia", label: "قديم", css: "sepia(0.8) contrast(1.05)" },
  { id: "cool", label: "بارد", css: "hue-rotate(190deg) saturate(1.2)" },
  { id: "warm", label: "دافئ", css: "sepia(0.35) saturate(1.4) brightness(1.05)" },
  { id: "drama", label: "دراما", css: "contrast(1.5) brightness(0.9) saturate(0.8)" },
  { id: "fade", label: "باهت", css: "brightness(1.1) saturate(0.6) contrast(0.85)" },
] as const;
