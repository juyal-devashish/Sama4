// Refresh e2e/fixtures/api.json from a running, seeded backend:
//   (backend) make seed && make dev-backend      # http://localhost:8000
//   (frontend) node e2e/capture-fixtures.mjs
import fs from "node:fs";

const base = process.env.API_URL ?? "http://localhost:8000/api/v1";
const get = async (path) => {
  const res = await fetch(base + path);
  return res.status === 200 ? res.json() : null;
};

const feed = await get("/feed?limit=100");
const out = { feed, articles: {}, references: {}, context: {}, trending: [] };
for (const { id } of feed.articles) {
  const article = await get(`/articles/${id}`);
  out.articles[id] = article;
  out.references[id] = await get(`/articles/${id}/reference`);
  for (const e of article.entities ?? []) {
    out.context[e.id] ??= await get(`/context/${e.id}`);
  }
}
out.trending = (await get("/predictions/trending?limit=20")) ?? [];

fs.writeFileSync(new URL("./fixtures/api.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(`${feed.articles.length} articles, ${Object.keys(out.context).length} terms`);
