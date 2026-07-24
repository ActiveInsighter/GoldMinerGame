import Phaser from "phaser";
import { AssetKeys } from "../config/assetKeys";
import { BackgroundLayerConfig } from "../config/visualConfig";
import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH } from "../config/gameConfig";

interface LayerEntry {
  image: Phaser.GameObjects.Image;
  parallax: number;
  baseX: number;
}

export class BackgroundLayers extends Phaser.GameObjects.Container {
  private readonly layers: LayerEntry[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.addLayer(AssetKeys.backgrounds.sky, WORLD_WIDTH / 2, 0, BackgroundLayerConfig.sky);
    this.addLayer(AssetKeys.backgrounds.surface, WORLD_WIDTH / 2, 0, BackgroundLayerConfig.surface);
    this.addLayer(AssetKeys.backgrounds.mineFar, WORLD_WIDTH / 2, GROUND_Y, BackgroundLayerConfig.mineFar);
    this.addLayer(AssetKeys.backgrounds.mineMid, WORLD_WIDTH / 2, GROUND_Y, BackgroundLayerConfig.mineMid);
    this.addLayer(AssetKeys.backgrounds.mineSupports, WORLD_WIDTH / 2, GROUND_Y, BackgroundLayerConfig.mineSupports);
    this.addLayer(AssetKeys.backgrounds.mineFront, WORLD_WIDTH / 2, GROUND_Y, BackgroundLayerConfig.mineFront);
    this.setSize(WORLD_WIDTH, WORLD_HEIGHT);
  }

  sync(cameraX: number): void {
    const offset = cameraX - WORLD_WIDTH / 2;
    for (const layer of this.layers) layer.image.x = layer.baseX - offset * layer.parallax;
  }

  private addLayer(
    key: string,
    x: number,
    y: number,
    config: { depth: number; alpha: number; parallax: number },
  ): void {
    const image = this.scene.add.image(x, y, key).setOrigin(0.5, 0).setDepth(config.depth).setAlpha(config.alpha);
    this.layers.push({ image, parallax: config.parallax, baseX: x });
    this.add(image);
  }
}
