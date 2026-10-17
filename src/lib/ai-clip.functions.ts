import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type ClipSuggestion = {
  transcript: string;
  title: string;
  actor: string;
  source: string;
  gifKeywords: string[];
};

class GatewayError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function gatewayFail(res: Response, what: string): Promise<never> {
  let msg = "";
  try { const j = await res.json(); msg = j?.error?.message || j?.message || ""; } catch { /* ignore */ }
  if (res.status === 402) msg ||= "رصيد الذكاء الاصطناعي نفد";
  if (res.status === 429) msg ||= "طلبات كثيرة، حاول بعد قليل";
  throw new GatewayError(res.status, `${what}: ${msg || res.status}`);
}

async function transcribe(key: string, audioB64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "speech.mp3");
  form.append("model", "openai/gpt-transcribe");
  form.append("languages", "ar");
  form.append("stream", "true");
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });
  if (!res.ok) await gatewayFail(res, "فشل تفريغ الصوت");
  return readSse(res, (ev) => {
    if (ev.type === "transcript.text.delta") return { delta: String(ev.delta ?? "") };
    if (ev.type === "transcript.text.done") return { done: String(ev.text ?? "") };
    return null;
  });
}

async function readSse(
  res: Response,
  pick: (ev: Record<string, unknown>) => { delta?: string; done?: string } | null,
): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let final: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "error" || ev.type === "response.failed") throw new GatewayError(500, ev?.error?.message || "AI error");
        const p = pick(ev);
        if (p?.delta) out += p.delta;
        if (p?.done != null) final = p.done;
      } catch (e) {
        if (e instanceof GatewayError) throw e;
      }
    }
  }
  return final ?? out;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "actor", "source", "gif_keywords"],
  properties: {
    title: { type: "string", description: "عنوان قصير جذاب للقفشة بالعربية، مثل: قفشة بوحة" },
    actor: { type: "string", description: "اسم الممثل الأرجح بالعربية، أو فارغ إن لم يُعرف" },
    source: { type: "string", description: "اسم الفيلم/المسرحية/المسلسل مع نوعه، مثل: فيلم بوحة، أو فارغ" },
    gif_keywords: { type: "array", items: { type: "string" }, description: "3-6 English emotion/semantic GIF search keywords" },
  },
};

async function analyze(key: string, transcript: string) {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions:
        "أنت خبير في السينما والمسرح العربي، خاصة المصري. ستتلقى نصاً مفرّغاً من مقطع صوتي/فيديو قصير (قفشة). " +
        "تعرّف على المشهد الأشهر المطابق إن أمكن، واقترح عنواناً قصيراً، واسم الممثل، واسم العمل الأصلي. " +
        "لا تختلق إن لم تكن متأكداً: اترك الحقل فارغاً. كلمات GIF تكون بالإنجليزية وتعبّر عن المشاعر والسياق (مثل Sarcastic, Angry Laugh) ويمكن إضافة اسم الممثل بالإنجليزية.",
      input: [{ role: "user", content: `النص المفرّغ:\n${transcript || "(لا يوجد كلام واضح)"}` }],
      text: { format: { type: "json_schema", name: "clip_meta", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok) await gatewayFail(res, "فشل التحليل");
  const text = await readSse(res, (ev) => {
    if (ev.type === "response.output_text.delta") return { delta: String(ev.delta ?? "") };
    return null;
  });
  const j = JSON.parse(text) as { title: string; actor: string; source: string; gif_keywords: string[] };
  return j;
}

export const analyzeClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ audio: z.string().min(10).max(6_000_000) }).parse(i))
  .handler(async ({ data }): Promise<ClipSuggestion> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const transcript = (await transcribe(key, data.audio)).trim();
    const meta = await analyze(key, transcript);
    return {
      transcript,
      title: meta.title ?? "",
      actor: meta.actor ?? "",
      source: meta.source ?? "",
      gifKeywords: (meta.gif_keywords ?? []).slice(0, 6),
    };
  });

export type GifResult = { id: string; url: string; preview: string };

export const searchGifs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ keywords: z.array(z.string().max(60)).min(1).max(6) }).parse(i))
  .handler(async ({ data }): Promise<{ gifs: GifResult[]; missingKey?: boolean }> => {
    const key = process.env["GIPHY_API_KEY"];
    if (!key) return { gifs: [], missingKey: true };
    const seen = new Set<string>();
    const gifs: GifResult[] = [];
    const results = await Promise.all(
      data.keywords.slice(0, 3).map(async (q) => {
        const u = new URL("https://api.giphy.com/v1/gifs/search");
        u.search = new URLSearchParams({ api_key: key, q, limit: "4", rating: "pg-13" }).toString();
        const r = await fetch(u);
        if (!r.ok) return [];
        const j = (await r.json()) as { data?: { id: string; images: Record<string, { url?: string }> }[] };
        return j.data ?? [];
      }),
    );
    for (const list of results)
      for (const g of list) {
        const url = g.images["downsized"]?.url || g.images["original"]?.url;
        const preview = g.images["fixed_width"]?.url || url;
        if (!url || !preview || seen.has(g.id)) continue;
        seen.add(g.id);
        gifs.push({ id: g.id, url, preview });
      }
    return { gifs: gifs.slice(0, 6) };
  });
