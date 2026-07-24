import Phaser from "phaser";
import { AssetKeys } from "../config/assetKeys";
import { VisualDepth } from "../config/visualConfig";
import type { HookSnapshot } from "../simulation/simulationTypes";

export class Hook extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, AssetKeys.hook.head);
    this.setOrigin(0.5, 0.14).setDepth(VisualDepth.hook);
    scene.add.existing(this);
  }

  sync(hook: HookSnapshot): void {
    this.setPosition(hook.x, hook.y);
    this.setRotation(-hook.angle);
    this.setScale(hook.state === "destroying" ? 0.82 : 1);
    this.setAlpha(hook.state === "destroying" ? 0.55 : 1);
  }
}
