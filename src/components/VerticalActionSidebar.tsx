import { useEffect, useId, useState } from "react";
import { Bookmark, Sparkles, Share2, Eye, Droplet, Sparkle } from "lucide-react";
import { toast } from "sonner";
import {
  DIALECT_REACTIONS,
  detectDialect,
  getClipEngagement,
  saveClipEngagement,
  type ClipEngagementState,
  type DialectKey,
} from "@/lib/dialect-reactions";
import { shareClip, type Clip } from "@/lib/clips";
import { cn } from "@/lib/utils";

export type VerticalActionSidebarProps = {
  clip?: Partial<Clip> | null;
  clipTitle?: string;
  clipAuthor?: string;
  clipSource?: string;
  clipId?: string;
  dialect?: DialectKey;
  bgMode?: "blurred" | "transparent";
  onToggleBgMode?: () => void;
  className?: string;
};

export function VerticalActionSidebar({
  clip,
  clipTitle,
  clipAuthor,
  clipSource,
  clipId,
  dialect: forcedDialect,
  bgMode = "blurred",
  onToggleBgMode,
  className,
}: VerticalActionSidebarProps) {
  const effectiveId = clipId || clip?.id || "preview-clip";
  const title = clipTitle || clip?.title || "قفشة";
  const combinedText = `${title} ${clipAuthor || clip?.author || ""} ${clipSource || clip?.source || ""} ${clip?.category || ""}`;

  // Dialect resolution
  const dialectKey: DialectKey = forcedDialect || detectDialect(combinedText);
  const dialectPair = DIALECT_REACTIONS[dialectKey] || DIALECT_REACTIONS.egyptian;

  // Engagement state
  const [engagement, setEngagement] = useState<ClipEngagementState>(() =>
    getClipEngagement(effectiveId),
  );
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [burstEmoji, setBurstEmoji] = useState<string | null>(null);

  useEffect(() => {
    setEngagement(getClipEngagement(effectiveId));
  }, [effectiveId]);

  const handleSelectReaction = (type: "positive" | "negative") => {
    const isSame = engagement.reaction === type;
    const selected = dialectPair[type];

    const nextState: ClipEngagementState = {
      ...engagement,
      reaction: isSame ? null : type,
      reactionLabel: isSame ? null : selected.label,
      reactionEmoji: isSame ? null : selected.emoji,
      positiveCount:
        type === "positive"
          ? isSame
            ? Math.max(0, engagement.positiveCount - 1)
            : engagement.positiveCount + 1
          : engagement.reaction === "positive"
            ? Math.max(0, engagement.positiveCount - 1)
            : engagement.positiveCount,
      negativeCount:
        type === "negative"
          ? isSame
            ? Math.max(0, engagement.negativeCount - 1)
            : engagement.negativeCount + 1
          : engagement.reaction === "negative"
            ? Math.max(0, engagement.negativeCount - 1)
            : engagement.negativeCount,
    };

    setEngagement(nextState);
    saveClipEngagement(effectiveId, nextState);
    setShowReactionMenu(false);

    if (!isSame) {
      setBurstEmoji(selected.emoji);
      setTimeout(() => setBurstEmoji(null), 1200);
      toast.success(`تم التفاعل: ${selected.label}`);
    } else {
      toast.info("تم إلغاء التفاعل");
    }
  };

  const handleToggleFavorite = () => {
    const nextState: ClipEngagementState = {
      ...engagement,
      isFavorite: !engagement.isFavorite,
    };
    setEngagement(nextState);
    saveClipEngagement(effectiveId, nextState);
    if (!engagement.isFavorite) {
      toast.success("تمت الإضافة إلى المفضلة ❤️");
    } else {
      toast.info("تمت الإزالة من المفضلة");
    }
  };

  const handleShare = async () => {
    const nextState: ClipEngagementState = {
      ...engagement,
      shareCount: engagement.shareCount + 1,
    };
    setEngagement(nextState);
    saveClipEngagement(effectiveId, nextState);

    if (clip && clip.title && clip.mediaUrl) {
      await shareClip(clip as Clip);
    } else {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("تم نسخ رابط القفشة! 🔗");
      } else {
        toast.success("تمت المشاركة!");
      }
    }
  };

  return (
    <div
      className={cn(
        "absolute right-2 sm:right-3 bottom-14 z-30 flex flex-col items-center gap-3 select-none pointer-events-auto",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Floating burst emoji on reaction */}
      {burstEmoji && (
        <div className="pointer-events-none absolute -top-12 right-0 text-3xl animate-bounce duration-700">
          {burstEmoji}
        </div>
      )}

      {/* 1. REACTION BUTTON (App Logo) */}
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowReactionMenu((v) => !v)}
          title="تفاعل مع القفشة"
          aria-label="تفاعل مع القفشة"
          className={cn(
            "group relative flex size-11 items-center justify-center rounded-full p-1 transition-all duration-200 active:scale-90",
            "bg-black/60 backdrop-blur-md border border-white/20 shadow-lg",
            engagement.reaction === "positive" && "border-emerald-400 ring-2 ring-emerald-400/50",
            engagement.reaction === "negative" && "border-rose-400 ring-2 ring-rose-400/50",
          )}
        >
          <img
            src="/logo-clown.png"
            alt="شعار التطبيق"
            className="size-8 object-contain transition-transform group-hover:scale-110 drop-shadow"
          />
          {engagement.reactionEmoji && (
            <span className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full bg-background text-[10px] shadow">
              {engagement.reactionEmoji}
            </span>
          )}
        </button>
        <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow">
          {engagement.reaction === "negative" ? engagement.negativeCount : engagement.positiveCount}
        </span>

        {/* Reaction Popover Menu */}
        {showReactionMenu && (
          <div
            className="absolute bottom-12 right-0 z-50 w-64 rounded-2xl border border-white/20 bg-background/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 text-right"
            dir="rtl"
          >
            <div className="mb-2 border-b border-border/50 pb-1.5 px-1 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-primary" />
                تفاعل بلهجة المقطع
              </span>
              <span className="text-[9px] text-muted-foreground">اضغط للاختيار</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {/* Positive Dialect Reaction */}
              <button
                type="button"
                onClick={() => handleSelectReaction("positive")}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl p-2 text-right transition-all text-xs font-bold active:scale-95",
                  engagement.reaction === "positive"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                    : "bg-surface hover:bg-emerald-500/10 text-foreground border border-transparent hover:border-emerald-500/30",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{dialectPair.positive.emoji}</span>
                  <span className="truncate">{dialectPair.positive.label}</span>
                </div>
                <span className="text-[10px] opacity-75 tabular-nums">
                  {engagement.positiveCount}
                </span>
              </button>

              {/* Negative Dialect Reaction */}
              <button
                type="button"
                onClick={() => handleSelectReaction("negative")}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl p-2 text-right transition-all text-xs font-bold active:scale-95",
                  engagement.reaction === "negative"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm"
                    : "bg-surface hover:bg-rose-500/10 text-foreground border border-transparent hover:border-rose-500/30",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{dialectPair.negative.emoji}</span>
                  <span className="truncate">{dialectPair.negative.label}</span>
                </div>
                <span className="text-[10px] opacity-75 tabular-nums">
                  {engagement.negativeCount}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. FAVORITE BUTTON (Bookmark) */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={handleToggleFavorite}
          title={engagement.isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          aria-label="المفضلة"
          className={cn(
            "flex size-11 items-center justify-center rounded-full p-2.5 transition-all duration-200 active:scale-90",
            "bg-black/60 backdrop-blur-md border border-white/20 shadow-lg",
            engagement.isFavorite
              ? "text-amber-400 border-amber-400/80 ring-2 ring-amber-400/40"
              : "text-white hover:text-amber-300",
          )}
        >
          <Bookmark
            className={cn(
              "size-5 transition-transform",
              engagement.isFavorite && "fill-amber-400 scale-110",
            )}
          />
        </button>
        <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow">
          {engagement.isFavorite ? "مفضلة" : "حفظ"}
        </span>
      </div>

      {/* 3. SHARE BUTTON (Share + dynamic counter) */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={handleShare}
          title="مشاركة القفشة"
          aria-label="مشاركة القفشة"
          className="flex size-11 items-center justify-center rounded-full bg-black/60 p-2.5 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all duration-200 hover:text-primary active:scale-90"
        >
          <Share2 className="size-5" />
        </button>
        <span className="mt-0.5 text-[10px] font-bold text-white drop-shadow tabular-nums">
          {engagement.shareCount}
        </span>
      </div>

      {/* 4. BACKGROUND BLUR / TRANSPARENT TOGGLE (Optional/Responsive) */}
      {onToggleBgMode && (
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleBgMode}
            title={
              bgMode === "blurred"
                ? "تبديل إلى الخلفية الشفافة"
                : "تبديل إلى الانعكاس الضبابي المتزامن"
            }
            aria-label="نمط خلفية المشغل"
            className={cn(
              "flex size-9 items-center justify-center rounded-full p-2 transition-all duration-200 active:scale-90",
              "bg-black/60 backdrop-blur-md border border-white/20 shadow-md",
              bgMode === "blurred"
                ? "text-primary border-primary/60 ring-1 ring-primary/40"
                : "text-muted-foreground hover:text-white",
            )}
          >
            <Droplet className="size-4" />
          </button>
          <span className="mt-0.5 text-[9px] font-semibold text-white/80 drop-shadow">
            {bgMode === "blurred" ? "ضبابي" : "شفاف"}
          </span>
        </div>
      )}
    </div>
  );
}
