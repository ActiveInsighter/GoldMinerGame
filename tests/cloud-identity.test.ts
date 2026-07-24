import { describe, expect, it } from "vitest";
import { parseSyncKey, serializeSyncKey, type CloudIdentity } from "../src/cloud/identity";

const identity: CloudIdentity = {
  playerId: "1e36cf62-2250-4cc6-8870-01f58ebc1432",
  token: "abcdefghijklmnopqrstuvwxyz_0123456789-ABCDE",
};

describe("cloud identity", () => {
  it("round-trips a valid sync key", () => {
    expect(parseSyncKey(serializeSyncKey(identity))).toEqual(identity);
  });

  it("rejects malformed sync keys", () => {
    expect(parseSyncKey("not-a-key")).toBeNull();
    expect(parseSyncKey(`${identity.playerId}.short`)).toBeNull();
  });
});
