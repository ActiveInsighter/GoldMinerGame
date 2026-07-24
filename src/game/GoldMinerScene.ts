import Phaser from "phaser";
import {
  ITEM_CONFIGS,
  calculateComboMultiplier,
  calculateEmptyHookReturnSpeed,
  calculatePullSpeed,
  dailyChallengeDateKey,
  generateMineField,
  getLevelConfig,
  seedForDailyChallenge,
  type GeneratedMineItem,
  type LevelConfig,
} from "./model";

export type PlayMode = "classic" | "daily" | "endless";
export type HookState = "swinging" | "extending" | "retracting";

export interface SceneHud {
  mode: PlayMode;
  level: number;
  levelName: string;
  score: number;
  target: number;
  secondsLeft: number;
  combo: number;
  multiplier: number;
  dynamite: number;
  hookState: HookState;
  paused: boolean;
}

export interface LevelOutcome {
  mode: PlayMode;
  level: number;
  score: number;
  target: number;
  success: boolean;
  highestCombo: number;
  diamondsCollected: number;
  perfectGrabs: number;
  rocksDestroyed: number;
  itemsCollected: number;
  dynamiteUsed: number;
}

export interface GoldMinerSceneOptions {
  mode: PlayMode;
  level: number;
  dynamite: number;
  onHud: (hud: SceneHud) => void;
  onFinish: (outcome: LevelOutcome) => void;
}

interface RuntimeItem {
  data: GeneratedMineItem;
  node: Phaser.GameObjects.Container;
  active: boolean;
  x: number;
  y: number;
  velocityX: number;
}

interface SegmentHit {
  item: RuntimeItem;
  t: number;
  distanceToCenter: number;
}

const WIDTH = 960;
const HEIGHT = 640;
const ORIGIN_X = WIDTH / 2;
const ORIGIN_Y = 122;
const MIN_LENGTH = 64;
const MAX_LENGTH = 570;
const MINE_LEFT = 28;
const MINE_RIGHT = WIDTH - 28;

function colorNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function createModeConfig(mode: PlayMode, level: number): LevelConfig {
  if (mode === "daily") {
    const base = getLevelConfig(3);
    return {
      ...base,
      id: 1,
      name: `每日矿脉 · ${dailyChallengeDateKey()}`,
      target: 2_600,
      durationSeconds: 70,
      rules: { ...base.rules, eventChancePerMinute: 0.22 },
    };
  }
  if (mode === "endless") {
    const base = getLevelConfig(6);
    return {
      ...base,
      id: 1,
      name: "无尽深矿",
      mode: "endless",
      target: 0,
      durationSeconds: 90,
      rules: { ...base.rules, eventChancePerMinute: 0.28 },
    };
  }
  return getLevelConfig(level);
}

function segmentCircleHit(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centerX: number,
  centerY: number,
  radius: number,
): { t: number; distance: number } | null {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const projected = lengthSquared <= 0
    ? 0
    : Phaser.Math.Clamp(((centerX - startX) * dx + (centerY - startY) * dy) / lengthSquared, 0, 1);
  const closestX = startX + dx * projected;
  const closestY = startY + dy * projected;
  const distance = Phaser.Math.Distance.Between(closestX, closestY, centerX, centerY);
  return distance <= radius ? { t: projected, distance } : null;
}

function modeSeed(mode: PlayMode, level: number): string | number {
  if (mode === "daily") return seedForDailyChallenge();
  if (mode === "endless") return `endless:${Date.now()}`;
  return `classic:${level}:${Date.now()}`;
}

export class GoldMinerScene extends Phaser.Scene {
  private readonly options: GoldMinerSceneOptions;
  private readonly levelConfig: LevelConfig;
  private rope!: Phaser.GameObjects.Graphics;
  private hook!: Phaser.GameObjects.Graphics;
  private items: RuntimeItem[] = [];
  private hookState: HookState = "swinging";
  private hookAngle = 0;
  private swingDirection = 1;
  private ropeLength = MIN_LENGTH;
  private caught: RuntimeItem | null = null;
  private score = 0;
  private secondsLeft: number;
  private combo = 0;
  private highestCombo = 0;
  private comboClock = 0;
  private dynamite: number;
  private paused = false;
  private finished = false;
  private diamondsCollected = 0;
  private perfectGrabs = 0;
  private rocksDestroyed = 0;
  private itemsCollected = 0;
  private dynamiteUsed = 0;
  private lastHudSecond = -1;

  constructor(options: GoldMinerSceneOptions) {
    super({ key: `GoldMiner-${Date.now()}` });
    this.options = options;
    this.levelConfig = createModeConfig(options.mode, options.level);
    this.secondsLeft = this.levelConfig.durationSeconds;
    this.dynamite = Math.max(0, options.dynamite);
  }

  create(): void {
    this.drawMine();
    this.rope = this.add.graphics().setDepth(30);
    this.hook = this.add.graphics().setDepth(31);
    this.createMiner();
    this.createItems();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 145) this.fire();
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.fire());
    this.input.keyboard?.on("keydown-DOWN", () => this.fire());
    this.input.keyboard?.on("keydown-D", () => this.useDynamite());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.emitHud(true);
  }

  update(_time: number, delta: number): void {
    if (this.finished || this.paused) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.secondsLeft = Math.max(0, this.secondsLeft - dt);
    this.comboClock = Math.max(0, this.comboClock - dt);
    if (this.comboClock === 0 && this.combo > 0) this.combo = 0;

    this.updateMovingItems(dt);
    this.updateHook(dt);
    this.drawHook();

    if (this.secondsLeft <= 0) this.finish();
    this.emitHud();
  }

  fire(): void {
    if (this.finished || this.paused || this.hookState !== "swinging") return;
    this.hookState = "extending";
    this.emitHud(true);
  }

  useDynamite(): void {
    if (this.finished || this.paused || this.dynamite <= 0 || !this.caught) return;
    this.dynamite -= 1;
    this.dynamiteUsed += 1;
    const target = this.caught;
    this.caught = null;
    this.destroyRuntimeItem(target, true);
    this.hookState = "retracting";
    this.emitHud(true);
  }

  togglePause(): void {
    if (this.finished) return;
    this.paused = !this.paused;
    this.emitHud(true);
  }

  private drawMine(): void {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x7b401f, 0x7b401f, 0x2d1a12, 0x2d1a12, 1);
    graphics.fillRect(0, 0, WIDTH, HEIGHT);
    graphics.fillStyle(0xd69a42, 1);
    graphics.fillRect(0, 0, WIDTH, 86);
    graphics.fillStyle(0x5c321d, 1);
    graphics.fillRect(0, 86, WIDTH, 60);
    graphics.fillStyle(0x21140f, 1);
    graphics.fillRect(0, 146, WIDTH, HEIGHT - 146);

    const decoration = this.add.graphics().setAlpha(0.24);
    for (let index = 0; index < 34; index += 1) {
      const x = Phaser.Math.Between(10, WIDTH - 10);
      const y = Phaser.Math.Between(160, HEIGHT - 10);
      decoration.fillStyle(index % 3 === 0 ? 0x8a5b3b : 0x4f3326, 1);
      decoration.fillCircle(x, y, Phaser.Math.Between(2, 8));
    }

    this.add.text(24, 24, this.levelConfig.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "24px",
      color: "#3b1d0d",
      fontStyle: "bold",
    });
  }

  private createMiner(): void {
    const miner = this.add.container(ORIGIN_X, ORIGIN_Y - 28).setDepth(40);
    const body = this.add.rectangle(0, 0, 54, 44, 0x335c73).setStrokeStyle(4, 0x183246);
    const head = this.add.circle(0, -34, 23, 0xf2bb78).setStrokeStyle(4, 0x63351d);
    const helmet = this.add.rectangle(0, -52, 58, 12, 0xe1a628).setStrokeStyle(3, 0x7b4512);
    const beard = this.add.triangle(0, -15, -18, 0, 18, 0, 0, 28, 0x8c3f1c);
    const winch = this.add.circle(39, 8, 15, 0x4c3021).setStrokeStyle(4, 0xc38a3a);
    miner.add([body, head, helmet, beard, winch]);
  }

  private createItems(): void {
    const generated = generateMineField({
      level: this.levelConfig,
      seed: modeSeed(this.options.mode, this.options.level),
      bounds: { minX: MINE_LEFT, maxX: MINE_RIGHT, minY: 180, maxY: HEIGHT - 24 },
      minGap: 7,
      edgePadding: 4,
    });

    this.items = generated.map((data) => {
      const config = ITEM_CONFIGS[data.type];
      const node = this.add.container(data.x, data.y).setRotation(data.rotation).setDepth(10);
      const circle = this.add.circle(0, 0, data.radius, colorNumber(config.color))
        .setStrokeStyle(3, colorNumber(config.highlightColor), 0.85);
      const label = this.add.text(0, 0, config.icon, {
        fontFamily: "system-ui, sans-serif",
        fontSize: `${Math.max(14, Math.round(data.radius * 1.1))}px`,
        color: "#1d100b",
        fontStyle: "bold",
      }).setOrigin(0.5);
      node.add([circle, label]);
      return { data, node, active: true, x: data.x, y: data.y, velocityX: data.velocityX };
    });
  }

  private updateMovingItems(dt: number): void {
    for (const item of this.items) {
      if (!item.active || item === this.caught || item.velocityX === 0) continue;
      item.x += item.velocityX * dt;
      const radius = item.data.radius;
      if (item.x - radius <= MINE_LEFT || item.x + radius >= MINE_RIGHT) {
        item.x = Phaser.Math.Clamp(item.x, MINE_LEFT + radius, MINE_RIGHT - radius);
        item.velocityX *= -1;
      }
      item.node.setPosition(item.x, item.y);
    }
  }

  private updateHook(dt: number): void {
    const before = this.tipPosition();
    if (this.hookState === "swinging") {
      this.hookAngle += this.swingDirection * 0.92 * dt;
      if (this.hookAngle >= 1.16 || this.hookAngle <= -1.16) {
        this.hookAngle = Phaser.Math.Clamp(this.hookAngle, -1.16, 1.16);
        this.swingDirection *= -1;
      }
    } else if (this.hookState === "extending") {
      this.ropeLength += 610 * dt;
      const after = this.tipPosition();
      const hit = this.findHit(before, after);
      if (hit) {
        if (hit.item.data.type === "tnt") {
          this.explodeAt(hit.item.x, hit.item.y, this.levelConfig.rules.tntBlastRadius ?? 92);
          this.destroyRuntimeItem(hit.item, false);
          this.hookState = "retracting";
        } else {
          this.caught = hit.item;
          this.hookState = "retracting";
          const perfectRadius = hit.item.data.radius * ITEM_CONFIGS[hit.item.data.type].perfectGrabRadiusRatio;
          if (hit.distanceToCenter <= perfectRadius) this.perfectGrabs += 1;
        }
      } else if (this.ropeLength >= MAX_LENGTH || this.outsideMine(after.x, after.y)) {
        this.hookState = "retracting";
      }
    } else {
      const speed = this.caught
        ? calculatePullSpeed(this.caught.data.weight, {
            speedMultiplier: this.levelConfig.rules.pullSpeedMultiplier ?? 1,
          })
        : calculateEmptyHookReturnSpeed();
      this.ropeLength -= speed * dt;
      if (this.ropeLength <= MIN_LENGTH) {
        this.ropeLength = MIN_LENGTH;
        if (this.caught) this.collectCaught();
        this.hookState = "swinging";
      }
    }

    const tip = this.tipPosition();
    if (this.caught) {
      this.caught.x = tip.x;
      this.caught.y = tip.y;
      this.caught.node.setPosition(tip.x, tip.y);
    }
  }

  private drawHook(): void {
    const tip = this.tipPosition();
    this.rope.clear();
    this.rope.lineStyle(5, 0xd8b77c, 1);
    this.rope.lineBetween(ORIGIN_X, ORIGIN_Y, tip.x, tip.y);

    this.hook.clear();
    this.hook.lineStyle(6, 0xd9d3c6, 1);
    this.hook.strokeCircle(tip.x, tip.y + 6, 11);
    this.hook.lineBetween(tip.x - 10, tip.y + 7, tip.x - 2, tip.y + 18);
    this.hook.lineBetween(tip.x + 10, tip.y + 7, tip.x + 2, tip.y + 18);
  }

  private tipPosition(): { x: number; y: number } {
    return {
      x: ORIGIN_X + Math.sin(this.hookAngle) * this.ropeLength,
      y: ORIGIN_Y + Math.cos(this.hookAngle) * this.ropeLength,
    };
  }

  private outsideMine(x: number, y: number): boolean {
    return x < 6 || x > WIDTH - 6 || y > HEIGHT - 6;
  }

  private findHit(start: { x: number; y: number }, end: { x: number; y: number }): SegmentHit | null {
    let closest: SegmentHit | null = null;
    for (const item of this.items) {
      if (!item.active) continue;
      const hit = segmentCircleHit(start.x, start.y, end.x, end.y, item.x, item.y, item.data.radius + 8);
      if (!hit) continue;
      if (!closest || hit.t < closest.t) {
        closest = { item, t: hit.t, distanceToCenter: hit.distance };
      }
    }
    return closest;
  }

  private collectCaught(): void {
    const item = this.caught;
    if (!item) return;
    this.caught = null;
    const config = ITEM_CONFIGS[item.data.type];
    if (config.comboEligible && item.data.value >= 200) {
      this.combo += 1;
      this.comboClock = 7;
    } else {
      this.combo = 0;
      this.comboClock = 0;
    }
    this.highestCombo = Math.max(this.highestCombo, this.combo);
    const multiplier = calculateComboMultiplier(this.combo);
    this.score += Math.round(item.data.value * multiplier);
    this.itemsCollected += 1;
    if (item.data.type === "diamond" || item.data.type === "diamondMole") this.diamondsCollected += 1;
    if (this.options.mode === "endless") this.secondsLeft = Math.min(99, this.secondsLeft + 3.5);
    this.destroyRuntimeItem(item, false);
  }

  private explodeAt(x: number, y: number, radius: number): void {
    const blast = this.add.circle(x, y, 8, 0xffd167, 0.9).setDepth(50);
    this.tweens.add({
      targets: blast,
      scale: radius / 8,
      alpha: 0,
      duration: 330,
      onComplete: () => blast.destroy(),
    });
    for (const item of this.items) {
      if (!item.active || item === this.caught) continue;
      if (Phaser.Math.Distance.Between(x, y, item.x, item.y) <= radius + item.data.radius) {
        if (item.data.type === "rock") this.rocksDestroyed += 1;
        this.destroyRuntimeItem(item, true);
      }
    }
  }

  private destroyRuntimeItem(item: RuntimeItem, animate: boolean): void {
    if (!item.active) return;
    item.active = false;
    if (!animate) {
      item.node.destroy(true);
      return;
    }
    this.tweens.add({
      targets: item.node,
      scale: 1.5,
      alpha: 0,
      duration: 180,
      onComplete: () => item.node.destroy(true),
    });
  }

  private emitHud(force = false): void {
    const wholeSecond = Math.ceil(this.secondsLeft);
    if (!force && wholeSecond === this.lastHudSecond) return;
    this.lastHudSecond = wholeSecond;
    this.options.onHud({
      mode: this.options.mode,
      level: this.options.level,
      levelName: this.levelConfig.name,
      score: this.score,
      target: this.levelConfig.target,
      secondsLeft: wholeSecond,
      combo: this.combo,
      multiplier: calculateComboMultiplier(this.combo),
      dynamite: this.dynamite,
      hookState: this.hookState,
      paused: this.paused,
    });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const success = this.levelConfig.target <= 0 ? this.score > 0 : this.score >= this.levelConfig.target;
    this.options.onFinish({
      mode: this.options.mode,
      level: this.options.level,
      score: this.score,
      target: this.levelConfig.target,
      success,
      highestCombo: this.highestCombo,
      diamondsCollected: this.diamondsCollected,
      perfectGrabs: this.perfectGrabs,
      rocksDestroyed: this.rocksDestroyed,
      itemsCollected: this.itemsCollected,
      dynamiteUsed: this.dynamiteUsed,
    });
  }
}
