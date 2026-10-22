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

const GRADIENTS = [
  "gradient-violet",
  "gradient-teal",
  "gradient-amber",
  "gradient-rose",
  "gradient-indigo",
  "gradient-lime",
];

function fmt(sec: number | null) {
  const s = Number(sec ?? 0);
  if (!s) return "";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

const isExternal = (p: string | null) => !!p && /^https?:\/\//.test(p);

export const DEFAULT_CLIPS: Clip[] = [
  {
    id: "clip-1",
    title: "صبح صبح يا عم الحج",
    author: "محمد سعد",
    source: "فيلم بوحة",
    category: "كوميدي",
    mediaType: "video",
    mediaUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    coverUrl: null,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTYycHpkNG9sYXpya3gzaHdxMjQ1NnpqNnhrcG96cHN5ZGlkOGd4dCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7TKSjRrfIPjeiVyM/giphy.gif",
    duration: "0:15",
    plays: 14200,
    likes: 3890,
    userId: "system",
    gradient: "gradient-violet",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "clip-2",
    title: "جاءنا البيان التالي وفاجعة كبرى",
    author: "محمد هنيدي",
    source: "فيلم جاءنا البيان التالي",
    category: "كوميدي",
    mediaType: "video",
    mediaUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    coverUrl: null,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHc3OTB0MmQ2d3E0Nmx4anFndTN4bmV4cnl1OGJidXlyOXg2dzRwNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/11ISwbgGL28MxNVxm/giphy.gif",
    duration: "0:12",
    plays: 28400,
    likes: 7200,
    userId: "system",
    gradient: "gradient-amber",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "clip-3",
    title: "أنا لا بكذب ولا بتجمل.. أنا بنهار!",
    author: "أحمد زكي",
    source: "فيلم زوجة رجل مهم",
    category: "دراما",
    mediaType: "video",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    coverUrl: null,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcndtc3V2cHp0OGF6aXF3bnVyNHJocm9tZXJ3NXAwOXVleTBqN2s3MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/d2lcHJTG5Tscg/giphy.gif",
    duration: "0:18",
    plays: 19800,
    likes: 5410,
    userId: "system",
    gradient: "gradient-rose",
    createdAt: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "clip-4",
    title: "شربات يا ورد.. شربات يا عسل",
    author: "عادل إمام",
    source: "فيلم الإرهاب والكباب",
    category: "كوميدي",
    mediaType: "video",
    mediaUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    coverUrl: null,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZpcjU4a3N0cnBxaXRpcGExd3ZkbnIzcGtydWw4ZTR6ajF4b3R5MSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0ExhcMymdiyIbNXq/giphy.gif",
    duration: "0:14",
    plays: 35100,
    likes: 9800,
    userId: "system",
    gradient: "gradient-teal",
    createdAt: "2026-01-04T00:00:00.000Z",
  },
  {
    id: "clip-5",
    title: "متعودة.. دايماً!",
    author: "عادل إمام",
    source: "مسرحية شاهد ما شفش حاجة",
    category: "كوميدي",
    mediaType: "video",
    mediaUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    coverUrl: null,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGgyaWw5MXFkMnkyMmtvd2YyaDZ6aDV4cGZ4cXF6cnE5Y2w2Z3d5NSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oEjHAUOqG3lSS0f1C/giphy.gif",
    duration: "0:10",
    plays: 41200,
    likes: 11200,
    userId: "system",
    gradient: "gradient-indigo",
    createdAt: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "clip-6",
    title: "كان يوم أسود يوم ما شوفتك",
    author: "أحمد حلمي",
    source: "فيلم كدة رضا",
    category: "كوميدي حزين",
    mediaType: "video",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    coverUrl: null,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXQ4aXk2ZXJvdmtxZzMzb3dkeW9icnV4ajVwM2cxeHFnNnJ3eTJjOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/OPU6wzx8JrHna/giphy.gif",
    duration: "0:16",
    plays: 16700,
    likes: 4200,
    userId: "system",
    gradient: "gradient-lime",
    createdAt: "2026-01-06T00:00:00.000Z",
  },
];

import { deleteLocalClip, getLocalClips, resolveLocalMediaUrl } from "@/lib/local-storage-db";

export function useClips() {
  return useQuery<Clip[]>({
    queryKey: ["clips"],
    queryFn: async () => {
      // 1. Load locally stored clips
      const localRows = getLocalClips();
      const localResolved: Clip[] = await Promise.all(
        localRows.map(async (r, i) => ({
          id: r.id,
          title: r.title,
          author: r.author,
          source: r.source,
          category: r.category,
          mediaType: r.media_type,
          mediaUrl: (await resolveLocalMediaUrl(r.media_url)) || "",
          coverUrl: r.cover_url ? await resolveLocalMediaUrl(r.cover_url) : null,
          gifUrl: r.gif_url ? await resolveLocalMediaUrl(r.gif_url) : null,
          duration: fmt(r.duration_seconds),
          plays: r.plays_count,
          likes: r.likes_count,
          userId: r.user_id,
          gradient: GRADIENTS[i % GRADIENTS.length] ?? "gradient-violet",
          createdAt: r.created_at,
        })),
      );

      // 2. Fetch from remote Supabase if available
      let remoteClips: Clip[] = [];
      try {
        const { data, error } = await supabase
          .from("clips")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) {
          const rows = data;
          const paths = Array.from(
            new Set(
              rows
                .flatMap((r) => [r.media_url, r.cover_url, r.gif_url])
                .filter((p): p is string => !!p && !isExternal(p)),
            ),
          );
          const signed = new Map<string, string>();
          if (paths.length) {
            try {
              const { data: urls } = await supabase.storage
                .from("media")
                .createSignedUrls(paths, 60 * 60 * 24);
              urls?.forEach((u) => u.path && u.signedUrl && signed.set(u.path, u.signedUrl));
            } catch {
              /* ignore storage sign error */
            }
          }
          const resolve = (p: string | null) =>
            !p ? null : isExternal(p) ? p : (signed.get(p) ?? null);
          remoteClips = rows.map((r, i) => ({
            id: r.id,
            title: r.title,
            author: r.author,
            source: r.source,
            category: r.category,
            mediaType: r.media_type === "audio" ? ("audio" as const) : ("video" as const),
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
        }
      } catch (err) {
        console.warn("[Clips] Could not fetch clips from Supabase, using local fallback", err);
      }

      // Merge, giving precedence to newly uploaded local clips
      const seen = new Set<string>();
      const combined: Clip[] = [];

      for (const c of [...localResolved, ...remoteClips]) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          combined.push(c);
        }
      }

      // Append default clips to ensure rich discovery catalog
      for (const d of DEFAULT_CLIPS) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          combined.push(d);
        }
      }

      return combined;
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
      deleteLocalClip(id);
      try {
        await supabase.from("clips").delete().eq("id", id);
      } catch {
        /* ignore remote error */
      }
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
