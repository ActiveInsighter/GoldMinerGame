import Phaser from "phaser";
import { AssetSystem } from "../systems/AssetSystem";

export class PreloadScene extends Phaser.Scene {
  constructor(
    key: string,
    private readonly nextSceneKey: string,
    private readonly assets: AssetSystem,
  ) {
    super({ key });
  }

  preload(): void {
    this.assets.queue(this);
  }

  create(): void {
    this.assets.finalize(this);
    this.scene.start(this.nextSceneKey);
  }
}
