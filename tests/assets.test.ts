import { describe, expect, it } from "vitest";
import {
  ALL_ANIMATION_KEYS,
  ALL_ASSET_KEYS,
  ALL_TEXTURE_KEYS,
  AssetKeys,
} from "../src/game/config/assetKeys";
import {
  ASSET_MANIFEST,
  ITEM_TEXTURE_KEYS,
  getAssetDescriptor,
} from "../src/game/assets/assetManifest";
import {
  PLACEHOLDER_ASSETS,
  assertPlaceholderManifestComplete,
  isPlaceholderAsset,
} from "../src/game/assets/placeholderManifest";
import { ITEM_CONFIGS } from "../src/game/model";
import {
  MINER_ANIMATIONS,
  MINER_ANIMATION_STATES,
} from "../src/game/systems/AnimationSystem";

describe("art asset manifest", () => {
  it("uses unique centralized keys", () => {
    expect(new Set(ALL_ASSET_KEYS).size).toBe(ALL_ASSET_KEYS.length);
  });

  it("provides a descriptor and local fallback for every texture key", () => {
    const manifestKeys = new Set(ASSET_MANIFEST.map((asset) => asset.key));
    for (const key of ALL_TEXTURE_KEYS) {
      expect(manifestKeys.has(key), `missing ${key}`).toBe(true);
      const descriptor = getAssetDescriptor(key);
      expect(descriptor.width).toBeGreaterThan(0);
      expect(descriptor.height).toBeGreaterThan(0);
      expect(manifestKeys.has(descriptor.fallbackKey)).toBe(true);
    }
    expect(getAssetDescriptor(AssetKeys.miner.atlas).fallbackKey).toBe(
      AssetKeys.miner.placeholder,
    );
  });

  it("provides metadata for every miner animation key", () => {
    const configuredKeys = MINER_ANIMATION_STATES.map(
      (state) => MINER_ANIMATIONS[state].key,
    );
    expect(configuredKeys.sort()).toEqual([...ALL_ANIMATION_KEYS].sort());
    for (const state of MINER_ANIMATION_STATES) {
      const animation = MINER_ANIMATIONS[state];
      expect(animation.frames).toBeGreaterThan(0);
      expect(animation.frameRate).toBeGreaterThan(0);
      expect(animation.framePrefix).toContain(state);
    }
  });

  it("maps every configured mine item to a distinguishable texture key", () => {
    const itemTypes = Object.keys(ITEM_CONFIGS) as Array<
      keyof typeof ITEM_CONFIGS
    >;
    expect(Object.keys(ITEM_TEXTURE_KEYS).sort()).toEqual(itemTypes.sort());
    expect(new Set(Object.values(ITEM_TEXTURE_KEYS)).size).toBe(
      itemTypes.length,
    );
    expect(ITEM_TEXTURE_KEYS.smallGold).toBe(AssetKeys.items.goldSmall);
    expect(ITEM_TEXTURE_KEYS.mediumGold).toBe(AssetKeys.items.goldMedium);
    expect(ITEM_TEXTURE_KEYS.largeGold).toBe(AssetKeys.items.goldLarge);
    expect(ITEM_TEXTURE_KEYS.mole).not.toBe(ITEM_TEXTURE_KEYS.diamondMole);
  });

  it("keeps placeholders complete while formal art is absent", () => {
    expect(() => assertPlaceholderManifestComplete()).not.toThrow();
    expect(PLACEHOLDER_ASSETS.length).toBe(ASSET_MANIFEST.length);
    for (const asset of ASSET_MANIFEST) {
      expect(isPlaceholderAsset(asset.key)).toBe(true);
      expect(asset.fallbackKey).toBeTruthy();
    }
  });
});
