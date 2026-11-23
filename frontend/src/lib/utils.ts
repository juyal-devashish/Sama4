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

/** "Nov 11, 2026, 7:00 AM": the exact time behind a relative "5h ago". */
export function formatExactTime(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Nov 11, 2026" */
export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export interface DateFormatOptions {
  locale?: string;
  /** IANA zone. Omit to use the reader's own (the browser's). */
  timeZone?: string;
}

/** "Saturday, November 14" */
export function formatLongDate(date = new Date(), { locale, timeZone }: DateFormatOptions = {}) {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

/** "Saturday" */
export function formatWeekday(date = new Date(), { locale, timeZone }: DateFormatOptions = {}) {
  return date.toLocaleDateString(locale, { weekday: "long", timeZone });
}

/** "November 14, 2026" */
export function formatFullDate(date = new Date(), { locale, timeZone }: DateFormatOptions = {}) {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
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

/**
 * Text for a meta description: whitespace collapsed, cut at a word boundary to at
 * most `max` characters (search engines show about 160), with an ellipsis if cut.
 */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

// Words whose full stop doesn't end a sentence. Mirrors backend/app/text.py.
const ABBREVIATIONS = new Set(
  "mr mrs ms dr prof sr jr st mt ft gov sen rep pres gen lt col maj capt sgt cmdr adm supt insp det rev hon jan feb mar apr jun jul aug sep sept oct nov dec vs inc corp co ltd bros dept univ approx est fig".split(
    " ",
  ),
);
const INITIALISM = /^(?:[A-Za-z]\.)+[A-Za-z]?\.?$/;

/**
 * A brief worth showing, or null. Briefs written before the backend kept to whole
 * sentences can be cut mid-sentence ("…agreed on Friday is a…", "Existing U.S.",
 * "…and Louisiana Gov."): hide those, and anything too short to say what the story is.
 */
export function displaySummary(summary: string | null | undefined): string | null {
  const text = summary?.trim();
  if (!text || text.length < 40) return null;
  if (text.endsWith("…") || text.endsWith("...")) return null;
  const last = text.split(/\s+/).pop() ?? "";
  if (
    last.endsWith(".") &&
    (INITIALISM.test(last) || ABBREVIATIONS.has(last.slice(0, -1).toLowerCase()))
  )
    return null;
  return text;
}
