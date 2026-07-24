export const CLOUD_IDENTITY_KEY = "gold-miner:cloud-identity";

export interface CloudIdentity {
  playerId: string;
  token: string;
}

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function isCloudIdentity(value: unknown): value is CloudIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.playerId === "string" && PLAYER_ID_PATTERN.test(record.playerId)
    && typeof record.token === "string" && TOKEN_PATTERN.test(record.token);
}

export function createCloudIdentity(): CloudIdentity {
  return { playerId: crypto.randomUUID(), token: randomToken() };
}

export function serializeSyncKey(identity: CloudIdentity): string {
  if (!isCloudIdentity(identity)) throw new TypeError("Invalid cloud identity.");
  return `${identity.playerId}.${identity.token}`;
}

export function parseSyncKey(value: string): CloudIdentity | null {
  const separator = value.trim().indexOf(".");
  if (separator <= 0) return null;
  const candidate = {
    playerId: value.trim().slice(0, separator),
    token: value.trim().slice(separator + 1),
  };
  return isCloudIdentity(candidate) ? candidate : null;
}

export function loadOrCreateCloudIdentity(storage: Storage = window.localStorage): CloudIdentity {
  try {
    const raw = storage.getItem(CLOUD_IDENTITY_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isCloudIdentity(parsed)) return parsed;
    }
  } catch {
    // A new identity still keeps local play available when storage is damaged.
  }
  const identity = createCloudIdentity();
  saveCloudIdentity(identity, storage);
  return identity;
}

export function saveCloudIdentity(identity: CloudIdentity, storage: Storage = window.localStorage): void {
  if (!isCloudIdentity(identity)) throw new TypeError("Invalid cloud identity.");
  storage.setItem(CLOUD_IDENTITY_KEY, JSON.stringify(identity));
}
