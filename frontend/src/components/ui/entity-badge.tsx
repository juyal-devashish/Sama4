import { ENTITY_LABELS, entityColor, entityKind } from "@/lib/utils";

interface EntityBadgeProps {
  type: string;
  label?: string;
}

/** Small uppercase type label in the term's ink, with a dot that matches its underline. */
export function EntityBadge({ type, label }: EntityBadgeProps) {
  const t = entityKind(type);
  const text = label ?? ENTITY_LABELS[t]?.one ?? type;
  return (
    <span className="kicker inline-flex items-center gap-1.5" style={{ color: entityColor(t) }}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: entityColor(t) }}
        aria-hidden
      />
      {text}
    </span>
  );
}
