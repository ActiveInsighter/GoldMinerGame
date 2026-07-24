import Phaser from "phaser";
import {
  ASSET_MANIFEST,
  getAssetDescriptor,
  type RuntimeAssetDescriptor,
} from "../assets/assetManifest";
import { createPlaceholderTextures } from "../assets/createPlaceholderTextures";
import type { TextureAssetKey } from "../config/assetKeys";

export function resolveTextureKey(
  scene: Phaser.Scene,
  key: TextureAssetKey,
): TextureAssetKey {
  if (scene.textures.exists(key)) return key;
  const fallbackKey = getAssetDescriptor(key).fallbackKey;
  return scene.textures.exists(fallbackKey) ? fallbackKey : key;
}

export class AssetSystem {
  private readonly failed = new Set<string>();

  queue(scene: Phaser.Scene): void {
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failed.add(file.key);
      if (import.meta.env.DEV) {
        console.warn(
          `[assets] Failed to load ${file.key}; the local placeholder will be used.`,
        );
      }
    });
    for (const asset of ASSET_MANIFEST) this.queueAsset(scene, asset);
  }

  finalize(scene: Phaser.Scene): void {
    createPlaceholderTextures(scene);
    if (import.meta.env.DEV) {
      for (const asset of ASSET_MANIFEST) {
        if (
          !scene.textures.exists(asset.key) &&
          !scene.textures.exists(asset.fallbackKey)
        ) {
          console.warn(
            `[assets] Texture ${asset.key} and fallback ${asset.fallbackKey} are missing.`,
          );
        }
      }
    }
  }

  isPlaceholder(key: TextureAssetKey): boolean {
    const asset = getAssetDescriptor(key);
    return !asset.path || this.failed.has(key) || asset.placeholder;
  }

  private queueAsset(
    scene: Phaser.Scene,
    asset: RuntimeAssetDescriptor,
  ): void {
    if (!asset.path || asset.kind === "generated") return;
    if (asset.kind === "image") scene.load.image(asset.key, asset.path);
    else if (asset.kind === "spritesheet") {
      scene.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth ?? asset.width,
        frameHeight: asset.frameHeight ?? asset.height,
      });
    } else if (asset.kind === "atlas") {
      const dataPath =
        asset.dataPath ?? asset.path.replace(/\.(png|webp)$/u, ".json");
      scene.load.atlas(asset.key, asset.path, dataPath);
    }
  }
}
