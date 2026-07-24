import { AssetKeys, type AssetKey } from "../config/assetKeys";
import type { MineItemType } from "../model";

export type RuntimeAssetKind = "image" | "spritesheet" | "atlas" | "generated";

export interface RuntimeAssetDescriptor {
  key: AssetKey;
  kind: RuntimeAssetKind;
  path?: string;
  fallbackKey: AssetKey;
  width: number;
  height: number;
  transparent: boolean;
  placeholder: boolean;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
  origin: readonly [number, number];
  scale: number;
}

export const ITEM_TEXTURE_KEYS: Record<MineItemType, AssetKey> = {
  smallGold: AssetKeys.items.goldSmall,
  mediumGold: AssetKeys.items.goldMedium,
  largeGold: AssetKeys.items.goldLarge,
  diamond: AssetKeys.items.diamond,
  rock: AssetKeys.items.rock,
  mysteryChest: AssetKeys.items.chest,
  tnt: AssetKeys.items.tnt,
  mole: AssetKeys.items.mole,
  diamondMole: AssetKeys.items.diamondMole,
};

export const ASSET_MANIFEST: readonly RuntimeAssetDescriptor[] = [
  { key: AssetKeys.backgrounds.sky, kind: "generated", fallbackKey: AssetKeys.backgrounds.sky, width: 1280, height: 180, transparent: false, placeholder: true, origin: [0.5, 0], scale: 1 },
  { key: AssetKeys.backgrounds.surface, kind: "generated", fallbackKey: AssetKeys.backgrounds.surface, width: 1280, height: 150, transparent: true, placeholder: true, origin: [0.5, 0], scale: 1 },
  { key: AssetKeys.backgrounds.mineFar, kind: "generated", fallbackKey: AssetKeys.backgrounds.mineFar, width: 1280, height: 578, transparent: false, placeholder: true, origin: [0.5, 0], scale: 1 },
  { key: AssetKeys.backgrounds.mineMid, kind: "generated", fallbackKey: AssetKeys.backgrounds.mineMid, width: 1280, height: 578, transparent: true, placeholder: true, origin: [0.5, 0], scale: 1 },
  { key: AssetKeys.backgrounds.mineSupports, kind: "generated", fallbackKey: AssetKeys.backgrounds.mineSupports, width: 1280, height: 578, transparent: true, placeholder: true, origin: [0.5, 0], scale: 1 },
  { key: AssetKeys.backgrounds.mineFront, kind: "generated", fallbackKey: AssetKeys.backgrounds.mineFront, width: 1280, height: 578, transparent: true, placeholder: true, origin: [0.5, 0], scale: 1 },
  { key: AssetKeys.miner.placeholder, kind: "generated", fallbackKey: AssetKeys.miner.placeholder, width: 148, height: 178, transparent: true, placeholder: true, origin: [0.5, 0.92], scale: 1 },
  { key: AssetKeys.hook.head, kind: "generated", fallbackKey: AssetKeys.hook.head, width: 44, height: 46, transparent: true, placeholder: true, origin: [0.5, 0.14], scale: 1 },
  { key: AssetKeys.items.goldSmall, kind: "generated", fallbackKey: AssetKeys.items.goldSmall, width: 44, height: 38, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.goldMedium, kind: "generated", fallbackKey: AssetKeys.items.goldMedium, width: 64, height: 54, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.goldLarge, kind: "generated", fallbackKey: AssetKeys.items.goldLarge, width: 94, height: 78, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.rock, kind: "generated", fallbackKey: AssetKeys.items.rock, width: 68, height: 60, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.diamond, kind: "generated", fallbackKey: AssetKeys.items.diamond, width: 46, height: 50, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.chest, kind: "generated", fallbackKey: AssetKeys.items.chest, width: 70, height: 58, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.tnt, kind: "generated", fallbackKey: AssetKeys.items.tnt, width: 58, height: 68, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.mole, kind: "generated", fallbackKey: AssetKeys.items.mole, width: 68, height: 48, transparent: true, placeholder: true, origin: [0.5, 0.5], scale: 1 },
  { key: AssetKeys.items.diamondMole, kind: "generated", fallbackKey: AssetKeys.items.diamondMole, width: 72, height: 58, transparent: true, placeholder: true, origin: [0.5, 0.56], scale: 1 },
  ...Object.values(AssetKeys.particles).map((key) => ({ key, kind: "generated" as const, fallbackKey: key, width: 20, height: 20, transparent: true, placeholder: true, origin: [0.5, 0.5] as const, scale: 1 })),
];

export function getAssetDescriptor(key: AssetKey): RuntimeAssetDescriptor {
  const descriptor = ASSET_MANIFEST.find((entry) => entry.key === key);
  if (!descriptor) throw new Error(`Missing asset descriptor for ${key}`);
  return descriptor;
}
