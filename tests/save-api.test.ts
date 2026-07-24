import { describe, expect, it } from "vitest";
import { hashToken, parseSaveWriteBody, readBearerToken } from "../src/worker/save-api";

describe("cloud save API validation", () => {
  it("accepts a versioned save body", () => {
    expect(parseSaveWriteBody({ save: { version: 2 }, expectedRevision: 3 })).toEqual({
      save: { version: 2 },
      expectedRevision: 3,
    });
  });

  it("rejects negative revisions and arrays", () => {
    expect(parseSaveWriteBody({ save: [], expectedRevision: 0 })).toBeNull();
    expect(parseSaveWriteBody({ save: {}, expectedRevision: -1 })).toBeNull();
  });

  it("reads bearer credentials and hashes deterministically", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz_0123456789-ABCDE";
    expect(readBearerToken(new Request("https://example.test", { headers: { Authorization: `Bearer ${token}` } }))).toBe(token);
    expect(await hashToken(token)).toBe(await hashToken(token));
  });
});
