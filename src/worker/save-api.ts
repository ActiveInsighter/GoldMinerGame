import type { Env } from "./types";

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_SAVE_BYTES = 65_536;

interface SaveRow {
  player_id: string;
  token_hash: string;
  payload: string;
  revision: number;
  updated_at: number;
}

interface SaveWriteBody {
  save: Record<string, unknown>;
  expectedRevision?: number;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  const token = match?.[1]?.trim() ?? "";
  return TOKEN_PATTERN.test(token) ? token : null;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function parseSaveWriteBody(value: unknown): SaveWriteBody | null {
  if (!isRecord(value) || !isRecord(value.save)) return null;
  const expected = value.expectedRevision;
  if (expected !== undefined && (!Number.isInteger(expected) || (expected as number) < 0)) return null;
  return expected === undefined
    ? { save: value.save }
    : { save: value.save, expectedRevision: expected as number };
}

function snapshot(row: SaveRow): { save: Record<string, unknown>; revision: number; updatedAt: number } {
  return {
    save: JSON.parse(row.payload) as Record<string, unknown>,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

async function getRow(env: Env, playerId: string): Promise<SaveRow | null> {
  return env.DB.prepare(
    "SELECT player_id, token_hash, payload, revision, updated_at FROM player_saves WHERE player_id = ?1",
  ).bind(playerId).first<SaveRow>();
}

export async function handleSaveRequest(request: Request, env: Env, playerId: string): Promise<Response> {
  if (!PLAYER_ID_PATTERN.test(playerId)) return json({ error: "Invalid player id." }, 400);
  const token = readBearerToken(request);
  if (!token) return json({ error: "Missing or invalid authorization." }, 401);
  const tokenHash = await hashToken(token);
  const existing = await getRow(env, playerId);

  if (request.method === "GET") {
    if (!existing) return json({ error: "Cloud save not found." }, 404);
    if (existing.token_hash !== tokenHash) return json({ error: "Invalid authorization." }, 401);
    return json(snapshot(existing));
  }

  if (request.method !== "PUT") return json({ error: "Method not allowed." }, 405);
  if (existing && existing.token_hash !== tokenHash) return json({ error: "Invalid authorization." }, 401);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_SAVE_BYTES) return json({ error: "Save is too large." }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const body = parseSaveWriteBody(parsed);
  if (!body) return json({ error: "Invalid save payload." }, 400);

  const payload = JSON.stringify(body.save);
  const now = Date.now();

  if (!existing) {
    if (body.expectedRevision !== undefined && body.expectedRevision !== 0) {
      return json({ error: "Revision conflict." }, 409);
    }
    await env.DB.prepare(
      "INSERT INTO player_saves (player_id, token_hash, payload, revision, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?4)",
    ).bind(playerId, tokenHash, payload, now).run();
  } else {
    if (body.expectedRevision !== undefined && body.expectedRevision !== existing.revision) {
      return json(snapshot(existing), 409);
    }
    const result = await env.DB.prepare(
      "UPDATE player_saves SET payload = ?1, revision = revision + 1, updated_at = ?2 WHERE player_id = ?3 AND revision = ?4",
    ).bind(payload, now, playerId, existing.revision).run();
    if ((result.meta?.changes ?? 0) !== 1) {
      const latest = await getRow(env, playerId);
      return latest ? json(snapshot(latest), 409) : json({ error: "Save disappeared during update." }, 409);
    }
  }

  const saved = await getRow(env, playerId);
  return saved ? json(snapshot(saved)) : json({ error: "Save write failed." }, 500);
}
