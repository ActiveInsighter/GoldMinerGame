import { handleSaveRequest } from "./save-api";
import type { Env } from "./types";

const SAVE_ROUTE = /^\/api\/save\/([^/]+)$/u;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "gold-miner-game" }, { headers: { "Cache-Control": "no-store" } });
    }

    const match = SAVE_ROUTE.exec(url.pathname);
    if (match?.[1]) {
      try {
        return await handleSaveRequest(request, env, decodeURIComponent(match[1]));
      } catch (error) {
        console.error("save-api-error", error);
        return Response.json({ error: "Cloud save service unavailable." }, { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "API route not found." }, { status: 404 });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
