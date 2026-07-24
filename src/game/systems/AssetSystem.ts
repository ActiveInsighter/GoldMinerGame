import Phaser from "phaser";
import { ASSET_MANIFEST, type RuntimeAssetDescriptor } from "../assets/assetManifest";
import { createPlaceholderTextures } from "../assets/createPlaceholderTextures";

export class AssetSystem {
  private readonly failed = new Set<string>();

  queue(scene: Phaser.Scene): void {
    scene.load.on(Phaser.Loader.Events.LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failed.add(file.key);
      if (import.meta.env.DEV) {
        console.warn(`[assets] Failed to load ${file.key}; the local placeholder will be used.`);
      }
    });
    for (const asset of ASSET_MANIFEST) this.queueAsset(scene, asset);
  }

  finalize(scene: Phaser.Scene): void {
    createPlaceholderTextures(scene);
    if (import.meta.env.DEV) {
      for (const asset of ASSET_MANIFEST) {
        if (!scene.textures.exists(asset.key)) {
          console.warn(`[assets] Texture ${asset.key} is still missing after fallback generation.`);
        }
      }
    }
  }

  isPlaceholder(key: string): boolean {
    const asset = ASSET_MANIFEST.find((entry) => entry.key === key);
    return !asset?.path || this.failed.has(key) || asset.placeholder;
  }

  private queueAsset(scene: Phaser.Scene, asset: RuntimeAssetDescriptor): void {
    if (!asset.path || asset.kind === "generated") return;
    if (asset.kind === "image") scene.load.image(asset.key, asset.path);
    else if (asset.kind === "spritesheet") {
      scene.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth ?? asset.width,
        frameHeight: asset.frameHeight ?? asset.height,
      });
    } else if (asset.kind === "atlas") {
      const dataPath = asset.path.replace(/\.(png|webp)$/u, ".json");
      scene.load.atlas(asset.key, asset.path, dataPath);
    }
  }
}
