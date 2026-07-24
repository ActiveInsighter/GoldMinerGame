import Phaser from "phaser";
import {
  GoldMinerEngine as CanvasMinerRuntime,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type EngineOptions,
  type EngineStats,
  type GameMode,
  type HookState,
  type HudSnapshot,
  type LevelResult,
  type RandomEventType,
  type SoundName,
} from "./canvas-runtime";

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

class RuntimeBridgeScene extends Phaser.Scene {
  private sourceCanvas?: HTMLCanvasElement;
  private textureKey = "";
  private texture?: Phaser.Textures.CanvasTexture;
  private runtime?: CanvasMinerRuntime;

  constructor(
    private readonly options: EngineOptions,
    private readonly owner: GoldMinerEngine,
  ) {
    super({ key: `GoldMinerBridge-${crypto.randomUUID()}` });
  }

  create(): void {
    const source = document.createElement("canvas");
    this.sourceCanvas = source;
    this.textureKey = `gold-miner-runtime-${crypto.randomUUID()}`;

    const runtime = new CanvasMinerRuntime({ ...this.options, canvas: source });
    this.runtime = runtime;
    const texture = this.textures.addCanvas(this.textureKey, source);
    if (!texture) throw new Error("Unable to create Phaser canvas texture.");
    this.texture = texture;

    this.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, this.textureKey)
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.primaryDown) runtime.fire();
    });

    this.events.once("shutdown", () => this.disposeRuntime());
    this.events.once("destroy", () => this.disposeRuntime());
    this.owner.attachRuntime(runtime);
  }

  update(): void {
    // Phaser's Canvas renderer reads the source canvas directly. Keeping this
    // fallback makes the bridge safe if the renderer is switched to WebGL.
    if (this.game.renderer.type === Phaser.WEBGL) this.texture?.refresh();
  }

  private disposeRuntime(): void {
    this.runtime?.stop();
    this.runtime = undefined;
    if (this.textureKey && this.textures.exists(this.textureKey)) {
      this.textures.remove(this.textureKey);
    }
    this.texture = undefined;
    this.sourceCanvas = undefined;
  }
}

/**
 * Phaser 4 host for the original feature-complete game runtime.
 *
 * The proven gameplay simulation and detailed procedural artwork render into
 * a high-DPI CanvasTexture, while Phaser owns the visible canvas, scene
 * lifecycle, scaling and pointer input. This keeps original behavior intact
 * without reducing the scene to placeholder circles and rectangles.
 */
export class GoldMinerEngine {
  private readonly game: Phaser.Game;
  private runtime?: CanvasMinerRuntime;
  private startRequested = false;
  private destroyed = false;

  constructor(private readonly options: EngineOptions) {
    const scene = new RuntimeBridgeScene(options, this);
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      canvas: options.canvas,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: "#8f5f3d",
      scene,
      banner: false,
      render: {
        antialias: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.NONE,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
      },
    });
  }

  attachRuntime(runtime: CanvasMinerRuntime): void {
    this.runtime = runtime;
    if (this.startRequested) runtime.start();
  }

  start(): void {
    if (this.destroyed) return;
    this.startRequested = true;
    this.runtime?.start();
  }

  stop(): void {
    this.startRequested = false;
    this.runtime?.stop();
    if (!this.destroyed) {
      this.destroyed = true;
      this.game.destroy(false);
    }
    this.runtime = undefined;
  }

  fire(): boolean {
    return this.runtime?.fire() ?? false;
  }

  useDynamite(): boolean {
    return this.runtime?.useDynamite() ?? false;
  }

  setPaused(paused: boolean): void {
    this.runtime?.setPaused(paused);
  }

  togglePaused(): void {
    this.runtime?.togglePaused();
  }
}
