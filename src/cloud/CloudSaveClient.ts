import type { GameSaveData } from "../game/storage";
import type { CloudIdentity } from "./identity";

export interface CloudSaveSnapshot {
  save: GameSaveData;
  revision: number;
  updatedAt: number;
}

export class CloudSaveConflictError extends Error {
  constructor(public readonly latest: CloudSaveSnapshot) {
    super("Cloud save revision conflict.");
    this.name = "CloudSaveConflictError";
  }
}

export class CloudSaveClient {
  constructor(
    private identity: CloudIdentity,
    private readonly baseUrl = "",
  ) {}

  setIdentity(identity: CloudIdentity): void {
    this.identity = identity;
  }

  async load(signal?: AbortSignal): Promise<CloudSaveSnapshot | null> {
    const response = await fetch(`${this.baseUrl}/api/save/${encodeURIComponent(this.identity.playerId)}`, {
      headers: { Authorization: `Bearer ${this.identity.token}` },
      cache: "no-store",
      signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cloud load failed (${response.status}).`);
    return response.json() as Promise<CloudSaveSnapshot>;
  }

  async save(save: GameSaveData, expectedRevision?: number): Promise<CloudSaveSnapshot> {
    const response = await fetch(`${this.baseUrl}/api/save/${encodeURIComponent(this.identity.playerId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.identity.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ save, expectedRevision }),
    });
    const body = await response.json() as CloudSaveSnapshot | { error?: string };
    if (response.status === 409 && "save" in body) throw new CloudSaveConflictError(body);
    if (!response.ok) throw new Error("error" in body && body.error ? body.error : `Cloud save failed (${response.status}).`);
    return body as CloudSaveSnapshot;
  }

  static chooseNewest(local: GameSaveData, remote: CloudSaveSnapshot | null): "local" | "remote" {
    if (!remote) return "local";
    return remote.save.updatedAt > local.updatedAt ? "remote" : "local";
  }
}
