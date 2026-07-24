import Phaser from "phaser";
import { ITEM_TEXTURE_KEYS } from "../assets/assetManifest";
import { ItemVisualScale, VisualDepth } from "../config/visualConfig";
import type { RuntimeMineItem } from "../simulation/simulationTypes";

export class MineItemView extends Phaser.GameObjects.Image {
  readonly itemId: string;
  private readonly baseScale: number;

  constructor(scene: Phaser.Scene, item: RuntimeMineItem) {
    super(scene, item.x, item.y, ITEM_TEXTURE_KEYS[item.type]);
    this.itemId = item.id;
    this.baseScale = ItemVisualScale[item.type] ?? 1;
    this.setDepth(VisualDepth.items);
    this.setOrigin(0.5);
    this.setScale(this.baseScale);
    this.sync(item, 0);
    scene.add.existing(this);
  }

  sync(item: RuntimeMineItem, elapsed: number): void {
    this.setPosition(item.x, item.y);
    this.setRotation(item.rotation + (item.state === "attached" ? Math.sin(elapsed * 8) * 0.08 : 0));
    this.setVisible(item.state === "active" || item.state === "attached");
    this.setFlipX((item.type === "mole" || item.type === "diamondMole") && item.vx < 0);
    const pulse = item.type === "diamond" || item.type === "diamondMole" ? 1 + Math.sin(item.flash * 4) * 0.045 : 1;
    this.setScale(this.baseScale * pulse);
    this.setAlpha(item.state === "attached" ? 0.96 : 1);
  }
}
