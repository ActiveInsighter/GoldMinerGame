import Phaser from "phaser";
import { AssetSystem } from "./systems/AssetSystem";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { GameScene, type GameSceneHost } from "./scenes/GameScene";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./config/gameConfig";
import type {
  EngineOptions,
  EngineStats,
  GameMode,
  HookState,
  HudSnapshot,
  LevelResult,
  RandomEventType,
  SoundName,
} from "./simulation/simulationTypes";

export type {
  EngineOptions,
  EngineStats,
  GameMode,
  HookState,
  HudSnapshot,
  LevelResult,
  RandomEventType,
  SoundName,
};
export { WORLD_HEIGHT, WORLD_WIDTH };

/**
 * Public React-facing controller for the Phaser game.
 *
 * React owns only the mount element. Phaser creates its own visible canvas so
 * `Phaser.AUTO` can select WebGL or Canvas according to browser capabilities.
 * GameSimulation owns all per-frame state and no CanvasTexture bridge exists.
 */
export class GoldMinerEngine implements GameSceneHost {
  private readonly game: Phaser.Game;
  private scene?: GameScene;
  private startRequested = false;
  private destroyed = false;

  constructor(private readonly options: EngineOptions) {
    const suffix = crypto.randomUUID();
    const bootKey = `GoldMinerBoot-${suffix}`;
    const preloadKey = `GoldMinerPreload-${suffix}`;
    const gameKey = `GoldMinerGame-${suffix}`;
    const assets = new AssetSystem();

    options.parent.replaceChildren();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: options.parent,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: "#8f5f3d",
      scene: [
        new BootScene(bootKey, preloadKey),
        new PreloadScene(preloadKey, gameKey, assets),
        new GameScene(gameKey, options, this),
      ],
      banner: false,
      render: {
        antialias: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
      },
      input: {
        activePointers: 3,
      },
    });

    const canvas = this.game.canvas;
    canvas.classList.add("mine-canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "黄金矿工游戏区。按空格、方向下键或点击发射抓钩，D 键使用炸药，Esc 暂停。",
    );
  }

  attachScene(scene: GameScene): void {
    this.scene = scene;
    scene.setRunning(this.startRequested);
  }

  detachScene(scene: GameScene): void {
    if (this.scene === scene) this.scene = undefined;
  }

  shouldStartImmediately(): boolean {
    return this.startRequested;
  }

  start(): void {
    if (this.destroyed) return;
    this.startRequested = true;
    this.scene?.setRunning(true);
  }

  stop(): void {
    this.startRequested = false;
    this.scene?.setRunning(false);
    if (!this.destroyed) {
      this.destroyed = true;
      this.game.destroy(true);
    }
    this.scene = undefined;
  }

  fire(): boolean {
    return this.scene?.fire() ?? false;
  }

  useDynamite(): boolean {
    return this.scene?.useDynamite() ?? false;
  }

  setPaused(paused: boolean): void {
    this.scene?.setPaused(paused);
  }

  togglePaused(): void {
    this.scene?.togglePaused();
  }
}
