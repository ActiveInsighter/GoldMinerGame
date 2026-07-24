import {
  ITEM_CONFIGS,
  calculateCatchScore,
  calculatePullSpeed,
  createSeededRng,
  updateCombo,
  type MineItemType,
  type SeededRng,
} from "../model";
import { GROUND_Y, HookConfig, SimulationConfig, WORLD_HEIGHT, WORLD_WIDTH } from "../config/gameConfig";
import type {
  ActiveEvent,
  CollisionHit,
  EngineStats,
  HudSnapshot,
  LevelResult,
  RuntimeMineItem,
  SimulationEvent,
  SimulationOptions,
  SimulationSnapshot,
  HookState,
} from "./simulationTypes";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function segmentCircleHitT(
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
  if (a <= Number.EPSILON) return fx * fx + fy * fy <= radius * radius ? 0 : null;
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

export function pointToSegmentDistance(
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
  if (lengthSquared <= Number.EPSILON) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function copyEvent(event: ActiveEvent | null): ActiveEvent | null {
  return event ? { ...event } : null;
}

export class GameSimulation {
  private readonly level: SimulationOptions["level"];
  private readonly effects: SimulationOptions["effects"];
  private readonly mode: SimulationOptions["mode"];
  private readonly rng: SeededRng;
  private readonly reducedMotion: boolean;
  private readonly items: RuntimeMineItem[];
  private readonly events: SimulationEvent[] = [];

  private elapsed = 0;
  private terminal = false;
  private paused = false;
  private score = 0;
  private timeRemaining: number;
  private dynamite: number;
  private combo = 0;
  private multiplier = 1;
  private lastCatchElapsed = -100;
  private nextEventAt: number;
  private activeEvent: ActiveEvent | null = null;
  private warningSoundSecond = -1;
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
    length: HookConfig.minimumLength,
    attachedId: null,
    perfect: false,
    previousX: WORLD_WIDTH / 2,
    previousY: GROUND_Y + HookConfig.minimumLength,
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

  constructor(options: SimulationOptions) {
    this.level = options.level;
    this.effects = options.effects;
    this.mode = options.mode;
    this.rng = createSeededRng(`${options.seed}:simulation`);
    this.reducedMotion = options.reducedMotion ?? false;
    this.timeRemaining = options.level.durationSeconds + options.effects.timeBonusSeconds;
    this.dynamite = Math.max(0, Math.floor(options.initialDynamite ?? 0)) + options.effects.dynamiteCharges;
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
    this.events.push({
      type: "announcement",
      message: `第 ${this.level.id} 关，${this.level.name}。目标 ${this.level.target} 金币。`,
    });
  }

  update(rawDelta: number): void {
    if (this.terminal || this.paused) return;
    let remaining = clamp(Number.isFinite(rawDelta) ? rawDelta : 0, 0, SimulationConfig.maximumDeltaSeconds);
    while (remaining > 0 && !this.terminal) {
      const delta = Math.min(SimulationConfig.fixedSubstepSeconds, remaining);
      this.updateStep(delta);
      remaining -= delta;
    }
  }

  fire(): boolean {
    if (this.terminal || this.paused || this.hook.state !== "swinging") return false;
    this.hook.state = "extending";
    this.events.push({ type: "sound", name: "launch" });
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
    return true;
  }

  setPaused(paused: boolean): void {
    if (this.terminal) return;
    this.paused = paused;
  }

  togglePaused(): void {
    this.setPaused(!this.paused);
  }

  moveOrigin(deltaX: number): boolean {
    if (this.level.mode !== "mole" || this.paused || this.hook.state !== "swinging") return false;
    this.originX = clamp(this.originX + deltaX, HookConfig.originMinX, HookConfig.originMaxX);
    return true;
  }

  getHudSnapshot(): HudSnapshot {
    return {
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
      event: copyEvent(this.activeEvent),
      warning: this.timeRemaining <= 10,
    };
  }

  getSnapshot(): SimulationSnapshot {
    const point = this.hookPoint();
    const attached = this.attachedItem();
    return {
      elapsed: this.elapsed,
      paused: this.paused,
      terminal: this.terminal,
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier,
      timeRemaining: this.timeRemaining,
      dynamite: this.dynamite,
      activeEvent: copyEvent(this.activeEvent),
      hook: {
        state: this.hook.state,
        angle: this.hook.angle,
        length: this.hook.length,
        originX: this.originX,
        originY: GROUND_Y - 4,
        x: point.x,
        y: point.y,
        attachedId: this.hook.attachedId,
        perfect: this.hook.perfect,
        pullWeight: attached?.weight ?? 0,
      },
      items: this.items,
    };
  }

  drainEvents(): SimulationEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private updateStep(delta: number): void {
    this.elapsed += delta;
    if (this.activeEvent?.type !== "timeFreeze") {
      this.timeRemaining = Math.max(0, this.timeRemaining - delta);
    }
    this.updateEvent(delta);
    this.updateItems(delta);
    this.updateHook(delta);

    if (this.timeRemaining <= 10 && this.timeRemaining > 0) {
      const wholeSecond = Math.ceil(this.timeRemaining);
      if (wholeSecond !== this.warningSoundSecond) {
        this.warningSoundSecond = wholeSecond;
        this.events.push({ type: "sound", name: "warning" });
        if (wholeSecond === 10 || wholeSecond === 5) {
          this.events.push({ type: "announcement", message: `还剩 ${wholeSecond} 秒` });
        }
      }
    }
    if (this.timeRemaining <= 0) {
      this.finish(this.mode !== "endless" && this.score >= this.level.target);
    }
  }

  private updateHook(delta: number): void {
    const before = this.hookPoint();
    this.hook.previousX = before.x;
    this.hook.previousY = before.y;

    if (this.hook.state === "swinging") {
      this.hook.angle += this.hook.direction * HookConfig.swingSpeed * delta;
      if (this.hook.angle >= HookConfig.angleLimit) {
        this.hook.angle = HookConfig.angleLimit;
        this.hook.direction = -1;
      } else if (this.hook.angle <= -HookConfig.angleLimit) {
        this.hook.angle = -HookConfig.angleLimit;
        this.hook.direction = 1;
      }
      return;
    }

    if (this.hook.state === "extending") {
      this.hook.length += HookConfig.extendSpeed * delta;
      const point = this.hookPoint();
      const outOfBounds =
        this.hook.length >= HookConfig.maximumLength ||
        point.x < 28 ||
        point.x > WORLD_WIDTH - 28 ||
        point.y > WORLD_HEIGHT - 22;
      const hit = this.findFirstHit(this.hook.previousX, this.hook.previousY, point.x, point.y);
      if (hit) {
        const hitX = this.hook.previousX + (point.x - this.hook.previousX) * hit.t;
        const hitY = this.hook.previousY + (point.y - this.hook.previousY) * hit.t;
        this.hook.length = Math.hypot(hitX - this.originX, hitY - (GROUND_Y - 4));
        this.attachItem(hit.item, hit.perfect);
      } else if (outOfBounds) {
        this.hook.state = "retractingEmpty";
        this.stats.misses += 1;
        if (this.combo > 0) {
          this.events.push({ type: "floating-text", x: point.x, y: point.y, text: "连击中断", color: "#f6c46e" });
        }
        this.combo = 0;
        this.multiplier = 1;
      }
      return;
    }

    if (this.hook.state === "destroying") {
      this.barrelFuse -= delta;
      if (this.barrelFuse <= 0) this.resetHook();
      return;
    }

    let speed: number = HookConfig.emptyReturnSpeed;
    if (this.hook.state === "retractingItem") {
      const item = this.attachedItem();
      if (item) {
        speed = calculatePullSpeed(item.weight, {
          baseSpeed: 720,
          minimumSpeed: 145,
          maximumSpeed: 820,
          speedMultiplier: this.effects.pullSpeedMultiplier * (this.level.rules.pullSpeedMultiplier ?? 1),
          perfectGrab: this.hook.perfect,
        });
        if (this.activeEvent?.type === "tremor") speed *= 0.9;
      }
    }

    this.hook.length = Math.max(HookConfig.minimumLength, this.hook.length - speed * delta);
    const point = this.hookPoint();
    const item = this.attachedItem();
    if (item) {
      item.x = point.x;
      item.y = point.y + Math.sin(this.elapsed * 9 + item.phase) * 4;
    }
    if (this.hook.length <= HookConfig.minimumLength + 0.01) {
      if (this.hook.state === "retractingItem" && item) this.settleItem(item);
      else this.resetHook();
    }
  }

  private findFirstHit(ax: number, ay: number, bx: number, by: number): CollisionHit | null {
    let best: CollisionHit | null = null;
    for (const item of this.items) {
      if (item.state !== "active") continue;
      const hitT = segmentCircleHitT(
        ax - item.previousX,
        ay - item.previousY,
        bx - item.x,
        by - item.y,
        0,
        0,
        item.radius + HookConfig.radius,
      );
      if (hitT === null || (best && hitT >= best.t)) continue;
      const centerDistance = pointToSegmentDistance(item.x, item.y, ax, ay, bx, by);
      const perfect = centerDistance <= item.radius * ITEM_CONFIGS[item.type].perfectGrabRadiusRatio;
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
    this.events.push({ type: "sound", name: item.type === "diamond" ? "diamond" : "grab" });
    this.events.push({ type: "effect", kind: item.type === "diamond" ? "diamond" : "grab", x: item.x, y: item.y });
    if (perfect) {
      this.stats.perfectGrabs += 1;
      this.events.push({ type: "floating-text", x: item.x, y: item.y - item.radius, text: "完美抓取！", color: "#fff0a6", scale: 1.2 });
    }
    this.barrelFuse = item.type === "tnt" && this.rng.next() < 0.68 ? this.rng.float(0.5, 0.92) : -1;
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
      earned += this.rng.int(80, 360);
      if (this.rng.next() < 0.24) {
        this.dynamite = Math.min(5, this.dynamite + 1);
        this.events.push({ type: "floating-text", x: this.originX, y: GROUND_Y + 24, text: "宝箱：炸药 +1", color: "#ffdda0" });
      }
    }
    this.score += earned;
    this.stats.catches += 1;
    if (item.type === "smallGold" || item.type === "mediumGold" || item.type === "largeGold") this.stats.goldCaught += 1;
    else if (item.type === "diamond" || item.type === "diamondMole") this.stats.diamondsCaught += 1;
    else if (item.type === "rock") this.stats.rocksCaught += 1;
    else if (item.type === "mysteryChest") this.stats.chestsCaught += 1;
    if (item.type === "mole" || item.type === "diamondMole") this.stats.molesCaught += 1;
    if (this.mode === "endless") this.timeRemaining = Math.min(99, this.timeRemaining + 2.2);

    const effectKind = item.type === "diamond" || item.type === "diamondMole" ? "diamond" : item.type === "rock" ? "rock-break" : "gold";
    this.events.push({ type: "sound", name: "settle" });
    this.events.push({ type: "effect", kind: effectKind, x: this.originX, y: GROUND_Y + 28, value: earned });
    this.events.push({
      type: "floating-text",
      x: this.originX,
      y: GROUND_Y + 38,
      text: `+${earned}${this.combo >= 2 ? `  ×${this.multiplier.toFixed(2)}` : ""}`,
      color: item.type === "rock" ? "#d8c5a8" : "#ffe45f",
      scale: this.hook.perfect ? 1.25 : 1,
    });
    if (this.combo >= 2) this.events.push({ type: "effect", kind: "combo", x: this.originX, y: GROUND_Y + 25, value: this.combo });
    this.events.push({ type: "announcement", message: `获得 ${earned} 金币${this.hook.perfect ? "，完美抓取" : ""}` });
    this.events.push({ type: "item-removed", id: item.id, reason: "collected" });
    this.resetHook();

    if (this.mode !== "endless" && this.score >= this.level.target) this.finish(true);
    else if (this.mode === "endless") this.replenishEndlessField();
  }

  private explodeAttached(playerTriggered: boolean): void {
    const item = this.attachedItem();
    if (!item) return;
    const x = item.x;
    const y = item.y;
    item.state = "destroyed";
    this.events.push({ type: "item-removed", id: item.id, reason: "destroyed" });
    if (item.type === "rock") this.stats.rocksDestroyed += 1;
    const blastRadius = playerTriggered ? 96 : (this.level.rules.tntBlastRadius ?? 96);
    for (const nearby of this.items) {
      if (nearby.state !== "active") continue;
      if (distanceSquared(x, y, nearby.x, nearby.y) > (blastRadius + nearby.radius) ** 2) continue;
      nearby.state = "destroyed";
      if (nearby.type === "rock") this.stats.rocksDestroyed += 1;
      this.events.push({ type: "item-removed", id: nearby.id, reason: "destroyed" });
    }
    this.combo = 0;
    this.multiplier = 1;
    this.hook.state = "destroying";
    this.hook.attachedId = null;
    this.barrelFuse = this.reducedMotion ? 0.08 : 0.3;
    this.events.push({ type: "effect", kind: "explosion", x, y });
    this.events.push({ type: "camera-shake", intensity: this.reducedMotion ? 0.002 : 0.012, duration: this.reducedMotion ? 90 : 280 });
    this.events.push({ type: "floating-text", x, y: y - 34, text: playerTriggered ? "爆破！" : "炸药桶爆炸！", color: "#fff1cd" });
    this.events.push({ type: "sound", name: "explosion" });
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
    if (this.hook.state === "retractingItem" && this.barrelFuse >= 0 && this.attachedItem()?.type === "tnt") {
      this.barrelFuse -= delta;
      if (this.barrelFuse <= 0) this.explodeAttached(false);
    }
  }

  private updateEvent(delta: number): void {
    if (this.activeEvent) {
      this.activeEvent.remaining -= delta;
      if (this.activeEvent.type === "tremor" && !this.reducedMotion && Math.floor(this.elapsed * 5) % 5 === 0) {
        this.events.push({ type: "camera-shake", intensity: 0.003, duration: 90 });
      }
      if (this.activeEvent.remaining <= 0) {
        this.events.push({ type: "announcement", message: `${this.activeEvent.label}结束` });
        this.activeEvent = null;
        this.nextEventAt = this.elapsed + this.rng.float(18, 25);
      }
      return;
    }

    const chance = this.level.rules.eventChancePerMinute ?? 0.14;
    if (this.elapsed < this.nextEventAt || this.elapsed < 8 || this.timeRemaining <= 9 || chance <= 0) return;
    if (this.rng.next() > clamp(chance * 2.1, 0.22, 0.72)) {
      this.nextEventAt = this.elapsed + this.rng.float(7, 11);
      return;
    }
    const types = ["tremor", "gemRain", "doubleGold", "moleFrenzy", "caveIn", "timeFreeze"] as const;
    const data: Record<(typeof types)[number], { label: string; detail: string; duration: number }> = {
      tremor: { label: "地下震动", detail: "卷扬机略受影响", duration: 4 },
      gemRain: { label: "宝石雨", detail: "新钻石落入矿层", duration: 6 },
      doubleGold: { label: "双倍金币", detail: "回收价值 ×2", duration: 8 },
      moleFrenzy: { label: "地鼠暴走", detail: "移动速度大幅提升", duration: 8 },
      caveIn: { label: "矿层塌陷", detail: "部分矿物改变位置", duration: 5 },
      timeFreeze: { label: "时间冻结", detail: "倒计时暂时停止", duration: 4 },
    };
    const type = this.rng.pick([...types]);
    const selected = data[type];
    this.activeEvent = { type, ...selected, remaining: selected.duration };
    if (type === "gemRain") this.spawnGemRain();
    if (type === "caveIn") this.shiftMineLayer();
    this.events.push({ type: "effect", kind: "event", x: WORLD_WIDTH / 2, y: 206 });
    this.events.push({ type: "floating-text", x: WORLD_WIDTH / 2, y: 206, text: selected.label, color: "#fff2c0", scale: 1.4 });
    this.events.push({ type: "announcement", message: `${selected.label}：${selected.detail}` });
  }

  private spawnGemRain(): void {
    for (let index = 0; index < this.rng.int(3, 5); index += 1) {
      const item = this.createRuntimeItem("diamond", `event-diamond-${this.elapsed.toFixed(2)}-${index}`);
      this.items.push(item);
      this.events.push({ type: "item-added", item });
      this.events.push({ type: "effect", kind: "diamond", x: item.x, y: item.y });
    }
  }

  private shiftMineLayer(): void {
    const active = this.rng.shuffle(this.items.filter((item) => item.state === "active"));
    for (const item of active.slice(0, 5)) {
      item.x = clamp(item.x + this.rng.float(-38, 38), 50 + item.radius, WORLD_WIDTH - 50 - item.radius);
      item.y = clamp(item.y + this.rng.float(12, 36), 196 + item.radius, WORLD_HEIGHT - 34 - item.radius);
      item.previousX = item.x;
      item.previousY = item.y;
    }
    this.events.push({ type: "camera-shake", intensity: this.reducedMotion ? 0.002 : 0.009, duration: 260 });
  }

  private replenishEndlessField(): void {
    const activeCount = this.items.filter((item) => item.state === "active").length;
    if (activeCount >= 9) return;
    const types: MineItemType[] = ["smallGold", "mediumGold", "largeGold", "diamond", "rock", "mysteryChest", "mole", "diamondMole"];
    for (let index = activeCount; index < 13; index += 1) {
      const item = this.createRuntimeItem(this.rng.pick(types), `endless-${this.elapsed.toFixed(2)}-${index}`);
      this.items.push(item);
      this.events.push({ type: "item-added", item });
    }
  }

  private createRuntimeItem(type: MineItemType, id: string): RuntimeMineItem {
    const config = ITEM_CONFIGS[type];
    const radius = config.radius;
    let x = this.rng.float(70, WORLD_WIDTH - 70);
    let y = this.rng.float(210, WORLD_HEIGHT - 54);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const overlaps = this.items.some(
        (item) => item.state === "active" && distanceSquared(x, y, item.x, item.y) < (radius + item.radius + 8) ** 2,
      );
      if (!overlaps) break;
      x = this.rng.float(70, WORLD_WIDTH - 70);
      y = this.rng.float(210, WORLD_HEIGHT - 54);
    }
    const direction: -1 | 1 = this.rng.next() < 0.5 ? -1 : 1;
    const speedRange = "moveSpeedRange" in config ? config.moveSpeedRange : undefined;
    const velocityX = speedRange ? this.rng.float(speedRange[0], speedRange[1]) * direction : 0;
    return {
      id,
      type,
      x,
      y,
      radius,
      rotation: this.rng.float(-0.24, 0.24),
      value: Math.round((config.baseValue + this.rng.float(-config.valueVariance, config.valueVariance)) / 5) * 5,
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
    };
  }

  private hookPoint(): { x: number; y: number } {
    return {
      x: this.originX + this.hook.length * Math.sin(this.hook.angle),
      y: GROUND_Y - 4 + this.hook.length * Math.cos(this.hook.angle),
    };
  }

  private attachedItem(): RuntimeMineItem | undefined {
    return this.hook.attachedId ? this.items.find((item) => item.id === this.hook.attachedId) : undefined;
  }

  private resetHook(): void {
    this.hook.state = "swinging";
    this.hook.length = HookConfig.minimumLength;
    this.hook.attachedId = null;
    this.hook.perfect = false;
    this.barrelFuse = -1;
  }

  private finish(won: boolean): void {
    if (this.terminal) return;
    this.terminal = true;
    const result: LevelResult = {
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
    };
    this.events.push({ type: "sound", name: won ? "success" : "failure" });
    this.events.push({ type: "effect", kind: won ? "success" : "failure", x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });
    this.events.push({ type: "announcement", message: won ? `挑战成功，获得 ${this.score} 金币` : `时间到，本关获得 ${this.score} 金币` });
    this.events.push({ type: "finished", result });
  }
}
