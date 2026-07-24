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

const GROUND_Y = 142;
const MINER_MIN_X = 510;
const MINER_MAX_X = 770;

class RuntimeBridgeScene extends Phaser.Scene {
  private sourceCanvas?: HTMLCanvasElement;
  private textureKey = "";
  private texture?: Phaser.Textures.CanvasTexture;
  private runtime?: CanvasMinerRuntime;
  private miner?: Phaser.GameObjects.Container;
  private minerX = WORLD_WIDTH / 2;

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
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setDepth(0);

    this.createSurfaceLayer();
    this.createCartoonMiner();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.primaryDown) runtime.fire();
    });

    if (this.options.level.mode === "mole") {
      this.input.keyboard?.on("keydown-LEFT", () => this.moveMiner(-30));
      this.input.keyboard?.on("keydown-RIGHT", () => this.moveMiner(30));
    }

    this.events.once("shutdown", () => this.disposeRuntime());
    this.events.once("destroy", () => this.disposeRuntime());
    this.owner.attachRuntime(runtime);
  }

  update(): void {
    // Phaser's Canvas renderer reads the source canvas directly. Keeping this
    // fallback makes the bridge safe if the renderer is switched to WebGL.
    if (this.game.renderer.type === Phaser.WEBGL) this.texture?.refresh();
  }

  private createSurfaceLayer(): void {
    const surface = this.add.graphics().setDepth(20);
    surface.fillGradientStyle(0xffcf69, 0xffc45a, 0xeaa348, 0xe59a40, 1);
    surface.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);

    // Classic orange header light and the dark mine opening behind the miner.
    surface.fillStyle(0xffe59a, 0.2);
    surface.fillEllipse(WORLD_WIDTH * 0.18, -20, 620, 250);
    surface.fillStyle(0x34428d, 1);
    surface.fillCircle(this.minerX, GROUND_Y + 5, 112);
    surface.fillStyle(0x25326f, 1);
    surface.fillCircle(this.minerX, GROUND_Y + 8, 92);

    surface.fillStyle(0xb36e3f, 1);
    surface.fillRect(0, GROUND_Y - 11, WORLD_WIDTH, 11);
    surface.fillStyle(0x6d3d26, 1);
    surface.fillRect(0, GROUND_Y - 4, WORLD_WIDTH, 4);
    surface.lineStyle(2, 0xffe3a6, 0.35);
    surface.lineBetween(0, GROUND_Y - 12, WORLD_WIDTH, GROUND_Y - 12);
  }

  private createCartoonMiner(): void {
    const miner = this.add.container(this.minerX, GROUND_Y - 6).setDepth(22);
    this.miner = miner;

    const shadow = this.add.ellipse(4, 3, 170, 18, 0x2b1c16, 0.28);

    const legs = this.add.graphics();
    legs.fillStyle(0x5f341e, 1);
    legs.fillRoundedRect(15, -31, 27, 42, 11);
    legs.fillRoundedRect(50, -30, 27, 41, 11);
    legs.fillStyle(0x2c211d, 1);
    legs.fillEllipse(28, 9, 38, 14);
    legs.fillEllipse(64, 9, 38, 14);

    const body = this.add.graphics();
    body.lineStyle(4, 0x4b2819, 1);
    body.fillStyle(0x9c562c, 1);
    body.fillRoundedRect(-4, -95, 91, 75, 23);
    body.strokeRoundedRect(-4, -95, 91, 75, 23);
    body.fillStyle(0xc57738, 1);
    body.fillRoundedRect(4, -88, 22, 54, 9);

    const backArm = this.add.ellipse(76, -74, 30, 73, 0xb96833).setRotation(-0.58);
    backArm.setStrokeStyle(4, 0x4b2819, 1);
    const backHand = this.add.circle(94, -48, 15, 0xf0b36f).setStrokeStyle(4, 0x63351f, 1);

    const head = this.add.circle(32, -121, 43, 0xf2b873).setStrokeStyle(4, 0x61351f, 1);
    const ear = this.add.circle(71, -116, 15, 0xeaa968).setStrokeStyle(3, 0x713d24, 1);
    const nose = this.add.ellipse(5, -116, 31, 24, 0xf7c080).setStrokeStyle(3, 0x8b4e2d, 1);

    const hair = this.add.graphics();
    hair.fillStyle(0xf4f0df, 1);
    hair.beginPath();
    hair.moveTo(2, -150);
    hair.quadraticCurveTo(17, -174, 47, -163);
    hair.quadraticCurveTo(67, -158, 75, -142);
    hair.quadraticCurveTo(47, -151, 19, -139);
    hair.closePath();
    hair.fillPath();
    hair.lineStyle(2, 0xbcb6a6, 1);
    hair.strokePath();

    const beard = this.add.container(20, -93);
    const beardParts = [
      this.add.ellipse(-15, -10, 43, 31, 0xfff8df),
      this.add.ellipse(14, -8, 48, 34, 0xfff8df),
      this.add.ellipse(3, 12, 58, 43, 0xf6efd8),
      this.add.ellipse(28, 11, 43, 39, 0xf4ecd3),
      this.add.ellipse(4, 30, 57, 35, 0xeee5cc),
    ];
    beard.add(beardParts);

    const eyeWhite = this.add.ellipse(33, -130, 13, 17, 0xffffff);
    const pupil = this.add.circle(35, -130, 3.8, 0x221914);
    const brow = this.add.graphics();
    brow.lineStyle(3, 0x6e3a21, 1);
    brow.beginPath();
    brow.moveTo(25, -141);
    brow.quadraticCurveTo(34, -146, 43, -140);
    brow.strokePath();

    const hat = this.add.graphics();
    hat.lineStyle(4, 0x54301f, 1);
    hat.fillStyle(0xf2e3bb, 1);
    hat.fillRoundedRect(-6, -174, 86, 32, 13);
    hat.strokeRoundedRect(-6, -174, 86, 32, 13);
    hat.fillStyle(0xa3482b, 1);
    hat.fillRect(-5, -151, 84, 11);
    hat.fillStyle(0xdec995, 1);
    hat.fillEllipse(34, -141, 118, 17);
    hat.lineStyle(3, 0x54301f, 1);
    hat.strokeEllipse(34, -141, 118, 17);

    const frontArm = this.add.ellipse(-31, -67, 30, 87, 0xb86632).setRotation(0.91);
    frontArm.setStrokeStyle(4, 0x4b2819, 1);
    const frontHand = this.add.circle(-66, -45, 15, 0xf1b575).setStrokeStyle(4, 0x63351f, 1);

    const winch = this.add.container(-86, -45);
    const winchFrame = this.add.graphics();
    winchFrame.lineStyle(4, 0x2f211a, 1);
    winchFrame.fillStyle(0x72442c, 1);
    winchFrame.fillRoundedRect(-35, -23, 71, 48, 9);
    winchFrame.strokeRoundedRect(-35, -23, 71, 48, 9);
    const spoolOuter = this.add.circle(0, 0, 23, 0x2c211c).setStrokeStyle(3, 0x1c1512, 1);
    const spool = this.add.circle(0, 0, 16, 0x9c6a3e).setStrokeStyle(4, 0xd2a25b, 1);
    const spokes = this.add.graphics();
    spokes.lineStyle(3, 0x3b281f, 1);
    spokes.lineBetween(-14, 0, 14, 0);
    spokes.lineBetween(0, -14, 0, 14);
    spokes.lineBetween(-10, -10, 10, 10);
    spokes.lineBetween(-10, 10, 10, -10);
    const handle = this.add.graphics();
    handle.lineStyle(6, 0x39261d, 1);
    handle.lineBetween(26, -13, 39, -29);
    handle.fillStyle(0xd0a15b, 1);
    handle.fillCircle(42, -32, 6);
    winch.add([winchFrame, spoolOuter, spool, spokes, handle]);

    miner.add([
      shadow,
      legs,
      backArm,
      backHand,
      body,
      head,
      ear,
      nose,
      hair,
      beard,
      eyeWhite,
      pupil,
      brow,
      hat,
      frontArm,
      frontHand,
      winch,
    ]);

    this.tweens.add({
      targets: miner,
      y: miner.y - 2,
      duration: 1_250,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: spokes,
      angle: 360,
      duration: 4_800,
      repeat: -1,
    });
  }

  private moveMiner(deltaX: number): void {
    this.minerX = Phaser.Math.Clamp(this.minerX + deltaX, MINER_MIN_X, MINER_MAX_X);
    this.miner?.setX(this.minerX);
  }

  private disposeRuntime(): void {
    this.runtime?.stop();
    this.runtime = undefined;
    if (this.textureKey && this.textures.exists(this.textureKey)) {
      this.textures.remove(this.textureKey);
    }
    this.texture = undefined;
    this.sourceCanvas = undefined;
    this.miner = undefined;
  }
}

/**
 * Phaser 4 host for the original feature-complete game runtime.
 *
 * The proven gameplay simulation and procedural mine artwork render into a
 * high-DPI CanvasTexture. Phaser owns the visible canvas, scene lifecycle,
 * scaling, input, the upgraded surface layer and the animated cartoon miner.
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
