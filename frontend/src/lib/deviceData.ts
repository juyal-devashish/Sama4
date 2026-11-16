import type { SavedStory } from "./preferences";

/** Prefix of every key Samā4 keeps in the browser (preferences, saved stories, visit times). */
export const STORAGE_PREFIX = "sama4_";

const EXPORT_VERSION = 1;

/** The saved list as a file the reader can keep or move to another browser. */
export function exportSaved(saved: SavedStory[], now = new Date()): string {
  return JSON.stringify(
    { app: "sama4", version: EXPORT_VERSION, exported_at: now.toISOString(), saved },
    null,
    2,
  );
}

function isSavedStory(v: unknown): v is SavedStory {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    typeof s.title === "string" &&
    typeof s.source === "string" &&
    typeof s.saved_at === "string" &&
    !Number.isNaN(Date.parse(s.saved_at))
  );
}

export type ImportResult = { ok: true; stories: SavedStory[] } | { ok: false; error: string };

/** Read a file made by `exportSaved`. Anything that isn't one is refused, not half-applied. */
export function parseSavedImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a Samā4 saved-stories file." };
  }
  const list = (data as { saved?: unknown } | null)?.saved;
  if (!Array.isArray(list)) {
    return { ok: false, error: "That file isn't a Samā4 saved-stories file." };
  }
  const stories = list.filter(isSavedStory);
  if (list.length > 0 && stories.length === 0) {
    return { ok: false, error: "None of the stories in that file could be read." };
  }
  return { ok: true, stories };
}

/** Add imported stories to the saved list: no duplicates, the reader's own copy wins, newest first. */
export function mergeSaved(existing: SavedStory[], incoming: SavedStory[]): SavedStory[] {
  const have = new Set(existing.map((s) => s.id));
  const added = incoming.filter(
    (s, i) => !have.has(s.id) && incoming.findIndex((x) => x.id === s.id) === i,
  );
  return [...existing, ...added].sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

/** Names of the keys Samā4 owns in a Storage, for clearing. */
export function ownKeys(storage: Pick<Storage, "length" | "key">): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  return keys;
}
