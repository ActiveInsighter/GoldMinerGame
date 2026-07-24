import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { ArtImage } from "../components/ArtImage";
import { ArtAssets } from "../config/artAssets";
import { ASSET_MANIFEST } from "../game/assets/assetManifest";
import { AssetKeys } from "../game/config/assetKeys";
import { Miner, type MinerAnimationState } from "../game/objects/Miner";
import { AssetSystem } from "../game/systems/AssetSystem";

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 1500;

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
    this.cameras.main.setBackgroundColor("#2f211a");
    this.add.text(36, 24, "PHASER ART PIPELINE · ASSET PREVIEW", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "26px",
      fontStyle: "800",
      color: "#fff2c2",
    });

    const backgroundKeys = Object.values(AssetKeys.backgrounds);
    backgroundKeys.forEach((key, index) => {
      const x = 36 + (index % 2) * 610;
      const y = 80 + Math.floor(index / 2) * 180;
      this.add.image(x, y + 26, key).setOrigin(0).setDisplaySize(570, 125);
      this.add.text(x, y, `${key} · placeholder`, { fontFamily: "monospace", fontSize: "14px", color: "#f7d18a" });
    });

    const itemKeys = Object.values(AssetKeys.items);
    const itemStartY = 650;
    itemKeys.forEach((key, index) => {
      const x = 90 + (index % 5) * 235;
      const y = itemStartY + Math.floor(index / 5) * 145;
      this.add.image(x, y, key).setScale(1.15);
      const texture = this.textures.get(key).getSourceImage() as { width?: number; height?: number };
      this.add.text(x, y + 58, `${key}\n${texture.width ?? "?"}×${texture.height ?? "?"}\norigin 0.5/0.5`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f3e4ca",
        align: "center",
      }).setOrigin(0.5, 0);
    });

    const states: MinerAnimationState[] = ["idle", "fire", "pull-light", "pull-heavy", "dynamite", "celebrate", "fail"];
    states.forEach((state, index) => {
      const miner = new Miner(this, 105 + index * 178, 1_170, false);
      miner.setScale(0.72);
      miner.playState(state);
      this.add.text(miner.x, 1_205, state, { fontFamily: "monospace", fontSize: "13px", color: "#ffe8aa" }).setOrigin(0.5);
    });

    Object.values(AssetKeys.particles).forEach((key, index) => {
      const x = 120 + index * 190;
      this.add.image(x, 1_330, key).setScale(2);
      this.add.text(x, 1_362, key, { fontFamily: "monospace", fontSize: "12px", color: "#f3e4ca" }).setOrigin(0.5);
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
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    });
    return () => game.destroy(true);
  }, []);

  return (
    <main className="asset-preview-page">
      <header>
        <p>DEVELOPMENT ONLY</p>
        <h1>资源与动画预览</h1>
        <a href="/">返回游戏</a>
      </header>
      <section className="asset-preview-react">
        <div>
          <h2>React UI 图片</h2>
          <ArtImage asset={ArtAssets.menuMinerPortrait} />
        </div>
        <div>
          <h2>Manifest 状态</h2>
          <p>{ASSET_MANIFEST.length} 项资源；当前均可由本地占位回退。</p>
          <code>正式资源存在 → 正式纹理；加载失败 → 同 Key 占位纹理</code>
        </div>
      </section>
      <div ref={mountRef} className="asset-preview-canvas" />
    </main>
  );
}
