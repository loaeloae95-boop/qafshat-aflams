import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const CLIP_CATEGORIES = ["كوميدي", "حزين", "دراما", "كرتون", "كوميدي حزين"] as const;
export const ALL = "الكل";

export type Clip = {
  id: string;
  title: string;
  author: string | null;
  source: string | null;
  category: string | null;
  mediaType: "audio" | "video";
  mediaUrl: string;
  coverUrl: string | null;
  gifUrl: string | null;
  duration: string;
  plays: number;
  likes: number;
  userId: string;
  gradient: string;
  createdAt: string;
};

const GRADIENTS = ["gradient-violet", "gradient-teal", "gradient-amber", "gradient-rose", "gradient-indigo", "gradient-lime"];

function fmt(sec: number | null) {
  const s = Number(sec ?? 0);
  if (!s) return "";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

const isExternal = (p: string | null) => !!p && /^https?:\/\//.test(p);

export function useClips() {
  return useQuery<Clip[]>({
    queryKey: ["clips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clips").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const paths = Array.from(
        new Set(rows.flatMap((r) => [r.media_url, r.cover_url, r.gif_url]).filter((p): p is string => !!p && !isExternal(p))),
      );
      const signed = new Map<string, string>();
      if (paths.length) {
        const { data: urls } = await supabase.storage.from("media").createSignedUrls(paths, 60 * 60 * 24);
        urls?.forEach((u) => u.path && u.signedUrl && signed.set(u.path, u.signedUrl));
      }
      const resolve = (p: string | null) => (!p ? null : isExternal(p) ? p : (signed.get(p) ?? null));
      return rows.map((r, i) => ({
        id: r.id,
        title: r.title,
        author: r.author,
        source: r.source,
        category: r.category,
        mediaType: r.media_type === "audio" ? "audio" : "video",
        mediaUrl: resolve(r.media_url) ?? "",
        coverUrl: resolve(r.cover_url),
        gifUrl: resolve(r.gif_url),
        duration: fmt(r.duration_seconds),
        plays: r.plays_count,
        likes: r.likes_count,
        userId: r.user_id,
        gradient: GRADIENTS[i % GRADIENTS.length] ?? "gradient-violet",
        createdAt: r.created_at,
      }));
    },
  });
}

export function filterClips(clips: Clip[], query: string, category: string) {
  const q = query.trim().toLowerCase();
  return clips.filter((c) => {
    if (category !== ALL && c.category !== category) return false;
    if (!q) return true;
    return [c.title, c.author, c.source, c.category].some((v) => v?.toLowerCase().includes(q));
  });
}

export function useDeleteClip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clips"] });
      toast.success("تم حذف القفشة");
    },
    onError: () => toast.error("تعذر حذف القفشة"),
  });
}

export async function shareClip(clip: Clip) {
  const url = clip.mediaUrl;
  const text = `${clip.title}${clip.source ? ` — ${clip.source}` : ""} | قفشات أفلام`;
  try {
    if (navigator.share) {
      // Try sharing the actual file first so it lands in WhatsApp etc. as media.
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = clip.mediaType === "audio" ? "mp3" : "mp4";
        const file = new File([blob], `${clip.title}.${ext}`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: clip.title, text });
          return;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
      await navigator.share({ title: clip.title, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط القفشة");
  } catch (e) {
    if ((e as Error).name !== "AbortError") toast.error("تعذرت المشاركة");
  }
}
