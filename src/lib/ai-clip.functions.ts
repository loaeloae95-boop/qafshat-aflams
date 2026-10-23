import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";

export type ClipSuggestion = {
  transcript: string;
  title: string;
  actor: string;
  source: string;
  gifKeywords: string[];
};

export const analyzeClip = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ audio: z.string().min(10).max(10_000_000) }).parse(i))
  .handler(async ({ data }): Promise<ClipSuggestion> => {
    const empty: ClipSuggestion = {
      transcript: "",
      title: "",
      actor: "",
      source: "",
      gifKeywords: [],
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("analyzeClip: GEMINI_API_KEY is not defined in environment");
      return empty;
    }

    try {
      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "audio/mp3",
                  data: data.audio,
                },
              },
              {
                text: `أنت خبير أرشيفي متخصص وبارع في السينما والمسرح والتلفزيون العربي، وخاصة القفشات المصرية والكوميدية الأيقونية.
المطلوب منك بدقة:
1. استمع إلى المقطع الصوتي واكتب تفريغاً دقيقاً (transcript) للكلام المنطوق باللهجة الأصلية (مثل العامية المصرية).
2. تعرّف على المشهد الأصلي للقفشة، الممثل أو النجم الذي قالها، والعمل الفني الأصلي (فيلم، مسرحية، أو مسلسل).
3. استخرج البيانات التالية باللغة العربية:
   - title: عنوان أو اسم مشهور ومميز للقفشة (مثل: "يا عم إحنا بتوع ربنا"، "أنا مش قصير أنا أوزعة"، "قفشة بوحة"، "سلام يا صاحبي").
   - actor: اسم الممثل أو النجم العربي (مثل: عادل إمام، محمد سعد، أحمد حلمي، سعيد صالح، علاء ولي الدين، سمير غانم، أحمد مكي) أو فارغ إذا لم يُعرف.
   - source: اسم العمل مع تصنيفه (مثل: "فيلم بوحة"، "مسرحية مدرسة المشاغبين"، "فيلم الناظر"، "مسلسل الكبير أوي") أو فارغ إذا لم يُعرف.
   - gifKeywords: قائمة من 3 إلى 6 كلمات مفتاحية بالإنجليزية مناسبة للبحث عن صور متحركة معبرة عن المشهد ومشاعر القفشة (مثال: ["funny", "laughing", "egyptian comedy"]).
إذا لم يكن هناك كلام واضح في المقطع أو لم تتعرف على العمل، اترك الحقول النصية فارغة "".`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: {
                type: Type.STRING,
                description: "تفريغ الكلام العربي المنطوق بدقة",
              },
              title: {
                type: Type.STRING,
                description: "عنوان مشهور وجذاب للقفشة بالعربية",
              },
              actor: {
                type: Type.STRING,
                description: "اسم الممثل أو صاحب القفشة بالعربية",
              },
              source: {
                type: Type.STRING,
                description: "اسم الفيلم أو المسرحية أو المسلسل بالعربية",
              },
              gifKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-6 English keywords for searching expressive GIFs",
              },
            },
            required: ["transcript", "title", "actor", "source", "gifKeywords"],
          },
        },
      });

      const text = response.text?.trim() ?? "";
      if (!text) return empty;

      const parsed = JSON.parse(text) as {
        transcript?: string;
        title?: string;
        actor?: string;
        source?: string;
        gifKeywords?: string[];
      };

      return {
        transcript: parsed.transcript?.trim() ?? "",
        title: parsed.title?.trim() ?? "",
        actor: parsed.actor?.trim() ?? "",
        source: parsed.source?.trim() ?? "",
        gifKeywords: Array.isArray(parsed.gifKeywords) ? parsed.gifKeywords.slice(0, 6) : [],
      };
    } catch (err) {
      console.error("Gemini analyzeClip error:", err);
      return empty;
    }
  });

export type GifResult = { id: string; url: string; preview: string };

export const searchGifs = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ keywords: z.array(z.string().max(60)).min(1).max(6) }).parse(i))
  .handler(async ({ data }): Promise<{ gifs: GifResult[]; missingKey?: boolean }> => {
    const key = process.env["GIPHY_API_KEY"];
    if (!key) return { gifs: [], missingKey: true };
    const seen = new Set<string>();
    const gifs: GifResult[] = [];
    const qs = data.keywords.slice(0, 3);
    const per = String(Math.ceil(6 / qs.length) + 1);
    const results = await Promise.all(
      qs.map(async (q) => {
        const u = new URL("https://api.giphy.com/v1/gifs/search");
        u.search = new URLSearchParams({ api_key: key, q, limit: per, rating: "pg-13" }).toString();
        const r = await fetch(u.toString());
        if (!r.ok) {
          console.error("giphy", r.status);
          return [];
        }
        const j = (await r.json()) as {
          data?: { id: string; images: Record<string, { url?: string }> }[];
        };
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
