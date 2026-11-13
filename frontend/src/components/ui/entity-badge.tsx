import { ENTITY_LABELS, entityColor, entityKind } from "@/lib/utils";

interface EntityBadgeProps {
  type: string;
  label?: string;
}

/** Small type label: a coloured dot that matches the term's underline, then the type name. */
export function EntityBadge({ type, label }: EntityBadgeProps) {
  const t = entityKind(type);
  const text = label ?? ENTITY_LABELS[t]?.one ?? type;
  return (
    <span className="inline-flex items-center gap-1.5 font-editorial text-[12px] font-medium text-text-secondary">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: entityColor(t) }}
        aria-hidden
      />
      {text}
    </span>
  );
}
