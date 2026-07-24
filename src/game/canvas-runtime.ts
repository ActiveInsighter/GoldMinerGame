import {
  ITEM_CONFIGS,
  calculateCatchScore,
  calculatePullSpeed,
  createSeededRng,
  updateCombo,
  type GeneratedMineItem,
  type LevelConfig,
  type LevelItemEffects,
  type MineItemType,
  type SeedValue,
  type SeededRng,
} from "./model";

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
const GROUND_Y = 142;
const MIN_ROPE_LENGTH = 48;
const MAX_ROPE_LENGTH = 690;
const HOOK_RADIUS = 10;
const ANGLE_LIMIT = (68 * Math.PI) / 180;
const SWING_SPEED = (52 * Math.PI) / 180;
const EXTEND_SPEED = 780;
const EMPTY_RETURN_SPEED = 1_080;

export type GameMode = "campaign" | "daily" | "endless";
export type HookState =
  | "swinging"
  | "extending"
  | "retractingEmpty"
  | "retractingItem"
  | "destroying";

export type RandomEventType =
  | "tremor"
  | "gemRain"
  | "doubleGold"
  | "moleFrenzy"
  | "caveIn"
  | "timeFreeze";

export type SoundName =
  | "launch"
  | "grab"
  | "diamond"
  | "explosion"
  | "settle"
  | "warning"
  | "success"
  | "failure";

type RuntimeMineItem = Omit<GeneratedMineItem, "x" | "y"> & {
  x: number;
  y: number;
  state: "active" | "attached" | "collected" | "destroyed";
  vx: number;
  previousX: number;
  previousY: number;
  phase: number;
  flash: number;
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  scale: number;
}

interface ActiveEvent {
  type: RandomEventType;
  label: string;
  detail: string;
  remaining: number;
  duration: number;
}

export interface EngineStats {
  catches: number;
  goldCaught: number;
  diamondsCaught: number;
  rocksCaught: number;
  chestsCaught: number;
  molesCaught: number;
  rocksDestroyed: number;
  perfectGrabs: number;
  highestCombo: number;
  misses: number;
}

export interface HudSnapshot {
  level: number;
  levelName: string;
  mode: GameMode;
  score: number;
  target: number;
  secondsLeft: number;
  combo: number;
  multiplier: number;
  dynamite: number;
  hookState: HookState;
  paused: boolean;
  event: ActiveEvent | null;
  warning: boolean;
}

export interface LevelResult {
  won: boolean;
  mode: GameMode;
  score: number;
  target: number;
  secondsLeft: number;
  highestCombo: number;
  dynamite: number;
  stats: EngineStats;
  level: number;
  levelName: string;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  level: LevelConfig;
  items: readonly GeneratedMineItem[];
  effects: LevelItemEffects;
  mode: GameMode;
  seed: SeedValue;
  initialDynamite?: number;
  reducedMotion?: boolean;
  onHud: (snapshot: HudSnapshot) => void;
  onEnd: (result: LevelResult) => void;
  onPauseChange?: (paused: boolean) => void;
  onSound?: (sound: SoundName) => void;
  onAnnouncement?: (message: string) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceSquared(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function segmentCircleHitT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number,
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a <= Number.EPSILON) {
    return fx * fx + fy * fy <= radius * radius ? 0 : null;
  }
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function eventCopy(event: ActiveEvent | null): ActiveEvent | null {
  return event ? { ...event } : null;
}

export class GoldMinerEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly level: LevelConfig;
  private readonly effects: LevelItemEffects;
  private readonly mode: GameMode;
  private readonly callbacks: Pick<
    EngineOptions,
    | "onHud"
    | "onEnd"
    | "onPauseChange"
    | "onSound"
    | "onAnnouncement"
  >;
  private readonly rng: SeededRng;
  private readonly reducedMotion: boolean;
  private readonly items: RuntimeMineItem[];
  private readonly particles: Particle[] = [];
  private readonly floatingTexts: FloatingText[] = [];

  private frameId = 0;
  private lastTimestamp = 0;
  private hudAccumulator = 1;
  private elapsed = 0;
  private terminal = false;
  private paused = false;
  private autoPaused = false;
  private score = 0;
  private timeRemaining: number;
  private dynamite: number;
  private combo = 0;
  private multiplier = 1;
  private lastCatchElapsed = -100;
  private nextEventAt: number;
  private activeEvent: ActiveEvent | null = null;
  private warningSoundSecond = -1;
  private screenShake = 0;
  private originX = WORLD_WIDTH / 2;
  private barrelFuse = -1;

  private hook: {
    state: HookState;
    angle: number;
    direction: -1 | 1;
    length: number;
    attachedId: string | null;
    perfect: boolean;
    previousX: number;
    previousY: number;
  } = {
    state: "swinging",
    angle: 0,
    direction: 1,
    length: MIN_ROPE_LENGTH,
    attachedId: null,
    perfect: false,
    previousX: WORLD_WIDTH / 2,
    previousY: GROUND_Y + MIN_ROPE_LENGTH,
  };

  private stats: EngineStats = {
    catches: 0,
    goldCaught: 0,
    diamondsCaught: 0,
    rocksCaught: 0,
    chestsCaught: 0,
    molesCaught: 0,
    rocksDestroyed: 0,
    perfectGrabs: 0,
    highestCombo: 0,
    misses: 0,
  };

  constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is not available.");
    this.ctx = context;
    this.level = options.level;
    this.effects = options.effects;
    this.mode = options.mode;
    this.callbacks = {
      onHud: options.onHud,
      onEnd: options.onEnd,
      onPauseChange: options.onPauseChange,
      onSound: options.onSound,
      onAnnouncement: options.onAnnouncement,
    };
    this.rng = createSeededRng(`${options.seed}:runtime`);
    this.reducedMotion = options.reducedMotion ?? false;
    this.timeRemaining =
      options.level.durationSeconds + options.effects.timeBonusSeconds;
    this.dynamite =
      Math.max(0, Math.floor(options.initialDynamite ?? 0)) +
      options.effects.dynamiteCharges;
    this.nextEventAt = this.rng.float(13, 19);
    this.items = options.items.map((item, index) => ({
      ...item,
      state: "active",
      vx: item.velocityX,
      previousX: item.x,
      previousY: item.y,
      phase: index * 0.83 + this.rng.float(0, Math.PI * 2),
      flash: this.rng.float(0, 2),
    }));
    this.setupCanvas();
  }

  start(): void {
    this.stop();
    this.lastTimestamp = performance.now();
    this.canvas.addEventListener("pointerdown", this.handlePointer);
    window.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.callbacks.onAnnouncement?.(
      `第 ${this.level.id} 关，${this.level.name}。目标 ${this.level.target} 金币。`,
    );
    this.emitHud(true);
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.canvas.removeEventListener("pointerdown", this.handlePointer);
    window.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  fire(): boolean {
    if (this.terminal || this.paused || this.hook.state !== "swinging") {
      return false;
    }
    this.hook.state = "extending";
    this.callbacks.onSound?.("launch");
    this.emitHud(true);
    return true;
  }

  useDynamite(): boolean {
    if (
      this.terminal ||
      this.paused ||
      this.dynamite <= 0 ||
      this.hook.state !== "retractingItem" ||
      !this.hook.attachedId
    ) {
      return false;
    }
    this.dynamite -= 1;
    this.explodeAttached(true);
    this.emitHud(true);
    return true;
  }

  setPaused(nextPaused: boolean): void {
    if (this.terminal || this.paused === nextPaused) return;
    this.paused = nextPaused;
    this.lastTimestamp = performance.now();
    this.callbacks.onPauseChange?.(this.paused);
    this.emitHud(true);
  }

  togglePaused(): void {
    this.setPaused(!this.paused);
  }

  private readonly handlePointer = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    this.fire();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === "Space" || event.code === "ArrowDown") {
      event.preventDefault();
      this.fire();
      return;
    }
    if (event.code === "KeyD") {
      event.preventDefault();
      this.useDynamite();
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      this.togglePaused();
      return;
    }
    if (
      (event.code === "ArrowLeft" || event.code === "ArrowRight") &&
      this.level.mode === "mole" &&
      this.hook.state === "swinging" &&
      !this.paused
    ) {
      event.preventDefault();
      this.originX = clamp(
        this.originX + (event.code === "ArrowLeft" ? -30 : 30),
        510,
        770,
      );
    }
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden && !this.paused && !this.terminal) {
      this.autoPaused = true;
      this.setPaused(true);
    } else if (!document.hidden) {
      this.lastTimestamp = performance.now();
    }
  };

  private readonly tick = (timestamp: number): void => {
    if (this.terminal) return;
    const rawDelta = (timestamp - this.lastTimestamp) / 1_000;
    this.lastTimestamp = timestamp;
    const frameDelta = clamp(
      Number.isFinite(rawDelta) ? rawDelta : 0,
      0,
      0.25,
    );

    if (!this.paused) {
      // Consume the complete frame time in stable substeps. This keeps
      // countdown and motion consistent on low-refresh devices while swept
      // collision remains precise.
      let remaining = frameDelta;
      while (remaining > 0 && !this.terminal) {
        const step = Math.min(0.05, remaining);
        this.update(step);
        remaining -= step;
      }
    }
    this.render();
    this.hudAccumulator += frameDelta;
    if (this.hudAccumulator >= 0.1) this.emitHud();
    if (!this.terminal) this.frameId = requestAnimationFrame(this.tick);
  };

  private update(delta: number): void {
    this.elapsed += delta;
    const timerFrozen = this.activeEvent?.type === "timeFreeze";
    if (!timerFrozen) this.timeRemaining = Math.max(0, this.timeRemaining - delta);

    this.updateEvent(delta);
    this.updateItems(delta);
    this.updateHook(delta);
    this.updateParticles(delta);
    this.updateFloatingTexts(delta);

    if (this.timeRemaining <= 10 && this.timeRemaining > 0) {
      const wholeSecond = Math.ceil(this.timeRemaining);
      if (wholeSecond !== this.warningSoundSecond) {
        this.warningSoundSecond = wholeSecond;
        this.callbacks.onSound?.("warning");
        if (wholeSecond === 10 || wholeSecond === 5) {
          this.callbacks.onAnnouncement?.(`还剩 ${wholeSecond} 秒`);
        }
      }
    }

    if (this.timeRemaining <= 0) {
      this.finish(this.mode === "endless" ? false : this.score >= this.level.target);
    }
  }

  private updateHook(delta: number): void {
    const originY = GROUND_Y - 4;
    const before = this.hookPoint();
    this.hook.previousX = before.x;
    this.hook.previousY = before.y;

    if (this.hook.state === "swinging") {
      this.hook.angle += this.hook.direction * SWING_SPEED * delta;
      if (this.hook.angle >= ANGLE_LIMIT) {
        this.hook.angle = ANGLE_LIMIT;
        this.hook.direction = -1;
      } else if (this.hook.angle <= -ANGLE_LIMIT) {
        this.hook.angle = -ANGLE_LIMIT;
        this.hook.direction = 1;
      }
      return;
    }

    if (this.hook.state === "extending") {
      this.hook.length += EXTEND_SPEED * delta;
      const point = this.hookPoint();
      const outOfBounds =
        this.hook.length >= MAX_ROPE_LENGTH ||
        point.x < 28 ||
        point.x > WORLD_WIDTH - 28 ||
        point.y > WORLD_HEIGHT - 22;

      const hit = this.findFirstHit(
        this.hook.previousX,
        this.hook.previousY,
        point.x,
        point.y,
      );
      if (hit) {
        const hitX =
          this.hook.previousX + (point.x - this.hook.previousX) * hit.t;
        const hitY =
          this.hook.previousY + (point.y - this.hook.previousY) * hit.t;
        this.hook.length = Math.hypot(hitX - this.originX, hitY - originY);
        this.attachItem(hit.item, hit.perfect);
      } else if (outOfBounds) {
        this.hook.state = "retractingEmpty";
        this.stats.misses += 1;
        if (this.combo > 0) this.showText(point.x, point.y, "连击中断", "#f6c46e");
        this.combo = 0;
        this.multiplier = 1;
      }
      return;
    }

    if (this.hook.state === "destroying") {
      this.barrelFuse -= delta;
      if (this.barrelFuse <= 0) {
        this.hook.state = "retractingEmpty";
        this.hook.attachedId = null;
      }
      return;
    }

    let speed = EMPTY_RETURN_SPEED;
    if (this.hook.state === "retractingItem") {
      const item = this.attachedItem();
      if (item) {
        speed =
          calculatePullSpeed(item.weight, {
            baseSpeed: 720,
            minimumSpeed: 145,
            maximumSpeed: 820,
            speedMultiplier:
              this.effects.pullSpeedMultiplier *
              (this.level.rules.pullSpeedMultiplier ?? 1),
            perfectGrab: this.hook.perfect,
          }) ?? 145;
        if (this.activeEvent?.type === "tremor") speed *= 0.9;
      }
    }

    this.hook.length = Math.max(
      MIN_ROPE_LENGTH,
      this.hook.length - speed * delta,
    );
    const point = this.hookPoint();
    const item = this.attachedItem();
    if (item) {
      item.x = point.x;
      item.y = point.y + Math.sin(this.elapsed * 9 + item.phase) * 4;
    }

    if (this.hook.length <= MIN_ROPE_LENGTH + 0.01) {
      if (this.hook.state === "retractingItem" && item) {
        this.settleItem(item);
      } else {
        this.resetHook();
      }
    }
  }

  private findFirstHit(
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): { item: RuntimeMineItem; t: number; perfect: boolean } | null {
    let best: { item: RuntimeMineItem; t: number; perfect: boolean } | null = null;
    for (const item of this.items) {
      if (item.state !== "active") continue;
      // Relative swept collision accounts for moving moles.
      const relativeAx = ax - item.previousX;
      const relativeAy = ay - item.previousY;
      const relativeBx = bx - item.x;
      const relativeBy = by - item.y;
      const hitT = segmentCircleHitT(
        relativeAx,
        relativeAy,
        relativeBx,
        relativeBy,
        0,
        0,
        item.radius + HOOK_RADIUS,
      );
      if (hitT === null || (best && hitT >= best.t)) continue;
      const centerDistance = pointToSegmentDistance(
        item.x,
        item.y,
        ax,
        ay,
        bx,
        by,
      );
      const perfect =
        centerDistance <=
        item.radius * ITEM_CONFIGS[item.type].perfectGrabRadiusRatio;
      best = { item, t: hitT, perfect };
    }
    return best;
  }

  private attachItem(item: RuntimeMineItem, perfect: boolean): void {
    item.state = "attached";
    item.vx = 0;
    this.hook.state = "retractingItem";
    this.hook.attachedId = item.id;
    this.hook.perfect = perfect;
    this.callbacks.onSound?.(item.type === "diamond" ? "diamond" : "grab");
    if (perfect) {
      this.stats.perfectGrabs += 1;
      this.showText(item.x, item.y - item.radius, "完美抓取！", "#fff0a6", 1.2);
      this.spawnBurst(item.x, item.y, "#ffe45f", 18);
    }
    if (item.type === "tnt" && this.rng.next() < 0.68) {
      this.barrelFuse = this.rng.float(0.5, 0.92);
    } else {
      this.barrelFuse = -1;
    }
  }

  private settleItem(item: RuntimeMineItem): void {
    item.state = "collected";
    const comboOutcome = updateCombo({
      currentCombo: this.combo,
      itemType: item.type,
      itemValue: item.value,
      elapsedSinceLastCatchSeconds: this.elapsed - this.lastCatchElapsed,
    });
    this.combo = comboOutcome.combo;
    this.multiplier = comboOutcome.multiplier;
    this.lastCatchElapsed = this.elapsed;
    this.stats.highestCombo = Math.max(this.stats.highestCombo, this.combo);

    const score = calculateCatchScore({
      baseValue: item.value,
      itemType: item.type,
      combo: this.combo,
      perfectGrab: this.hook.perfect,
      rockValueMultiplier: this.effects.rockValueMultiplier,
      diamondValueMultiplier: this.effects.diamondValueMultiplier,
      doubleValue: this.activeEvent?.type === "doubleGold",
    });

    let earned = score.total;
    if (item.type === "mysteryChest") {
      const chestBonus = this.rng.int(80, 360);
      earned += chestBonus;
      if (this.rng.next() < 0.24) {
        this.dynamite = Math.min(5, this.dynamite + 1);
        this.showText(this.originX, GROUND_Y + 24, "宝箱：炸药 +1", "#ffdda0");
      }
    }
    this.score += earned;
    this.stats.catches += 1;
    if (
      item.type === "smallGold" ||
      item.type === "mediumGold" ||
      item.type === "largeGold"
    ) {
      this.stats.goldCaught += 1;
    } else if (item.type === "diamond" || item.type === "diamondMole") {
      this.stats.diamondsCaught += 1;
    } else if (item.type === "rock") {
      this.stats.rocksCaught += 1;
    } else if (item.type === "mysteryChest") {
      this.stats.chestsCaught += 1;
    }
    if (item.type === "mole" || item.type === "diamondMole") {
      this.stats.molesCaught += 1;
    }

    if (this.mode === "endless") {
      this.timeRemaining = Math.min(99, this.timeRemaining + 2.2);
    }
    this.callbacks.onSound?.("settle");
    this.showText(
      this.originX,
      GROUND_Y + 38,
      `+${earned}${this.combo >= 2 ? `  ×${this.multiplier.toFixed(2)}` : ""}`,
      item.type === "rock" ? "#d8c5a8" : "#ffe45f",
      this.hook.perfect ? 1.25 : 1,
    );
    this.spawnBurst(
      this.originX,
      GROUND_Y + 30,
      item.type === "diamond" ? "#7df7f3" : "#ffd13d",
      12,
    );
    this.callbacks.onAnnouncement?.(
      `获得 ${earned} 金币${this.hook.perfect ? "，完美抓取" : ""}`,
    );
    this.resetHook();
    this.emitHud(true);

    if (this.mode !== "endless" && this.score >= this.level.target) {
      this.finish(true);
    } else if (this.mode === "endless") {
      this.replenishEndlessField();
    }
  }

  private resetHook(): void {
    this.hook.state = "swinging";
    this.hook.length = MIN_ROPE_LENGTH;
    this.hook.attachedId = null;
    this.hook.perfect = false;
    this.barrelFuse = -1;
  }

  private explodeAttached(playerTriggered: boolean): void {
    const item = this.attachedItem();
    if (!item) return;
    const x = item.x;
    const y = item.y;
    item.state = "destroyed";
    if (item.type === "rock") this.stats.rocksDestroyed += 1;
    const blastRadius = playerTriggered
      ? 96
      : (this.level.rules.tntBlastRadius ?? 96);
    for (const nearby of this.items) {
      if (
        nearby.state === "active" &&
        distanceSquared(x, y, nearby.x, nearby.y) <=
          (blastRadius + nearby.radius) ** 2
      ) {
        nearby.state = "destroyed";
        if (nearby.type === "rock") this.stats.rocksDestroyed += 1;
      }
    }
    this.combo = 0;
    this.multiplier = 1;
    this.hook.state = "destroying";
    this.hook.attachedId = null;
    this.barrelFuse = this.reducedMotion ? 0.08 : 0.3;
    this.screenShake = this.reducedMotion ? 2 : 12;
    this.spawnBurst(x, y, "#ff9b3d", this.reducedMotion ? 12 : 34);
    this.spawnBurst(x, y, "#2b1a13", this.reducedMotion ? 6 : 18);
    this.showText(x, y - 34, playerTriggered ? "爆破！" : "炸药桶爆炸！", "#fff1cd");
    this.callbacks.onSound?.("explosion");
    if (this.mode === "endless") this.replenishEndlessField();
  }

  private updateItems(delta: number): void {
    const frenzy = this.activeEvent?.type === "moleFrenzy" ? 1.8 : 1;
    for (const item of this.items) {
      item.previousX = item.x;
      item.previousY = item.y;
      item.flash += delta;
      if (item.state !== "active") continue;
      if (item.type === "mole" || item.type === "diamondMole") {
        item.x += item.vx * frenzy * delta;
        if (item.x - item.radius < 42 || item.x + item.radius > WORLD_WIDTH - 42) {
          item.x = clamp(item.x, 42 + item.radius, WORLD_WIDTH - 42 - item.radius);
          item.vx *= -1;
        }
      }
    }

    if (
      this.hook.state === "retractingItem" &&
      this.barrelFuse >= 0 &&
      this.attachedItem()?.type === "tnt"
    ) {
      this.barrelFuse -= delta;
      if (this.barrelFuse <= 0) this.explodeAttached(false);
    }
  }

  private updateEvent(delta: number): void {
    if (this.activeEvent) {
      this.activeEvent.remaining -= delta;
      if (this.activeEvent.type === "tremor") {
        this.screenShake = Math.max(this.screenShake, this.reducedMotion ? 1 : 4);
      }
      if (this.activeEvent.remaining <= 0) {
        this.callbacks.onAnnouncement?.(`${this.activeEvent.label}结束`);
        this.activeEvent = null;
        this.nextEventAt = this.elapsed + this.rng.float(18, 25);
      }
      return;
    }

    const chance = this.level.rules.eventChancePerMinute ?? 0.14;
    const canTrigger =
      this.elapsed >= this.nextEventAt &&
      this.elapsed >= 8 &&
      this.timeRemaining > 9 &&
      chance > 0;
    if (!canTrigger) return;

    if (this.rng.next() > clamp(chance * 2.1, 0.22, 0.72)) {
      this.nextEventAt = this.elapsed + this.rng.float(7, 11);
      return;
    }
    const types: RandomEventType[] = [
      "tremor",
      "gemRain",
      "doubleGold",
      "moleFrenzy",
      "caveIn",
      "timeFreeze",
    ];
    const type = this.rng.pick(types);
    const data: Record<
      RandomEventType,
      { label: string; detail: string; duration: number }
    > = {
      tremor: {
        label: "地下震动",
        detail: "卷扬机略受影响",
        duration: 4,
      },
      gemRain: {
        label: "宝石雨",
        detail: "新钻石落入矿层",
        duration: 6,
      },
      doubleGold: {
        label: "双倍金币",
        detail: "回收价值 ×2",
        duration: 8,
      },
      moleFrenzy: {
        label: "地鼠暴走",
        detail: "移动速度大幅提升",
        duration: 8,
      },
      caveIn: {
        label: "矿层塌陷",
        detail: "部分矿物改变位置",
        duration: 5,
      },
      timeFreeze: {
        label: "时间冻结",
        detail: "倒计时暂时停止",
        duration: 4,
      },
    };
    const selected = data[type];
    this.activeEvent = {
      type,
      label: selected.label,
      detail: selected.detail,
      duration: selected.duration,
      remaining: selected.duration,
    };
    if (type === "gemRain") this.spawnGemRain();
    if (type === "caveIn") this.shiftMineLayer();
    this.showText(WORLD_WIDTH / 2, 206, selected.label, "#fff2c0", 1.4);
    this.callbacks.onAnnouncement?.(`${selected.label}：${selected.detail}`);
    this.emitHud(true);
  }

  private spawnGemRain(): void {
    const diamonds = this.rng.int(3, 5);
    for (let index = 0; index < diamonds; index += 1) {
      const radius = ITEM_CONFIGS.diamond.radius;
      let x = this.rng.float(80, WORLD_WIDTH - 80);
      let y = this.rng.float(210, WORLD_HEIGHT - 70);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const overlaps = this.items.some(
          (item) =>
            item.state === "active" &&
            distanceSquared(x, y, item.x, item.y) <
              (radius + item.radius + 8) ** 2,
        );
        if (!overlaps) break;
        x = this.rng.float(80, WORLD_WIDTH - 80);
        y = this.rng.float(210, WORLD_HEIGHT - 70);
      }
      this.items.push({
        id: `event-diamond-${this.elapsed.toFixed(2)}-${index}`,
        type: "diamond",
        x,
        y,
        radius,
        rotation: this.rng.float(-0.2, 0.2),
        value: this.rng.int(580, 740),
        weight: ITEM_CONFIGS.diamond.weight,
        velocityX: 0,
        direction: 1,
        collected: false,
        state: "active",
        vx: 0,
        previousX: x,
        previousY: y,
        phase: this.rng.float(0, Math.PI * 2),
        flash: 0,
      });
      this.spawnBurst(x, y, "#79f7f1", 8);
    }
  }

  private shiftMineLayer(): void {
    const active = this.rng.shuffle(
      this.items.filter((item) => item.state === "active"),
    );
    for (const item of active.slice(0, 5)) {
      item.x = clamp(item.x + this.rng.float(-38, 38), 50 + item.radius, WORLD_WIDTH - 50 - item.radius);
      item.y = clamp(item.y + this.rng.float(12, 36), 196 + item.radius, WORLD_HEIGHT - 34 - item.radius);
      item.previousX = item.x;
      item.previousY = item.y;
    }
    this.screenShake = this.reducedMotion ? 2 : 9;
  }

  private replenishEndlessField(): void {
    const activeCount = this.items.filter((item) => item.state === "active").length;
    if (activeCount >= 9) return;
    const types: MineItemType[] = [
      "smallGold",
      "mediumGold",
      "largeGold",
      "diamond",
      "rock",
      "mysteryChest",
      "mole",
      "diamondMole",
    ];
    for (let index = activeCount; index < 13; index += 1) {
      const type = this.rng.pick(types);
      const config = ITEM_CONFIGS[type];
      let x = this.rng.float(70, WORLD_WIDTH - 70);
      let y = this.rng.float(210, WORLD_HEIGHT - 54);
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (
          !this.items.some(
            (item) =>
              item.state === "active" &&
              distanceSquared(x, y, item.x, item.y) <
                (config.radius + item.radius + 8) ** 2,
          )
        ) {
          break;
        }
        x = this.rng.float(70, WORLD_WIDTH - 70);
        y = this.rng.float(210, WORLD_HEIGHT - 54);
      }
      const direction: -1 | 1 = this.rng.next() < 0.5 ? -1 : 1;
      const speedRange =
        "moveSpeedRange" in config ? config.moveSpeedRange : undefined;
      const velocityX = speedRange
        ? this.rng.float(speedRange[0], speedRange[1]) * direction
        : 0;
      this.items.push({
        id: `endless-${this.elapsed.toFixed(2)}-${index}`,
        type,
        x,
        y,
        radius: config.radius,
        rotation: this.rng.float(-0.24, 0.24),
        value: Math.round(
          config.baseValue +
            this.rng.float(-config.valueVariance, config.valueVariance),
        ),
        weight: config.weight,
        velocityX,
        direction,
        collected: false,
        state: "active",
        vx: velocityX,
        previousX: x,
        previousY: y,
        phase: this.rng.float(0, Math.PI * 2),
        flash: 0,
      });
    }
  }

  private updateParticles(delta: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      if (!particle) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }
      particle.vy += particle.gravity * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }
    this.screenShake = Math.max(0, this.screenShake - delta * 24);
  }

  private updateFloatingTexts(delta: number): void {
    for (let index = this.floatingTexts.length - 1; index >= 0; index -= 1) {
      const text = this.floatingTexts[index];
      if (!text) continue;
      text.life -= delta;
      text.y -= delta * 34;
      if (text.life <= 0) this.floatingTexts.splice(index, 1);
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    const allowed = Math.min(count, 80 - this.particles.length);
    for (let index = 0; index < allowed; index += 1) {
      const angle = this.rng.float(0, Math.PI * 2);
      const speed = this.rng.float(45, 190);
      const life = this.rng.float(0.35, 0.85);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        life,
        maxLife: life,
        size: this.rng.float(2, 7),
        color,
        gravity: 130,
      });
    }
  }

  private showText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1,
  ): void {
    this.floatingTexts.push({ x, y, text, color, life: 1.15, scale });
  }

  private hookPoint(): { x: number; y: number } {
    return {
      x: this.originX + this.hook.length * Math.sin(this.hook.angle),
      y: GROUND_Y - 4 + this.hook.length * Math.cos(this.hook.angle),
    };
  }

  private attachedItem(): RuntimeMineItem | undefined {
    const id = this.hook.attachedId;
    return id ? this.items.find((item) => item.id === id) : undefined;
  }

  private finish(won: boolean): void {
    if (this.terminal) return;
    this.terminal = true;
    this.stop();
    this.callbacks.onSound?.(won ? "success" : "failure");
    this.callbacks.onAnnouncement?.(
      won ? `挑战成功，获得 ${this.score} 金币` : `时间到，本关获得 ${this.score} 金币`,
    );
    this.callbacks.onEnd({
      won,
      mode: this.mode,
      score: this.score,
      target: this.level.target,
      secondsLeft: Math.max(0, this.timeRemaining),
      highestCombo: this.stats.highestCombo,
      dynamite: this.dynamite,
      stats: { ...this.stats },
      level: this.level.id,
      levelName: this.level.name,
    });
  }

  private emitHud(force = false): void {
    if (!force && this.hudAccumulator < 0.1) return;
    this.hudAccumulator = 0;
    this.callbacks.onHud({
      level: this.level.id,
      levelName: this.level.name,
      mode: this.mode,
      score: this.score,
      target: this.level.target,
      secondsLeft: Math.ceil(this.timeRemaining),
      combo: this.combo,
      multiplier: this.multiplier,
      dynamite: this.dynamite,
      hookState: this.hook.state,
      paused: this.paused,
      event: eventCopy(this.activeEvent),
      warning: this.timeRemaining <= 10,
    });
  }

  private setupCanvas(): void {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.canvas.width = WORLD_WIDTH * dpr;
    this.canvas.height = WORLD_HEIGHT * dpr;
    this.canvas.style.aspectRatio = `${WORLD_WIDTH} / ${WORLD_HEIGHT}`;
    this.canvas.setAttribute(
      "aria-label",
      "黄金矿工游戏区。按空格、方向下键或点击发射抓钩，D 键使用炸药，Esc 暂停。",
    );
  }

  private render(): void {
    const dpr = this.canvas.width / WORLD_WIDTH;
    const shakeX =
      this.screenShake > 0
        ? Math.sin(this.elapsed * 53) * this.screenShake
        : 0;
    const shakeY =
      this.screenShake > 0
        ? Math.cos(this.elapsed * 47) * this.screenShake * 0.6
        : 0;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawWorld(ctx);
    this.drawAimAssist(ctx);
    this.drawItems(ctx);
    this.drawHook(ctx);
    this.drawMiner(ctx);
    this.drawParticles(ctx);
    this.drawFloatingTexts(ctx);
    this.drawEventVignette(ctx);
    ctx.restore();
  }

  private drawWorld(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#e9ad58";
    ctx.fillRect(-20, -20, WORLD_WIDTH + 40, GROUND_Y + 20);

    ctx.fillStyle = "#8f5f3d";
    ctx.fillRect(-20, GROUND_Y, WORLD_WIDTH + 40, WORLD_HEIGHT - GROUND_Y + 30);

    ctx.fillStyle = "#a87650";
    ctx.beginPath();
    ctx.moveTo(-20, 228);
    ctx.bezierCurveTo(185, 172, 310, 256, 474, 212);
    ctx.bezierCurveTo(650, 166, 790, 260, 970, 208);
    ctx.bezierCurveTo(1_104, 170, 1_220, 218, 1_300, 186);
    ctx.lineTo(1_300, 352);
    ctx.lineTo(-20, 330);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#6d432d";
    ctx.beginPath();
    ctx.moveTo(-20, 452);
    ctx.bezierCurveTo(164, 405, 318, 487, 480, 436);
    ctx.bezierCurveTo(655, 382, 800, 497, 973, 429);
    ctx.bezierCurveTo(1_100, 378, 1_214, 455, 1_300, 410);
    ctx.lineTo(1_300, 750);
    ctx.lineTo(-20, 750);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#573323";
    ctx.globalAlpha = 0.52;
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        const x = 38 + col * 112 + (row % 2) * 27;
        const y = 208 + row * 102 + Math.sin(col * 2.1 + row) * 20;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + (col % 3), 2.2, col * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#3e291f";
    ctx.fillRect(-20, GROUND_Y - 9, WORLD_WIDTH + 40, 18);
    ctx.fillStyle = "#c28a4e";
    ctx.fillRect(-20, GROUND_Y - 9, WORLD_WIDTH + 40, 5);
    this.drawTimberSupports(ctx);
  }

  private drawTimberSupports(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#3b281f";
    ctx.fillRect(90, 300, 18, 220);
    ctx.fillRect(1_172, 292, 18, 234);
    ctx.save();
    ctx.translate(70, 304);
    ctx.rotate(-0.035);
    ctx.fillRect(0, 0, 1_140, 17);
    ctx.restore();
    ctx.fillStyle = "#7e4e31";
    ctx.fillRect(94, 300, 5, 220);
    ctx.fillRect(1_176, 292, 5, 234);
    ctx.restore();
  }

  private drawAimAssist(ctx: CanvasRenderingContext2D): void {
    if (
      this.effects.aimAssistSeconds <= 0 ||
      this.elapsed > this.effects.aimAssistSeconds ||
      this.hook.state !== "swinging"
    ) {
      return;
    }
    const endX = this.originX + MAX_ROPE_LENGTH * Math.sin(this.hook.angle);
    const endY = GROUND_Y - 4 + MAX_ROPE_LENGTH * Math.cos(this.hook.angle);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 242, 164, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 12]);
    ctx.beginPath();
    ctx.moveTo(this.originX, GROUND_Y - 4);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  private drawItems(ctx: CanvasRenderingContext2D): void {
    for (const item of this.items) {
      if (item.state === "collected" || item.state === "destroyed") continue;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation + (item.state === "attached" ? Math.sin(this.elapsed * 8) * 0.08 : 0));
      if (item.type === "smallGold" || item.type === "mediumGold" || item.type === "largeGold") {
        this.drawGold(ctx, item);
      } else if (item.type === "diamond") {
        this.drawDiamond(ctx, item.radius, item.flash);
      } else if (item.type === "rock") {
        this.drawRock(ctx, item);
      } else if (item.type === "mysteryChest") {
        this.drawChest(ctx, item.radius);
      } else if (item.type === "tnt") {
        this.drawTnt(ctx, item.radius);
      } else {
        this.drawMole(ctx, item.type === "diamondMole", item.radius, item.vx);
      }
      ctx.restore();
    }
  }

  private drawGold(ctx: CanvasRenderingContext2D, item: RuntimeMineItem): void {
    const r = item.radius;
    const gradient = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r * 1.2);
    gradient.addColorStop(0, "#fff49a");
    gradient.addColorStop(0.32, "#ffd52e");
    gradient.addColorStop(1, "#c77b06");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#8f5808";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2;
      const wobble = 0.82 + ((index * 7) % 5) * 0.045;
      const x = Math.cos(angle) * r * wobble;
      const y = Math.sin(angle) * r * (0.78 + ((index * 3) % 4) * 0.05);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,220,.75)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.22, r * 0.1, -0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDiamond(
    ctx: CanvasRenderingContext2D,
    radius: number,
    flash: number,
  ): void {
    const r = radius * 1.12;
    ctx.fillStyle = "#6fe4df";
    ctx.strokeStyle = "#dfffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, -r * 0.25);
    ctx.lineTo(r * 0.55, r * 0.75);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.55, r * 0.75);
    ctx.lineTo(-r * 0.9, -r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.25);
    ctx.lineTo(r * 0.9, -r * 0.25);
    ctx.moveTo(0, -r);
    ctx.lineTo(-r * 0.12, r * 0.72);
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.38, -r * 0.25);
    ctx.stroke();
    if (Math.sin(flash * 3.4) > 0.78) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.78, -r * 1.02);
      ctx.lineTo(r * 0.78, -r * 0.45);
      ctx.moveTo(r * 0.49, -r * 0.73);
      ctx.lineTo(r * 1.06, -r * 0.73);
      ctx.stroke();
    }
  }

  private drawRock(ctx: CanvasRenderingContext2D, item: RuntimeMineItem): void {
    const r = item.radius;
    ctx.fillStyle = "#746b61";
    ctx.strokeStyle = "#463f39";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.92, r * 0.2);
    ctx.lineTo(-r * 0.55, -r * 0.78);
    ctx.lineTo(r * 0.2, -r);
    ctx.lineTo(r * 0.88, -r * 0.34);
    ctx.lineTo(r * 0.7, r * 0.72);
    ctx.lineTo(-r * 0.25, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9b9185";
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.48);
    ctx.lineTo(r * 0.08, -r * 0.72);
    ctx.lineTo(r * 0.36, -r * 0.34);
    ctx.lineTo(-r * 0.2, -r * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  private drawChest(ctx: CanvasRenderingContext2D, radius: number): void {
    const w = radius * 1.8;
    const h = radius * 1.45;
    ctx.fillStyle = "#9b5c25";
    ctx.strokeStyle = "#4d2b18";
    ctx.lineWidth = 3;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d7a13a";
    ctx.fillRect(-w / 2, -4, w, 8);
    ctx.fillRect(-4, -h / 2, 8, h);
    ctx.fillStyle = "#ffe083";
    roundedRect(ctx, -6, -1, 12, 13, 3);
    ctx.fill();
    ctx.fillStyle = "#5b351d";
    ctx.font = `900 ${radius}px Georgia`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, -h * 0.12);
  }

  private drawTnt(ctx: CanvasRenderingContext2D, radius: number): void {
    const w = radius * 1.65;
    const h = radius * 1.85;
    ctx.fillStyle = "#9a3c2c";
    ctx.strokeStyle = "#4b231d";
    ctx.lineWidth = 3;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d2a55f";
    ctx.fillRect(-w / 2 - 2, -h * 0.34, w + 4, 6);
    ctx.fillRect(-w / 2 - 2, h * 0.21, w + 4, 6);
    ctx.fillStyle = "#f8ead1";
    ctx.fillRect(-w * 0.43, -7, w * 0.86, 15);
    ctx.fillStyle = "#7a201c";
    ctx.font = "900 10px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TNT", 0, 1);
    ctx.strokeStyle = "#27221c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.quadraticCurveTo(7, -h * 0.74, 14, -h * 0.66);
    ctx.stroke();
    ctx.fillStyle = "#ffce40";
    ctx.beginPath();
    ctx.arc(15, -h * 0.65, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMole(
    ctx: CanvasRenderingContext2D,
    diamond: boolean,
    radius: number,
    velocity: number,
  ): void {
    ctx.scale(velocity < 0 ? -1 : 1, 1);
    ctx.fillStyle = "#71432b";
    ctx.strokeStyle = "#3c2419";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, radius, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9f6841";
    ctx.beginPath();
    ctx.arc(radius * 0.38, -radius * 0.22, radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#281915";
    ctx.beginPath();
    ctx.arc(radius * 0.52, -radius * 0.33, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d89b72";
    ctx.beginPath();
    ctx.arc(radius * 0.78, -radius * 0.14, 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (diamond) {
      ctx.save();
      ctx.translate(-radius * 0.48, -radius * 0.78);
      this.drawDiamond(ctx, radius * 0.42, 1);
      ctx.restore();
    }
  }

  private drawHook(ctx: CanvasRenderingContext2D): void {
    const point = this.hookPoint();
    ctx.strokeStyle = "#33261d";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(this.originX, GROUND_Y - 4);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-this.hook.angle);
    ctx.strokeStyle = "#e2d3b8";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 10);
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(-18, 7, -13, 24);
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(18, 7, 13, 24);
    ctx.stroke();
    ctx.fillStyle = "#392b22";
    ctx.beginPath();
    ctx.arc(0, -7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMiner(ctx: CanvasRenderingContext2D): void {
    const x = this.originX;
    ctx.save();
    ctx.translate(x, GROUND_Y);
    ctx.fillStyle = "#5b371f";
    ctx.fillRect(-68, -51, 76, 21);
    ctx.fillStyle = "#2f241e";
    ctx.beginPath();
    ctx.arc(-24, -40, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c08b4d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-24, -40, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#e0aa66";
    ctx.fillRect(-30, -70, 12, 58);

    ctx.fillStyle = "#87502d";
    roundedRect(ctx, 23, -84, 42, 69, 12);
    ctx.fill();
    ctx.fillStyle = "#e1a66b";
    ctx.beginPath();
    ctx.arc(38, -104, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f1e3cb";
    ctx.beginPath();
    ctx.arc(28, -94, 25, 0.1, Math.PI * 1.22);
    ctx.arc(48, -93, 20, Math.PI * 0.12, Math.PI * 1.18);
    ctx.fill();
    ctx.fillStyle = "#ece3d2";
    ctx.beginPath();
    ctx.moveTo(14, -118);
    ctx.quadraticCurveTo(34, -145, 63, -123);
    ctx.lineTo(57, -113);
    ctx.quadraticCurveTo(34, -128, 18, -108);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2f261f";
    ctx.beginPath();
    ctx.arc(47, -108, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8c3c2a";
    ctx.fillRect(14, -130, 54, 10);
    ctx.fillStyle = "#673520";
    ctx.fillRect(4, -132, 72, 8);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const item of this.floatingTexts) {
      ctx.globalAlpha = clamp(item.life / 0.35, 0, 1);
      ctx.font = `900 ${Math.round(24 * item.scale)}px "Microsoft YaHei", sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(55,28,16,.78)";
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawEventVignette(ctx: CanvasRenderingContext2D): void {
    if (!this.activeEvent) return;
    ctx.save();
    if (this.activeEvent.type === "timeFreeze") {
      ctx.fillStyle = "rgba(104, 225, 226, .07)";
      ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    } else if (this.activeEvent.type === "doubleGold") {
      ctx.fillStyle = "rgba(255, 211, 74, .05)";
      ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    }
    ctx.restore();
  }
}
