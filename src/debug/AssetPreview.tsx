import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { ArtImage } from "../components/ArtImage";
import { ArtAssets } from "../config/artAssets";
import {
  ASSET_MANIFEST,
  getAssetDescriptor,
} from "../game/assets/assetManifest";
import { AssetKeys } from "../game/config/assetKeys";
import { Miner } from "../game/objects/Miner";
import {
  MINER_ANIMATIONS,
  MINER_ANIMATION_STATES,
  registerMinerAnimations,
} from "../game/systems/AnimationSystem";
import { AssetSystem } from "../game/systems/AssetSystem";

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 1500;

function statusLabel(placeholder: boolean): string {
  return placeholder ? "PLACEHOLDER" : "FORMAL";
}

class PreviewScene extends Phaser.Scene {
  private readonly assets = new AssetSystem();

  constructor() {
    super({ key: "asset-preview" });
  }

  preload(): void {
    this.assets.queue(this);
  }

  create(): void {
    this.assets.finalize(this);
    registerMinerAnimations(this);
    this.cameras.main.setBackgroundColor("#2f211a");
    this.add.text(36, 24, "PHASER ART PIPELINE · ASSET PREVIEW", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "26px",
      fontStyle: "800",
      color: "#fff2c2",
    });

    this.add.text(36, 62, "BACKGROUND LAYERS", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#efb65e",
    });
    const backgroundKeys = Object.values(AssetKeys.backgrounds);
    backgroundKeys.forEach((key, index) => {
      const descriptor = getAssetDescriptor(key);
      const x = 36 + (index % 2) * 610;
      const y = 100 + Math.floor(index / 2) * 174;
      this.add
        .image(x, y + 28, key)
        .setOrigin(0)
        .setDisplaySize(570, 118);
      this.add.text(
        x,
        y,
        `${key} · ${statusLabel(this.assets.isPlaceholder(key))}\norigin ${descriptor.origin.join("/")} · scale ${descriptor.scale}`,
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#f7d18a",
        },
      );
    });

    this.add.text(36, 615, "ITEM TEXTURES", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#efb65e",
    });
    const itemKeys = Object.values(AssetKeys.items);
    const itemStartY = 690;
    itemKeys.forEach((key, index) => {
      const descriptor = getAssetDescriptor(key);
      const x = 90 + (index % 5) * 235;
      const y = itemStartY + Math.floor(index / 5) * 155;
      this.add.image(x, y, key).setScale(1.15);
      const texture = this.textures.get(key).getSourceImage() as {
        width?: number;
        height?: number;
      };
      this.add
        .text(
          x,
          y + 58,
          `${key}\n${texture.width ?? "?"}×${texture.height ?? "?"} · ${statusLabel(this.assets.isPlaceholder(key))}\norigin ${descriptor.origin.join("/")} · scale ${descriptor.scale}`,
          {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#f3e4ca",
            align: "center",
          },
        )
        .setOrigin(0.5, 0);
    });

    this.add.text(36, 1_010, "MINER ANIMATION STATES", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#efb65e",
    });
    MINER_ANIMATION_STATES.forEach((state, index) => {
      const animation = MINER_ANIMATIONS[state];
      const miner = new Miner(this, 105 + index * 178, 1_205, false);
      miner.setScale(0.72);
      miner.playState(state);
      this.add
        .text(
          miner.x,
          1_245,
          `${state}\n${animation.frames}f · ${animation.frameRate} FPS · ${animation.loop ? "loop" : "once"}`,
          {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#ffe8aa",
            align: "center",
          },
        )
        .setOrigin(0.5, 0);
    });

    this.add.text(36, 1_320, "PARTICLE TEXTURES", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#efb65e",
    });
    Object.values(AssetKeys.particles).forEach((key, index) => {
      const descriptor = getAssetDescriptor(key);
      const x = 120 + index * 190;
      this.add.image(x, 1_390, key).setScale(2);
      this.add
        .text(
          x,
          1_420,
          `${key}\n${descriptor.width}×${descriptor.height} · ${statusLabel(this.assets.isPlaceholder(key))}`,
          {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#f3e4ca",
            align: "center",
          },
        )
        .setOrigin(0.5);
    });
  }
}

export function AssetPreview() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      scene: PreviewScene,
      backgroundColor: "#2f211a",
      banner: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
    });
    return () => game.destroy(true);
  }, []);

  return (
    <main className="asset-preview-page">
      <header>
        <p>DEVELOPMENT / VISUAL TEST ONLY</p>
        <h1>资源与动画预览</h1>
        <a href="/">返回游戏</a>
      </header>
      <section className="asset-preview-react">
        <div>
          <h2>React UI 图片</h2>
          <ArtImage asset={ArtAssets.menuMinerPortrait} />
          <p>
            状态：
            <strong>
              {ArtAssets.menuMinerPortrait.placeholder
                ? "占位资源"
                : "正式资源"}
            </strong>
          </p>
        </div>
        <div>
          <h2>Manifest 状态</h2>
          <p>
            {ASSET_MANIFEST.length} 项纹理资源；当前均可由本地占位回退。
          </p>
          <code>
            正式资源存在 → 正式纹理；加载失败或尚未配置 → fallbackKey
          </code>
          <p>人物动画共 {MINER_ANIMATION_STATES.length} 个状态。</p>
        </div>
      </section>
      <div ref={mountRef} className="asset-preview-canvas" />
    </main>
  );
}
