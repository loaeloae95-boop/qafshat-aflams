import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Music, Scissors, Search, Sparkles, Video } from "lucide-react";
import { GifPicker } from "@/components/GifPicker";
import { AppShell } from "@/components/AppShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { MediaTrimmer } from "@/components/MediaTrimmer";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CLIP_CATEGORIES } from "@/lib/clips";
import { analyzeClip, searchGifs, type ClipSuggestion, type GifResult } from "@/lib/ai-clip.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "رفع قفشة — قفشات أفلام" },
      { name: "description", content: "ارفع قفشة فيديو أو صوت، قصّها، ودع الذكاء الاصطناعي يقترح الاسم والممثل والفيلم." },
      { property: "og:title", content: "رفع قفشة — قفشات أفلام" },
      { property: "og:description", content: "ارفع قفشة فيديو أو صوت، قصّها، ودع الذكاء الاصطناعي يقترح الاسم والممثل والفيلم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

const MAX_SECONDS = 60;

type AiState = "idle" | "working" | "done" | "error";

function Studio() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeClip);
  const findGifs = useServerFn(searchGifs);
  const [type, setType] = useState<"video" | "audio">("video");
  const [file, setFile] = useState<File | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [duration, setDuration] = useState(0);
  const [cover, setCover] = useState<File | null>(null);
  const [gifMode, setGifMode] = useState<"file" | "link">("file");
  const [gifFile, setGifFile] = useState<File | null>(null);
  const [gifLink, setGifLink] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState("");
  const [ai, setAi] = useState<AiState>("idle");
  const [aiMsg, setAiMsg] = useState("");
  const [sugg, setSugg] = useState<ClipSuggestion | null>(null);
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifNote, setGifNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const gifFileUrl = useMemo(() => (gifFile ? URL.createObjectURL(gifFile) : null), [gifFile]);
  useEffect(() => () => { if (gifFileUrl) URL.revokeObjectURL(gifFileUrl); }, [gifFileUrl]);
  const gifPreview = gifMode === "file" ? gifFileUrl : gifLink || null;

  // Automatic background AI discovery once the media duration is known.
  useEffect(() => {
    if (!file || !duration || !user) return;
    let cancelled = false;
    (async () => {
      setAi("working"); setAiMsg("نستخرج الصوت..."); setSugg(null); setGifs([]); setGifNote("");
      try {
        const { extractSpeech, blobToBase64 } = await import("@/lib/media-tools");
        const speech = await extractSpeech(file, 0, Math.min(duration, MAX_SECONDS));
        if (cancelled) return;
        setAiMsg("نسمع القفشة ونتعرّف عليها...");
        const res = await analyze({ data: { audio: await blobToBase64(speech) } });
        if (cancelled) return;
        setSugg(res);
        setTitle((t) => t || res.title);
        setAuthor((a) => a || res.actor);
        setSource((s) => s || res.source);
        setAi("done");
        if (type === "audio" && res.gifKeywords.length) {
          const g = await findGifs({ data: { keywords: res.gifKeywords } });
          if (cancelled) return;
          setGifs(g.gifs);
          if (g.missingKey) setGifNote("اقتراحات الصور المتحركة تحتاج مفتاح Giphy.");
          else if (!g.gifs.length) setGifNote("لم نجد صوراً متحركة مناسبة.");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("AI analyze failed", err);
        setAi("idle");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, duration, user?.id]);

  if (!loading && !user) return <AppShell><h1 className="font-display text-2xl font-extrabold">رفع قفشة</h1><SignInPrompt text="سجّل الدخول لرفع قفشاتك" /></AppShell>;

  const upload = async (f: File, kind: string) => {
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${user!.id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (error) throw new Error(`فشل رفع الملف: ${error.message}`);
    return path;
  };

  const pickFile = (f: File | null) => { setFile(f); setDuration(0); setRange([0, 0]); setAi("idle"); setSugg(null); setGifs([]); };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !file) { toast.error("اختر ملف القفشة"); return; }
    if (!title.trim()) { toast.error("اسم القفشة مطلوب"); return; }
    if (gifMode === "link" && gifLink && !/^https?:\/\//.test(gifLink)) { toast.error("رابط الصورة المتحركة غير صالح"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("الملف أكبر من 50 ميجابايت"); return; }
    try {
      let final = file;
      let len: number | null = duration || null;
      const start = range[0];
      const end = Math.min(range[1] || duration, start + MAX_SECONDS);
      const trimmed = duration > 0 && (start > 0.05 || end < duration - 0.05);
      if (trimmed) {
        setBusy("جارٍ القص...");
        try {
          const { trimMedia } = await import("@/lib/media-tools");
          final = await trimMedia(file, start, end);
          len = end - start;
        } catch (err) {
          console.error("trim failed", err);
          if (duration > MAX_SECONDS + 0.5) { toast.error(`تعذّر القص — الحد الأقصى ${MAX_SECONDS} ثانية`); return; }
          final = file;
        }
      }
      setBusy("جارٍ الرفع...");
      const mediaPath = await upload(final, type);
      const coverPath = type === "video" && cover ? await upload(cover, "cover") : null;
      let gif: string | null = null;
      if (type === "audio") gif = gifMode === "file" ? (gifFile ? await upload(gifFile, "gif") : null) : gifLink.trim() || null;
      const { error } = await supabase.from("clips").insert({
        user_id: user.id,
        title: title.trim(),
        author: author.trim() || null,
        source: source.trim() || null,
        category: category || null,
        media_type: type,
        media_url: mediaPath,
        cover_url: coverPath,
        gif_url: gif,
        duration_seconds: len,
      });
      if (error) throw error;
      toast.success("تم رفع القفشة 🎉");
      await qc.invalidateQueries({ queryKey: ["clips"] });
      navigate({ to: "/library" });
    } catch (err) {
      console.error("upload failed", err);
      const m = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
      toast.error(m ? `فشل الرفع: ${m}` : "فشل الرفع");
    } finally {
      setBusy("");
    }
  };

  const label = "mb-1 block text-xs font-bold";
  const opt = <span className="font-normal text-muted-foreground"> (اختياري)</span>;
  const aiTag = (v: string, cur: string) =>
    sugg && v && v === cur ? <span className="ms-2 inline-flex items-center gap-1 rounded-full gradient-teal px-2 py-0.5 text-[10px] font-bold"><Sparkles className="size-3" />اقتراح AI</span> : null;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-extrabold">رفع قفشة</h1>
      <form onSubmit={submit} className="glass-panel mt-5 space-y-4 rounded-3xl p-5">
        <div className="grid grid-cols-2 gap-2">
          {(["video", "audio"] as const).map((t) => (
            <button key={t} type="button" onClick={(e) => { e.stopPropagation(); setType(t); pickFile(null); }}
              className={cn("flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold", type === t ? "gradient-violet shadow-glow" : "bg-surface text-muted-foreground")}>
              {t === "video" ? <Video className="size-4" /> : <Music className="size-4" />}
              {t === "video" ? "فيديو" : "صوت"}
            </button>
          ))}
        </div>

        <div>
          <label className={label}>ملف القفشة *</label>
          <input key={type} type="file" required accept={type === "video" ? "video/*" : "audio/*"} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="field" />
        </div>

        <Link to="/editor" className="flex items-center justify-center gap-2 rounded-2xl gradient-violet py-3 text-sm font-bold shadow-glow"><Scissors className="size-4" />المحرر — تعديل المقطع</Link>
        {file && (
          <MediaTrimmer file={file} type={type} gifUrl={gifPreview} range={range} onRange={(r) => setRange(r[1] - r[0] > MAX_SECONDS ? [r[0], r[0] + MAX_SECONDS] : r)} onDuration={(d) => { setDuration(d); setRange([0, Math.min(d, MAX_SECONDS)]); if (d > MAX_SECONDS) toast.info(`سيتم قص القفشة تلقائيًا إلى ${MAX_SECONDS} ثانية`); }} />
        )}
        {file && duration > MAX_SECONDS && (
          <p className="text-xs text-muted-foreground">الحد الأقصى {MAX_SECONDS} ثانية — حرّك المقبض لاختيار الجزء المطلوب.</p>
        )}

        {ai !== "idle" && (
          <div className={cn("flex items-center gap-2 rounded-2xl p-3 text-xs", ai === "error" ? "bg-destructive/20" : "gradient-indigo")}>
            {ai === "working" ? <Loader2 className="size-4 animate-spin" /> : ai === "done" ? <Sparkles className="size-4" /> : null}
            <span className="flex-1">
              {ai === "done" ? "اقترح الذكاء الاصطناعي الاسم والممثل والعمل — عدّلها كما تريد." : aiMsg}
            </span>
          </div>
        )}
        {sugg?.transcript && (
          <details className="rounded-2xl bg-surface p-3 text-xs" onClick={(e) => e.stopPropagation()}>
            <summary className="cursor-pointer font-bold">النص المسموع</summary>
            <p className="mt-2 leading-6 text-muted-foreground">{sugg.transcript}</p>
          </details>
        )}

        <div>
          <label className={label}>اسم القفشة *{aiTag(sugg?.title ?? "", title)}</label>
          <input className="field" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: أنا مش قصير أنا كيوت" />
        </div>
        <div>
          <label className={label}>صاحب القفشة{opt}{aiTag(sugg?.actor ?? "", author)}</label>
          <input className="field" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="اسم الممثل أو صاحب المقطع" />
        </div>
        <div>
          <label className={label}>من أين أخذت القفشة{opt}{aiTag(sugg?.source ?? "", source)}</label>
          <input className="field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="اسم الفيلم أو المسرحية" />
        </div>
        <div>
          <label className={label}>تصنيف القفشة{opt}</label>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">بدون تصنيف</option>
            {CLIP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {type === "audio" ? (
          <div className="space-y-2 rounded-2xl bg-surface p-3">
            {(gifs.length > 0 || gifNote) && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-bold"><Sparkles className="size-3" />اقتراحات غلاف متحرك من AI</p>
                {gifNote && <p className="text-xs text-muted-foreground">{gifNote}</p>}
                <div className="grid grid-cols-3 gap-2">
                  {gifs.map((g, i) => {
                    const on = gifMode === "link" && gifLink === g.url;
                    return (
                      <button key={g.id} type="button" onClick={(e) => { e.stopPropagation(); setGifMode("link"); setGifLink(g.url); }}
                        style={{ animationDelay: `${i * 60}ms` }}
                        className={cn("relative aspect-square overflow-hidden rounded-xl animate-in fade-in zoom-in-95", on && "ring-2 ring-primary")}>
                        <img src={g.preview} alt="" loading="lazy" className="size-full object-cover" />
                        {on && <span className="absolute left-1 top-1 rounded-full bg-primary p-0.5"><Check className="size-3" /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className={label}>صورة متحركة (GIF) تظهر أثناء التشغيل{opt}</label>
            <div className="flex gap-2 text-xs">
              {(["file", "link"] as const).map((m) => (
                <button key={m} type="button" onClick={(e) => { e.stopPropagation(); setGifMode(m); }} className={cn("rounded-full px-3 py-1", gifMode === m ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                  {m === "file" ? "رفع ملف" : "رابط"}
                </button>
              ))}
              <button type="button" onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
                className="flex items-center gap-1 rounded-full gradient-violet px-3 py-1 font-bold transition-transform hover:scale-105">
                <Search className="size-3" />بحث Giphy
              </button>
            </div>
            {gifMode === "file" ? (
              <input type="file" accept="image/gif,image/*" onChange={(e) => setGifFile(e.target.files?.[0] ?? null)} className="field" />
            ) : (
              <input className="field" dir="ltr" value={gifLink} onChange={(e) => setGifLink(e.target.value)} placeholder="https://...gif" />
            )}
            {gifMode === "link" && gifLink && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }} className="block w-24 overflow-hidden rounded-xl ring-2 ring-primary transition hover:opacity-80">
                <img src={gifLink} alt="" className="aspect-square w-full object-cover" />
              </button>
            )}
            <GifPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              initialKeywords={sugg?.gifKeywords.length ? sugg.gifKeywords : title.trim() ? [title.trim()] : []}
              selected={gifLink}
              onSelect={(url) => { setGifMode("link"); setGifLink(url); }}
            />
          </div>
        ) : (
          <div>
            <label className={label}>صورة الغلاف{opt}</label>
            <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="field" />
          </div>
        )}

        <button type="submit" disabled={!!busy} onClick={(e) => e.stopPropagation()} className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy || "رفع القفشة"}
        </button>
      </form>
    </AppShell>
  );
}
