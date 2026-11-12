import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export const ENTITY_TYPES = ["person", "organization", "event", "concept", "location"] as const;

export const ENTITY_LABELS: Record<string, { one: string; many: string }> = {
  person: { one: "Person", many: "People" },
  organization: { one: "Organization", many: "Organizations" },
  event: { one: "Event", many: "Events" },
  concept: { one: "Concept", many: "Concepts" },
  location: { one: "Place", many: "Places" },
};

const KIND_ALIASES: Record<string, (typeof ENTITY_TYPES)[number]> = {
  person: "person",
  per: "person",
  org: "organization",
  organization: "organization",
  organisation: "organization",
  norp: "organization",
  event: "event",
  concept: "concept",
  misc: "concept",
  location: "location",
  loc: "location",
  gpe: "location",
  place: "location",
};

/** Map the backend's NER label (ORG, PERSON, GPE…) to one of the five display kinds. */
export function entityKind(type?: string): (typeof ENTITY_TYPES)[number] {
  return KIND_ALIASES[(type ?? "").toLowerCase()] ?? "concept";
}

export function entityColor(type?: string): string {
  return `var(--entity-${entityKind(type)})`;
}

export const RUNNING_PREDICTION_STATES = [
  "queued",
  "building_graph",
  "simulating",
  "generating_report",
];
