import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Music, Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CLIP_CATEGORIES } from "@/lib/clips";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "رفع قفشة — قفشات أفلام" },
      { name: "description", content: "ارفع قفشة فيديو أو صوت وشاركها مع الجميع." },
      { property: "og:title", content: "رفع قفشة — قفشات أفلام" },
      { property: "og:description", content: "ارفع قفشة فيديو أو صوت وشاركها مع الجميع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

function mediaDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { resolve(isFinite(el.duration) ? el.duration : null); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}

function Studio() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<"video" | "audio">("video");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [gifMode, setGifMode] = useState<"file" | "link">("file");
  const [gifFile, setGifFile] = useState<File | null>(null);
  const [gifLink, setGifLink] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && !user) return <AppShell><h1 className="font-display text-2xl font-extrabold">رفع قفشة</h1><SignInPrompt text="سجّل الدخول لرفع قفشاتك" /></AppShell>;

  const upload = async (f: File, kind: string) => {
    const ext = f.name.split(".").pop() || "bin";
    const path = `${user!.id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, f, { contentType: f.type });
    if (error) throw error;
    return path;
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!user || !file) { toast.error("اختر ملف القفشة"); return; }
    if (!title.trim()) { toast.error("اسم القفشة مطلوب"); return; }
    if (gifMode === "link" && gifLink && !/^https?:\/\//.test(gifLink)) { toast.error("رابط الصورة المتحركة غير صالح"); return; }
    setBusy(true);
    try {
      const [mediaPath, duration] = await Promise.all([upload(file, type), mediaDuration(file)]);
      const coverPath = cover ? await upload(cover, "cover") : null;
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
        duration_seconds: duration,
      });
      if (error) throw error;
      toast.success("تم رفع القفشة 🎉");
      await qc.invalidateQueries({ queryKey: ["clips"] });
      navigate({ to: "/library" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setBusy(false);
    }
  };

  const label = "mb-1 block text-xs font-bold";
  const opt = <span className="font-normal text-muted-foreground"> (اختياري)</span>;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-extrabold">رفع قفشة</h1>
      <form onSubmit={submit} className="glass-panel mt-5 space-y-4 rounded-3xl p-5">
        <div className="grid grid-cols-2 gap-2">
          {(["video", "audio"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setType(t); setFile(null); }}
              className={cn("flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold", type === t ? "gradient-violet shadow-glow" : "bg-surface text-muted-foreground")}>
              {t === "video" ? <Video className="size-4" /> : <Music className="size-4" />}
              {t === "video" ? "فيديو" : "صوت"}
            </button>
          ))}
        </div>

        <div>
          <label className={label}>ملف القفشة *</label>
          <input key={type} type="file" required accept={type === "video" ? "video/*" : "audio/*"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="field" />
        </div>

        <div>
          <label className={label}>اسم القفشة *</label>
          <input className="field" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: أنا مش قصير أنا كيوت" />
        </div>
        <div>
          <label className={label}>صاحب القفشة{opt}</label>
          <input className="field" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="اسم الممثل أو صاحب المقطع" />
        </div>
        <div>
          <label className={label}>من أين أخذت القفشة{opt}</label>
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
          <div className="rounded-2xl bg-surface p-3">
            <label className={label}>صورة متحركة (GIF) تظهر أثناء التشغيل{opt}</label>
            <div className="mb-2 flex gap-2 text-xs">
              {(["file", "link"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setGifMode(m)} className={cn("rounded-full px-3 py-1", gifMode === m ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                  {m === "file" ? "رفع ملف" : "رابط"}
                </button>
              ))}
            </div>
            {gifMode === "file" ? (
              <input type="file" accept="image/gif,image/*" onChange={(e) => setGifFile(e.target.files?.[0] ?? null)} className="field" />
            ) : (
              <input className="field" dir="ltr" value={gifLink} onChange={(e) => setGifLink(e.target.value)} placeholder="https://...gif" />
            )}
            {(gifFile || (gifMode === "link" && gifLink)) && (
              <img src={gifMode === "file" && gifFile ? URL.createObjectURL(gifFile) : gifLink} alt="" className="mt-2 h-28 rounded-xl object-cover" />
            )}
          </div>
        ) : (
          <div>
            <label className={label}>صورة الغلاف{opt}</label>
            <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="field" />
          </div>
        )}

        <button type="submit" disabled={busy} className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "جارٍ الرفع..." : "رفع القفشة"}
        </button>
      </form>
    </AppShell>
  );
}
