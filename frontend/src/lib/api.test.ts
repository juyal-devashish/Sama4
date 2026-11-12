import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE, ApiError, api, apiPath } from "./api";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Partial<Response> | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { ok: true, status: 200, statusText: "OK", json: async () => ({}), ...response };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiPath", () => {
  it("prefixes /api/v1 and drops empty params", () => {
    expect(apiPath("/feed", { page: 2, limit: undefined, category: "" })).toBe(
      "/api/v1/feed?page=2",
    );
    expect(apiPath("/feed")).toBe("/api/v1/feed");
  });
});

describe("api", () => {
  it("getFeed omits the 'all' category", async () => {
    const fetchMock = stubFetch({ json: async () => ({ articles: [] }) });
    await api.getFeed({ page: 1, limit: 25, category: "all" });
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/feed?page=1&limit=25`, {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
  });

  it("POSTs JSON bodies with a content type", async () => {
    const fetchMock = stubFetch({});
    await api.explainEntity({ entity_id: "e", article_id: "a", question: "why?" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      entity_id: "e",
      article_id: "a",
      question: "why?",
    });
  });

  it("throws ApiError with the status on non-2xx", async () => {
    stubFetch({ ok: false, status: 404, statusText: "Not Found" });
    const err = await api.getArticle("missing").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).isNotFound).toBe(true);
  });

  it("throws ApiError with status 0 on network failure", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    const err = (await api.getArticle("x").catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(0);
    expect(err.message).toContain("Failed to fetch");
  });
});
