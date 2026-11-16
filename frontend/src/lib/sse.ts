/** Parsing Server-Sent Events from a byte stream. Pure, so it is tested. */

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Pull complete events out of `buffer`, which is everything received so far and not yet
 * consumed. Returns them and what is left (a partial event waiting for more bytes).
 * Events are separated by a blank line; a `data:` value may span several lines.
 */
export function takeEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}
