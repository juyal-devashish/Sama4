import { describe, expect, it } from "vitest";
import { takeEvents } from "./sse";

describe("takeEvents", () => {
  it("reads complete events and leaves a partial one for later", () => {
    const { events, rest } = takeEvents(
      'event: delta\ndata: {"text":"Ada "}\n\nevent: delta\ndata: {"text":"wro',
    );
    expect(events).toEqual([{ event: "delta", data: '{"text":"Ada "}' }]);
    expect(rest).toBe('event: delta\ndata: {"text":"wro');
  });

  it("completes an event that arrived in two pieces", () => {
    const first = takeEvents('event: done\ndata: {"a"');
    expect(first.events).toEqual([]);
    const second = takeEvents(first.rest + ":1}\n\n");
    expect(second.events).toEqual([{ event: "done", data: '{"a":1}' }]);
    expect(second.rest).toBe("");
  });

  it("handles CRLF line endings, and an event name defaulting to message", () => {
    expect(takeEvents("data: hi\r\n\r\n").events).toEqual([{ event: "message", data: "hi" }]);
  });

  it("joins multi-line data and ignores comments and blocks without data", () => {
    const { events } = takeEvents(": keep-alive\n\nevent: x\ndata: a\ndata: b\n\n");
    expect(events).toEqual([{ event: "x", data: "a\nb" }]);
  });
});
