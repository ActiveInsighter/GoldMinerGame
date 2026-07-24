import { ASSET_MANIFEST } from "./assetManifest";

export const PLACEHOLDER_ASSETS = ASSET_MANIFEST.filter((asset) => asset.placeholder);

export function isPlaceholderAsset(key: string): boolean {
  return PLACEHOLDER_ASSETS.some((asset) => asset.key === key);
}

export function assertPlaceholderManifestComplete(): void {
  const duplicate = PLACEHOLDER_ASSETS.find(
    (asset, index) => PLACEHOLDER_ASSETS.findIndex((entry) => entry.key === asset.key) !== index,
  );
  if (duplicate) throw new Error(`Duplicate placeholder asset key: ${duplicate.key}`);
}
