import type { Clip } from "@/lib/clips";
import { ClipCard } from "./ClipCard";

export function ClipGrid({ clips, onDelete }: { clips: Clip[]; onDelete?: (c: Clip) => void }) {
  return (
    <>
      <section className="grid grid-cols-3 gap-2.5">
        {clips.map((c, i) => (
          <ClipCard key={c.id} clip={c} list={clips} index={i} onDelete={onDelete ? () => onDelete(c) : undefined} />
        ))}
      </section>
      {clips.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">نقرة واحدة للتشغيل · نقرتان لعرض ملء الشاشة</p>
      )}
    </>
  );
}
