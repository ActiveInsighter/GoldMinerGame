import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the playable gold miner shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>黄金矿工：西部淘金记(?:｜黄金矿工)?<\/title>/i);
  assert.match(html, /黄金/);
  assert.match(html, /矿工/);
  assert.match(html, /开始淘金/);
  assert.match(html, /每日挑战/);
  assert.match(html, /无尽矿井/);
  assert.match(html, /成就与记录/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
