/**
 * Pure data and rules for the Gold Miner game.
 *
 * This module deliberately has no React, DOM, canvas, or storage dependencies.
 * Rendering and persistence layers can therefore share the same deterministic
 * rules in the browser, tests, and server-side builds.
 */

export const MINE_ITEM_TYPES = [
  "smallGold",
  "mediumGold",
  "largeGold",
  "diamond",
  "rock",
  "mysteryChest",
  "tnt",
  "mole",
  "diamondMole",
] as const;

export type MineItemType = (typeof MINE_ITEM_TYPES)[number];

export type ItemFamily =
  | "gold"
  | "gem"
  | "stone"
  | "treasure"
  | "hazard"
  | "creature";

export interface MineItemConfig {
  readonly type: MineItemType;
  readonly name: string;
  readonly shortName: string;
  readonly icon: string;
  readonly family: ItemFamily;
  readonly baseValue: number;
  readonly valueVariance: number;
  readonly weight: number;
  readonly radius: number;
  readonly color: string;
  readonly highlightColor: string;
  readonly comboEligible: boolean;
  readonly perfectGrabRadiusRatio: number;
  readonly moveSpeedRange?: readonly [min: number, max: number];
  readonly dangerous?: boolean;
}

export const ITEM_CONFIGS = {
  smallGold: {
    type: "smallGold",
    name: "小金块",
    shortName: "小金",
    icon: "●",
    family: "gold",
    baseValue: 90,
    valueVariance: 15,
    weight: 1.1,
    radius: 14,
    color: "#F2B824",
    highlightColor: "#FFF2A8",
    comboEligible: false,
    perfectGrabRadiusRatio: 0.34,
  },
  mediumGold: {
    type: "mediumGold",
    name: "中型金块",
    shortName: "中金",
    icon: "◆",
    family: "gold",
    baseValue: 240,
    valueVariance: 25,
    weight: 3.2,
    radius: 22,
    color: "#E9A91C",
    highlightColor: "#FFE886",
    comboEligible: true,
    perfectGrabRadiusRatio: 0.32,
  },
  largeGold: {
    type: "largeGold",
    name: "大型金块",
    shortName: "大金",
    icon: "⬢",
    family: "gold",
    baseValue: 520,
    valueVariance: 45,
    weight: 8.2,
    radius: 34,
    color: "#D9900D",
    highlightColor: "#FFE15A",
    comboEligible: true,
    perfectGrabRadiusRatio: 0.28,
  },
  diamond: {
    type: "diamond",
    name: "钻石",
    shortName: "钻石",
    icon: "◆",
    family: "gem",
    baseValue: 680,
    valueVariance: 35,
    weight: 0.35,
    radius: 12,
    color: "#67E8E1",
    highlightColor: "#E9FFFF",
    comboEligible: true,
    perfectGrabRadiusRatio: 0.42,
  },
  rock: {
    type: "rock",
    name: "岩石",
    shortName: "石头",
    icon: "⬟",
    family: "stone",
    baseValue: 28,
    valueVariance: 8,
    weight: 9.5,
    radius: 25,
    color: "#716B65",
    highlightColor: "#A79D91",
    comboEligible: false,
    perfectGrabRadiusRatio: 0.25,
  },
  mysteryChest: {
    type: "mysteryChest",
    name: "神秘宝箱",
    shortName: "宝箱",
    icon: "?",
    family: "treasure",
    baseValue: 320,
    valueVariance: 170,
    weight: 4.6,
    radius: 23,
    color: "#B8752A",
    highlightColor: "#F5CC78",
    comboEligible: true,
    perfectGrabRadiusRatio: 0.3,
  },
  tnt: {
    type: "tnt",
    name: "炸药桶",
    shortName: "炸药",
    icon: "!",
    family: "hazard",
    baseValue: 0,
    valueVariance: 0,
    weight: 4.2,
    radius: 22,
    color: "#B9382D",
    highlightColor: "#FFD0A1",
    comboEligible: false,
    perfectGrabRadiusRatio: 0.22,
    dangerous: true,
  },
  mole: {
    type: "mole",
    name: "地鼠",
    shortName: "地鼠",
    icon: "♟",
    family: "creature",
    baseValue: 145,
    valueVariance: 20,
    weight: 1.8,
    radius: 18,
    color: "#8B512D",
    highlightColor: "#D9A070",
    comboEligible: false,
    perfectGrabRadiusRatio: 0.32,
    moveSpeedRange: [18, 31],
  },
  diamondMole: {
    type: "diamondMole",
    name: "钻石地鼠",
    shortName: "钻鼠",
    icon: "♞",
    family: "creature",
    baseValue: 760,
    valueVariance: 55,
    weight: 2.2,
    radius: 19,
    color: "#744329",
    highlightColor: "#7EF4EE",
    comboEligible: true,
    perfectGrabRadiusRatio: 0.3,
    moveSpeedRange: [32, 52],
  },
} as const satisfies Record<MineItemType, MineItemConfig>;

export type LevelMode =
  | "normal"
  | "diamond"
  | "mole"
  | "explosive"
  | "rush"
  | "endless";

export interface SpawnWeight {
  readonly type: MineItemType;
  readonly weight: number;
  readonly min?: number;
  readonly max?: number;
}

export interface LevelRules {
  readonly pullSpeedMultiplier?: number;
  readonly moleSpeedMultiplier?: number;
  readonly rareValueMultiplier?: number;
  readonly tntBlastRadius?: number;
  readonly eventChancePerMinute?: number;
  readonly description?: string;
}

export interface LevelConfig {
  readonly id: number;
  readonly name: string;
  readonly mode: LevelMode;
  readonly target: number;
  readonly durationSeconds: number;
  readonly itemCount: readonly [min: number, max: number];
  readonly spawnPool: readonly SpawnWeight[];
  readonly rules: LevelRules;
}

/**
 * Campaign data is intentionally configuration-driven. New levels can be
 * appended without changing spawning, scoring, or game-loop code.
 */
export const LEVEL_CONFIGS = [
  {
    id: 1,
    name: "初探金脉",
    mode: "normal",
    target: 720,
    durationSeconds: 65,
    itemCount: [15, 18],
    spawnPool: [
      { type: "smallGold", weight: 30, min: 4 },
      { type: "mediumGold", weight: 22, min: 2 },
      { type: "largeGold", weight: 8, min: 1, max: 2 },
      { type: "diamond", weight: 5, max: 2 },
      { type: "rock", weight: 23, min: 2 },
      { type: "mysteryChest", weight: 4, max: 1 },
      { type: "mole", weight: 8, max: 2 },
    ],
    rules: {
      eventChancePerMinute: 0.08,
      description: "熟悉抓钩节奏，金块数量充足。",
    },
  },
  {
    id: 2,
    name: "乱石矿道",
    mode: "normal",
    target: 1_350,
    durationSeconds: 62,
    itemCount: [17, 20],
    spawnPool: [
      { type: "smallGold", weight: 24, min: 3 },
      { type: "mediumGold", weight: 22, min: 2 },
      { type: "largeGold", weight: 10, min: 1, max: 3 },
      { type: "diamond", weight: 6, max: 2 },
      { type: "rock", weight: 30, min: 4 },
      { type: "mysteryChest", weight: 4, max: 1 },
      { type: "mole", weight: 4, max: 2 },
    ],
    rules: {
      eventChancePerMinute: 0.1,
      description: "岩石变多，选择比速度更重要。",
    },
  },
  {
    id: 3,
    name: "水晶洞穴",
    mode: "diamond",
    target: 2_350,
    durationSeconds: 58,
    itemCount: [18, 22],
    spawnPool: [
      { type: "smallGold", weight: 18, min: 2 },
      { type: "mediumGold", weight: 17, min: 2 },
      { type: "largeGold", weight: 7, max: 2 },
      { type: "diamond", weight: 25, min: 4, max: 8 },
      { type: "rock", weight: 20, min: 3 },
      { type: "mysteryChest", weight: 7, max: 2 },
      { type: "diamondMole", weight: 6, max: 2 },
    ],
    rules: {
      rareValueMultiplier: 1.08,
      eventChancePerMinute: 0.16,
      description: "钻石密集，但小目标更考验准度。",
    },
  },
  {
    id: 4,
    name: "地鼠乐园",
    mode: "mole",
    target: 3_150,
    durationSeconds: 62,
    itemCount: [19, 23],
    spawnPool: [
      { type: "smallGold", weight: 16, min: 2 },
      { type: "mediumGold", weight: 15, min: 2 },
      { type: "largeGold", weight: 7, max: 2 },
      { type: "diamond", weight: 6, max: 2 },
      { type: "rock", weight: 16, min: 2 },
      { type: "mysteryChest", weight: 5, max: 1 },
      { type: "mole", weight: 25, min: 4, max: 7 },
      { type: "diamondMole", weight: 10, min: 1, max: 3 },
    ],
    rules: {
      moleSpeedMultiplier: 1.18,
      eventChancePerMinute: 0.14,
      description: "会移动的目标增多，预判地鼠的方向。",
    },
  },
  {
    id: 5,
    name: "火药禁区",
    mode: "explosive",
    target: 4_050,
    durationSeconds: 58,
    itemCount: [20, 24],
    spawnPool: [
      { type: "smallGold", weight: 16, min: 2 },
      { type: "mediumGold", weight: 18, min: 2 },
      { type: "largeGold", weight: 10, min: 1, max: 3 },
      { type: "diamond", weight: 9, min: 1, max: 3 },
      { type: "rock", weight: 18, min: 3 },
      { type: "mysteryChest", weight: 5, max: 2 },
      { type: "tnt", weight: 18, min: 3, max: 5 },
      { type: "mole", weight: 6, max: 2 },
    ],
    rules: {
      tntBlastRadius: 88,
      eventChancePerMinute: 0.18,
      description: "炸药桶会清除附近物品，出钩前看清路线。",
    },
  },
  {
    id: 6,
    name: "沉睡深井",
    mode: "normal",
    target: 5_150,
    durationSeconds: 56,
    itemCount: [22, 26],
    spawnPool: [
      { type: "smallGold", weight: 15, min: 2 },
      { type: "mediumGold", weight: 18, min: 2 },
      { type: "largeGold", weight: 13, min: 2, max: 4 },
      { type: "diamond", weight: 9, min: 1, max: 3 },
      { type: "rock", weight: 25, min: 4 },
      { type: "mysteryChest", weight: 6, max: 2 },
      { type: "tnt", weight: 6, max: 2 },
      { type: "mole", weight: 8, max: 3 },
    ],
    rules: {
      pullSpeedMultiplier: 0.94,
      eventChancePerMinute: 0.2,
      description: "矿层更深，重物会显著拖慢卷扬机。",
    },
  },
  {
    id: 7,
    name: "四十秒淘金",
    mode: "rush",
    target: 5_900,
    durationSeconds: 42,
    itemCount: [20, 24],
    spawnPool: [
      { type: "smallGold", weight: 14, min: 2 },
      { type: "mediumGold", weight: 21, min: 3 },
      { type: "largeGold", weight: 12, min: 2, max: 4 },
      { type: "diamond", weight: 15, min: 2, max: 5 },
      { type: "rock", weight: 15, min: 2 },
      { type: "mysteryChest", weight: 8, max: 2 },
      { type: "mole", weight: 8, max: 2 },
      { type: "diamondMole", weight: 7, max: 2 },
    ],
    rules: {
      pullSpeedMultiplier: 1.12,
      eventChancePerMinute: 0.24,
      description: "极速关卡：时间很短，但卷扬机速度更快。",
    },
  },
  {
    id: 8,
    name: "爆破迷宫",
    mode: "explosive",
    target: 6_400,
    durationSeconds: 54,
    itemCount: [23, 28],
    spawnPool: [
      { type: "smallGold", weight: 12, min: 2 },
      { type: "mediumGold", weight: 16, min: 2 },
      { type: "largeGold", weight: 13, min: 2, max: 4 },
      { type: "diamond", weight: 11, min: 2, max: 4 },
      { type: "rock", weight: 20, min: 4 },
      { type: "mysteryChest", weight: 5, max: 2 },
      { type: "tnt", weight: 17, min: 4, max: 7 },
      { type: "diamondMole", weight: 6, max: 2 },
    ],
    rules: {
      tntBlastRadius: 104,
      moleSpeedMultiplier: 1.1,
      eventChancePerMinute: 0.25,
      description: "炸药与宝藏混杂，爆破既是威胁也是捷径。",
    },
  },
  {
    id: 9,
    name: "钻石狂潮",
    mode: "diamond",
    target: 8_900,
    durationSeconds: 52,
    itemCount: [24, 29],
    spawnPool: [
      { type: "smallGold", weight: 10, min: 1 },
      { type: "mediumGold", weight: 14, min: 2 },
      { type: "largeGold", weight: 9, min: 1, max: 3 },
      { type: "diamond", weight: 24, min: 5, max: 9 },
      { type: "rock", weight: 18, min: 3 },
      { type: "mysteryChest", weight: 7, max: 2 },
      { type: "tnt", weight: 7, max: 3 },
      { type: "mole", weight: 4, max: 2 },
      { type: "diamondMole", weight: 7, min: 1, max: 3 },
    ],
    rules: {
      rareValueMultiplier: 1.14,
      moleSpeedMultiplier: 1.22,
      eventChancePerMinute: 0.28,
      description: "高风险高回报，用连击放大钻石价值。",
    },
  },
  {
    id: 10,
    name: "老矿王试炼",
    mode: "mole",
    target: 9_000,
    durationSeconds: 55,
    itemCount: [26, 31],
    spawnPool: [
      { type: "smallGold", weight: 9, min: 1 },
      { type: "mediumGold", weight: 15, min: 2 },
      { type: "largeGold", weight: 12, min: 2, max: 4 },
      { type: "diamond", weight: 13, min: 2, max: 5 },
      { type: "rock", weight: 20, min: 4 },
      { type: "mysteryChest", weight: 6, max: 2 },
      { type: "tnt", weight: 9, min: 2, max: 4 },
      { type: "mole", weight: 9, min: 2, max: 4 },
      { type: "diamondMole", weight: 7, min: 1, max: 3 },
    ],
    rules: {
      pullSpeedMultiplier: 0.96,
      moleSpeedMultiplier: 1.38,
      rareValueMultiplier: 1.12,
      tntBlastRadius: 108,
      eventChancePerMinute: 0.32,
      description: "所有机制同时登场的终局挑战。",
    },
  },
] as const satisfies readonly LevelConfig[];

export const SHOP_ITEM_IDS = [
  "dynamite",
  "strengthTonic",
  "luckyClover",
  "rockCollectorsBook",
  "diamondPolish",
  "hourglass",
  "aimAssist",
] as const;

export type ShopItemId = (typeof SHOP_ITEM_IDS)[number];
export type ShopItemKind = "charge" | "nextLevel";

export interface ShopItemEffect {
  readonly dynamiteCharges?: number;
  readonly pullSpeedMultiplier?: number;
  readonly rareSpawnWeightMultiplier?: number;
  readonly rockValueMultiplier?: number;
  readonly diamondValueMultiplier?: number;
  readonly timeBonusSeconds?: number;
  readonly aimAssistSeconds?: number;
}

export interface ShopItemConfig {
  readonly id: ShopItemId;
  readonly name: string;
  readonly icon: string;
  readonly price: number;
  readonly description: string;
  readonly kind: ShopItemKind;
  readonly maxStack: number;
  readonly maxPerShop: number;
  readonly effect: ShopItemEffect;
}

export const SHOP_ITEMS = {
  dynamite: {
    id: "dynamite",
    name: "炸药",
    icon: "🧨",
    price: 180,
    description: "收回途中炸掉抓到的物品，立刻让抓钩空载返回。",
    kind: "charge",
    maxStack: 5,
    maxPerShop: 1,
    effect: { dynamiteCharges: 1 },
  },
  strengthTonic: {
    id: "strengthTonic",
    name: "力量药水",
    icon: "💪",
    price: 260,
    description: "下一关所有载物收回速度提高 35%。",
    kind: "nextLevel",
    maxStack: 1,
    maxPerShop: 1,
    effect: { pullSpeedMultiplier: 1.35 },
  },
  luckyClover: {
    id: "luckyClover",
    name: "幸运草",
    icon: "🍀",
    price: 300,
    description: "下一关钻石、宝箱和钻石地鼠的生成权重提高 85%。",
    kind: "nextLevel",
    maxStack: 1,
    maxPerShop: 1,
    effect: { rareSpawnWeightMultiplier: 1.85 },
  },
  rockCollectorsBook: {
    id: "rockCollectorsBook",
    name: "石头收藏册",
    icon: "📕",
    price: 160,
    description: "下一关岩石售价提高到 3 倍。",
    kind: "nextLevel",
    maxStack: 1,
    maxPerShop: 1,
    effect: { rockValueMultiplier: 3 },
  },
  diamondPolish: {
    id: "diamondPolish",
    name: "钻石抛光剂",
    icon: "✨",
    price: 420,
    description: "下一关钻石与钻石地鼠的价值提高 60%。",
    kind: "nextLevel",
    maxStack: 1,
    maxPerShop: 1,
    effect: { diamondValueMultiplier: 1.6 },
  },
  hourglass: {
    id: "hourglass",
    name: "时间沙漏",
    icon: "⌛",
    price: 360,
    description: "下一关额外增加 12 秒。",
    kind: "nextLevel",
    maxStack: 1,
    maxPerShop: 1,
    effect: { timeBonusSeconds: 12 },
  },
  aimAssist: {
    id: "aimAssist",
    name: "瞄准辅助",
    icon: "🎯",
    price: 240,
    description: "下一关前 18 秒显示抓钩预计轨迹。",
    kind: "nextLevel",
    maxStack: 1,
    maxPerShop: 1,
    effect: { aimAssistSeconds: 18 },
  },
} as const satisfies Record<ShopItemId, ShopItemConfig>;

export type AchievementMetric =
  | "totalCoins"
  | "highestCombo"
  | "diamondsCaught"
  | "levelsCleared"
  | "highestScore"
  | "perfectGrabs"
  | "rocksDestroyed";

export interface AchievementConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly metric: AchievementMetric;
  readonly threshold: number;
  readonly rewardCoins: number;
}

export const ACHIEVEMENTS = [
  {
    id: "first-payday",
    name: "第一桶金",
    description: "累计获得 2,000 金币",
    icon: "🪙",
    metric: "totalCoins",
    threshold: 2_000,
    rewardCoins: 120,
  },
  {
    id: "combo-architect",
    name: "连击建筑师",
    description: "单局达到 6 连击",
    icon: "🔥",
    metric: "highestCombo",
    threshold: 6,
    rewardCoins: 180,
  },
  {
    id: "diamond-eye",
    name: "钻石眼",
    description: "累计抓到 12 颗钻石",
    icon: "💎",
    metric: "diamondsCaught",
    threshold: 12,
    rewardCoins: 260,
  },
  {
    id: "deep-delver",
    name: "深井探险家",
    description: "累计通过 8 个关卡",
    icon: "⛏️",
    metric: "levelsCleared",
    threshold: 8,
    rewardCoins: 320,
  },
  {
    id: "five-figures",
    name: "五位数矿王",
    description: "单局最高分达到 10,000",
    icon: "👑",
    metric: "highestScore",
    threshold: 10_000,
    rewardCoins: 420,
  },
  {
    id: "precision-hook",
    name: "分毫不差",
    description: "累计完成 20 次完美抓取",
    icon: "🎯",
    metric: "perfectGrabs",
    threshold: 20,
    rewardCoins: 240,
  },
  {
    id: "rock-breaker",
    name: "碎岩专家",
    description: "累计炸毁 15 块岩石",
    icon: "💥",
    metric: "rocksDestroyed",
    threshold: 15,
    rewardCoins: 220,
  },
] as const satisfies readonly AchievementConfig[];

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

export interface AchievementStats {
  readonly totalCoins: number;
  readonly highestCombo: number;
  readonly diamondsCaught: number;
  readonly levelsCleared: number;
  readonly highestScore: number;
  readonly perfectGrabs: number;
  readonly rocksDestroyed: number;
}

export interface AchievementProgress {
  readonly achievement: AchievementConfig;
  readonly current: number;
  readonly ratio: number;
  readonly unlocked: boolean;
  readonly newlyUnlocked: boolean;
}

export type SeedValue = string | number;

export interface SeededRng {
  /** A float in the half-open interval [0, 1). */
  next(): number;
  /** A float in the half-open interval [min, max). */
  float(min: number, max: number): number;
  /** An integer in the inclusive interval [min, max]. */
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
  readonly initialSeed: number;
  readonly state: number;
}

export interface RandomStep {
  readonly value: number;
  readonly state: number;
}

const UINT32_RANGE = 4_294_967_296;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export function hashSeed(seed: SeedValue): number {
  const text = String(seed);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Stateless Mulberry32 step. Persist `state` to resume an exact random stream.
 */
export function nextSeededRandom(state: number): RandomStep {
  const nextState = (state + MULBERRY_INCREMENT) >>> 0;
  let mixed = nextState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

  return {
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE,
    state: nextState,
  };
}

export function createSeededRng(seed: SeedValue): SeededRng {
  const initialSeed = hashSeed(seed);
  let state = initialSeed;

  const next = (): number => {
    const step = nextSeededRandom(state);
    state = step.state;
    return step.value;
  };

  return {
    next,
    float(min: number, max: number): number {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
        throw new RangeError("RNG float range must be finite and max >= min.");
      }
      return min + next() * (max - min);
    },
    int(min: number, max: number): number {
      const lower = Math.ceil(min);
      const upper = Math.floor(max);
      if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper < lower) {
        throw new RangeError("RNG integer range must contain at least one integer.");
      }
      return lower + Math.floor(next() * (upper - lower + 1));
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) {
        throw new RangeError("Cannot choose from an empty list.");
      }
      return values[Math.floor(next() * values.length)] as T;
    },
    shuffle<T>(values: readonly T[]): T[] {
      const result = [...values];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        const held = result[index] as T;
        result[index] = result[swapIndex] as T;
        result[swapIndex] = held;
      }
      return result;
    },
    initialSeed,
    get state(): number {
      return state;
    },
  };
}

export function dailyChallengeDateKey(date: Date | string = new Date()): string {
  if (typeof date === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new RangeError("Invalid daily challenge date.");
    }
    return parsed.toISOString().slice(0, 10);
  }

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid daily challenge date.");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function seedForDailyChallenge(date: Date | string = new Date()): number {
  return hashSeed(`gold-miner-daily:${dailyChallengeDateKey(date)}`);
}

export interface MineBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface GeneratedMineItem {
  readonly id: string;
  readonly type: MineItemType;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly rotation: number;
  readonly value: number;
  readonly weight: number;
  readonly velocityX: number;
  readonly direction: -1 | 1;
  readonly collected: false;
}

export interface MineFieldGenerationOptions {
  readonly level: LevelConfig;
  readonly seed: SeedValue;
  readonly bounds: MineBounds;
  readonly itemCount?: number;
  /** Multiplies weights of diamond, chest, and diamond-mole entries. */
  readonly rareSpawnWeightMultiplier?: number;
  readonly minGap?: number;
  readonly edgePadding?: number;
  readonly maxPlacementAttempts?: number;
}

const RARE_ITEM_TYPES: ReadonlySet<MineItemType> = new Set([
  "diamond",
  "mysteryChest",
  "diamondMole",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function validateBounds(bounds: MineBounds): void {
  const values = [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY];
  if (!values.every(Number.isFinite)) {
    throw new RangeError("Mine bounds must be finite.");
  }
  if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    throw new RangeError("Mine bounds must have positive width and height.");
  }
}

function countTypes(types: readonly MineItemType[]): Map<MineItemType, number> {
  const counts = new Map<MineItemType, number>();
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

function pickWeightedType(
  rng: SeededRng,
  pool: readonly SpawnWeight[],
  currentTypes: readonly MineItemType[],
  rareMultiplier: number,
): MineItemType | undefined {
  const counts = countTypes(currentTypes);
  const eligible = pool
    .filter((entry) => (entry.max ?? Number.POSITIVE_INFINITY) > (counts.get(entry.type) ?? 0))
    .map((entry) => ({
      type: entry.type,
      weight:
        Math.max(0, entry.weight) *
        (RARE_ITEM_TYPES.has(entry.type) ? rareMultiplier : 1),
    }))
    .filter((entry) => entry.weight > 0);

  const totalWeight = eligible.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight <= 0) {
    return undefined;
  }

  let roll = rng.float(0, totalWeight);
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.type;
    }
  }

  return eligible[eligible.length - 1]?.type;
}

function createTypePlan(
  rng: SeededRng,
  pool: readonly SpawnWeight[],
  count: number,
  rareMultiplier: number,
): MineItemType[] {
  const types: MineItemType[] = [];

  for (const entry of pool) {
    const minimum = Math.max(0, Math.floor(entry.min ?? 0));
    const allowedMinimum = Math.min(minimum, entry.max ?? minimum);
    for (let index = 0; index < allowedMinimum && types.length < count; index += 1) {
      types.push(entry.type);
    }
  }

  while (types.length < count) {
    const picked = pickWeightedType(rng, pool, types, rareMultiplier);
    if (!picked) {
      break;
    }
    types.push(picked);
  }

  return rng.shuffle(types);
}

export function mineItemsOverlap(
  left: Pick<GeneratedMineItem, "x" | "y" | "radius">,
  right: Pick<GeneratedMineItem, "x" | "y" | "radius">,
  minGap = 0,
): boolean {
  const deltaX = left.x - right.x;
  const deltaY = left.y - right.y;
  const minDistance = left.radius + right.radius + Math.max(0, minGap);
  return deltaX * deltaX + deltaY * deltaY < minDistance * minDistance;
}

export function isMineItemPlacementValid(
  candidate: Pick<GeneratedMineItem, "x" | "y" | "radius">,
  placed: readonly Pick<GeneratedMineItem, "x" | "y" | "radius">[],
  bounds: MineBounds,
  minGap = 0,
  edgePadding = 0,
): boolean {
  const paddedRadius = candidate.radius + Math.max(0, edgePadding);
  if (
    candidate.x - paddedRadius < bounds.minX ||
    candidate.x + paddedRadius > bounds.maxX ||
    candidate.y - paddedRadius < bounds.minY ||
    candidate.y + paddedRadius > bounds.maxY
  ) {
    return false;
  }
  return !placed.some((item) => mineItemsOverlap(candidate, item, minGap));
}

/**
 * Deterministically builds a mine field using rejection placement.
 *
 * It never knowingly returns overlapping circles. If an unusually small
 * viewport cannot fit the configured count, it returns the largest valid
 * subset rather than stacking objects on top of each other.
 */
export function generateMineField(
  options: MineFieldGenerationOptions,
): GeneratedMineItem[] {
  const {
    level,
    seed,
    bounds,
    rareSpawnWeightMultiplier = 1,
    minGap = 7,
    edgePadding = 4,
    maxPlacementAttempts = 110,
  } = options;

  validateBounds(bounds);
  const rng = createSeededRng(`${level.id}:${seed}`);
  const minCount = Math.max(0, Math.floor(level.itemCount[0]));
  const maxCount = Math.max(minCount, Math.floor(level.itemCount[1]));
  const requestedCount =
    options.itemCount === undefined
      ? rng.int(minCount, maxCount)
      : clamp(Math.floor(options.itemCount), 0, maxCount);
  const typePlan = createTypePlan(
    rng,
    level.spawnPool,
    requestedCount,
    Math.max(0, rareSpawnWeightMultiplier),
  );
  const placed: GeneratedMineItem[] = [];
  const seedTag = rng.initialSeed.toString(36);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  for (let itemIndex = 0; itemIndex < typePlan.length; itemIndex += 1) {
    const type = typePlan[itemIndex] as MineItemType;
    const config: MineItemConfig = ITEM_CONFIGS[type];
    const radius = config.radius;
    let accepted: GeneratedMineItem | undefined;

    for (let attempt = 0; attempt < maxPlacementAttempts; attempt += 1) {
      const usableWidth = Math.max(0, width - (radius + edgePadding) * 2);
      const usableHeight = Math.max(0, height - (radius + edgePadding) * 2);
      if (usableWidth <= 0 || usableHeight <= 0) {
        break;
      }

      const normalizedY = Math.pow(rng.next(), 0.82);
      const x = bounds.minX + radius + edgePadding + rng.next() * usableWidth;
      const y = bounds.minY + radius + edgePadding + normalizedY * usableHeight;
      const valueMultiplier =
        config.family === "gem" || type === "diamondMole"
          ? level.rules.rareValueMultiplier ?? 1
          : 1;
      const value = Math.max(
        0,
        roundTo(
          (config.baseValue +
            rng.float(-config.valueVariance, config.valueVariance)) *
            valueMultiplier,
          5,
        ),
      );
      const speedRange = config.moveSpeedRange;
      const moveSpeed = speedRange
        ? rng.float(speedRange[0], speedRange[1]) *
          (level.rules.moleSpeedMultiplier ?? 1)
        : 0;
      const direction: -1 | 1 = rng.next() < 0.5 ? -1 : 1;
      const candidate: GeneratedMineItem = {
        id: `mine-${level.id}-${seedTag}-${itemIndex}`,
        type,
        x: roundTo(x, 0.1),
        y: roundTo(y, 0.1),
        radius,
        rotation: roundTo(rng.float(-0.24, 0.24), 0.001),
        value,
        weight: config.weight,
        velocityX: roundTo(moveSpeed * direction, 0.1),
        direction,
        collected: false,
      };

      if (
        isMineItemPlacementValid(
          candidate,
          placed,
          bounds,
          minGap,
          edgePadding,
        )
      ) {
        accepted = candidate;
        break;
      }
    }

    if (accepted) {
      placed.push(accepted);
    }
  }

  return placed;
}

export interface PullSpeedOptions {
  readonly baseSpeed?: number;
  readonly weightFactor?: number;
  readonly minimumSpeed?: number;
  readonly maximumSpeed?: number;
  readonly speedMultiplier?: number;
  readonly perfectGrab?: boolean;
}

/**
 * v = max(vMin, v0 / (1 + kW)), then applies explicit level/item bonuses.
 */
export function calculatePullSpeed(
  weight: number,
  options: PullSpeedOptions = {},
): number {
  const {
    baseSpeed = 620,
    weightFactor = 0.38,
    minimumSpeed = 128,
    maximumSpeed = 760,
    speedMultiplier = 1,
    perfectGrab = false,
  } = options;

  const safeWeight = Math.max(0, Number.isFinite(weight) ? weight : 0);
  const safeBase = Math.max(0, baseSpeed);
  const safeFactor = Math.max(0, weightFactor);
  const safeMinimum = Math.max(0, minimumSpeed);
  const safeMaximum = Math.max(safeMinimum, maximumSpeed);
  const modifier = Math.max(0, speedMultiplier) * (perfectGrab ? 1.18 : 1);
  return clamp(
    (safeBase / (1 + safeFactor * safeWeight)) * modifier,
    safeMinimum,
    safeMaximum,
  );
}

export function calculateEmptyHookReturnSpeed(baseSpeed = 760): number {
  return Math.max(0, baseSpeed);
}

export const COMBO_RULES = {
  qualifyingValue: 200,
  timeoutSeconds: 7,
  stepEvery: 2,
  multiplierStep: 0.25,
  maximumMultiplier: 3,
} as const;

export function calculateComboMultiplier(combo: number): number {
  const safeCombo = Math.max(0, Math.floor(combo));
  const steps = Math.floor(safeCombo / COMBO_RULES.stepEvery);
  return Math.min(
    COMBO_RULES.maximumMultiplier,
    1 + steps * COMBO_RULES.multiplierStep,
  );
}

export interface ComboOutcomeOptions {
  readonly currentCombo: number;
  readonly itemType?: MineItemType;
  readonly itemValue?: number;
  readonly elapsedSinceLastCatchSeconds?: number;
  readonly missed?: boolean;
  readonly destroyed?: boolean;
}

export interface ComboOutcome {
  readonly combo: number;
  readonly multiplier: number;
  readonly increased: boolean;
  readonly broken: boolean;
}

export function updateCombo(options: ComboOutcomeOptions): ComboOutcome {
  const current = Math.max(0, Math.floor(options.currentCombo));
  const elapsed = Math.max(0, options.elapsedSinceLastCatchSeconds ?? 0);
  const type = options.itemType;
  const config = type ? ITEM_CONFIGS[type] : undefined;
  const value = options.itemValue ?? (config?.baseValue ?? 0);
  const shouldBreak =
    options.missed === true ||
    options.destroyed === true ||
    elapsed > COMBO_RULES.timeoutSeconds ||
    type === "rock" ||
    type === "tnt" ||
    !config?.comboEligible ||
    value < COMBO_RULES.qualifyingValue;
  const combo = shouldBreak ? 0 : current + 1;

  return {
    combo,
    multiplier: calculateComboMultiplier(combo),
    increased: !shouldBreak,
    broken: shouldBreak && current > 0,
  };
}

export interface LevelItemEffects {
  readonly dynamiteCharges: number;
  readonly pullSpeedMultiplier: number;
  readonly rareSpawnWeightMultiplier: number;
  readonly rockValueMultiplier: number;
  readonly diamondValueMultiplier: number;
  readonly timeBonusSeconds: number;
  readonly aimAssistSeconds: number;
}

export type ShopInventory = Readonly<Partial<Record<ShopItemId, number>>>;
export type PurchasedThisShop = Readonly<Partial<Record<ShopItemId, number>>>;

export interface ShopState {
  readonly coins: number;
  readonly inventory: ShopInventory;
  readonly purchasedThisShop: PurchasedThisShop;
}

export type PurchaseFailureReason =
  | "UNKNOWN_ITEM"
  | "INVALID_BALANCE"
  | "INSUFFICIENT_COINS"
  | "ALREADY_PURCHASED"
  | "STACK_FULL";

export type PurchaseValidation =
  | {
      readonly ok: true;
      readonly item: ShopItemConfig;
      readonly cost: number;
      readonly remainingCoins: number;
    }
  | {
      readonly ok: false;
      readonly item?: ShopItemConfig;
      readonly reason: PurchaseFailureReason;
      readonly message: string;
    };

export type PurchaseResult =
  | {
      readonly ok: true;
      readonly item: ShopItemConfig;
      readonly state: ShopState;
    }
  | {
      readonly ok: false;
      readonly reason: PurchaseFailureReason;
      readonly message: string;
      readonly state: ShopState;
    };

function isShopItemId(value: string): value is ShopItemId {
  return SHOP_ITEM_IDS.includes(value as ShopItemId);
}

export function createShopState(
  coins: number,
  inventory: ShopInventory = {},
): ShopState {
  return {
    coins: Math.max(0, Math.floor(Number.isFinite(coins) ? coins : 0)),
    inventory: { ...inventory },
    purchasedThisShop: {},
  };
}

export function validatePurchase(
  state: ShopState,
  itemId: string,
): PurchaseValidation {
  if (!isShopItemId(itemId)) {
    return {
      ok: false,
      reason: "UNKNOWN_ITEM",
      message: "这个商品不存在。",
    };
  }

  const item = SHOP_ITEMS[itemId];
  if (!Number.isFinite(state.coins) || state.coins < 0) {
    return {
      ok: false,
      item,
      reason: "INVALID_BALANCE",
      message: "金币余额无效。",
    };
  }

  if ((state.purchasedThisShop[itemId] ?? 0) >= item.maxPerShop) {
    return {
      ok: false,
      item,
      reason: "ALREADY_PURCHASED",
      message: "本次商店已经购买过该道具。",
    };
  }

  if ((state.inventory[itemId] ?? 0) >= item.maxStack) {
    return {
      ok: false,
      item,
      reason: "STACK_FULL",
      message: "该道具持有数量已达上限。",
    };
  }

  if (state.coins < item.price) {
    return {
      ok: false,
      item,
      reason: "INSUFFICIENT_COINS",
      message: `还差 ${item.price - state.coins} 金币。`,
    };
  }

  return {
    ok: true,
    item,
    cost: item.price,
    remainingCoins: state.coins - item.price,
  };
}

/**
 * Atomic shop transaction: invalid or repeated requests return the exact
 * original state and never deduct coins a second time.
 */
export function purchaseShopItem(
  state: ShopState,
  itemId: string,
): PurchaseResult {
  const validation = validatePurchase(state, itemId);
  if (!validation.ok) {
    return { ...validation, state };
  }

  const typedId = validation.item.id;
  return {
    ok: true,
    item: validation.item,
    state: {
      coins: validation.remainingCoins,
      inventory: {
        ...state.inventory,
        [typedId]: (state.inventory[typedId] ?? 0) + 1,
      },
      purchasedThisShop: {
        ...state.purchasedThisShop,
        [typedId]: (state.purchasedThisShop[typedId] ?? 0) + 1,
      },
    },
  };
}

export function resolveLevelItemEffects(
  inventory: ShopInventory,
): LevelItemEffects {
  const count = (itemId: ShopItemId): number =>
    Math.max(0, Math.floor(inventory[itemId] ?? 0));

  return {
    dynamiteCharges:
      count("dynamite") * SHOP_ITEMS.dynamite.effect.dynamiteCharges,
    pullSpeedMultiplier:
      count("strengthTonic") > 0
        ? SHOP_ITEMS.strengthTonic.effect.pullSpeedMultiplier
        : 1,
    rareSpawnWeightMultiplier:
      count("luckyClover") > 0
        ? SHOP_ITEMS.luckyClover.effect.rareSpawnWeightMultiplier
        : 1,
    rockValueMultiplier:
      count("rockCollectorsBook") > 0
        ? SHOP_ITEMS.rockCollectorsBook.effect.rockValueMultiplier
        : 1,
    diamondValueMultiplier:
      count("diamondPolish") > 0
        ? SHOP_ITEMS.diamondPolish.effect.diamondValueMultiplier
        : 1,
    timeBonusSeconds:
      count("hourglass") > 0
        ? SHOP_ITEMS.hourglass.effect.timeBonusSeconds
        : 0,
    aimAssistSeconds:
      count("aimAssist") > 0
        ? SHOP_ITEMS.aimAssist.effect.aimAssistSeconds
        : 0,
  };
}

export interface CatchScoreOptions {
  readonly baseValue: number;
  readonly itemType: MineItemType;
  readonly combo: number;
  readonly perfectGrab?: boolean;
  readonly rockValueMultiplier?: number;
  readonly diamondValueMultiplier?: number;
  readonly doubleValue?: boolean;
}

export interface CatchScoreBreakdown {
  readonly adjustedBaseValue: number;
  readonly comboMultiplier: number;
  readonly perfectMultiplier: number;
  readonly eventMultiplier: number;
  readonly total: number;
}

export function calculateCatchScore(
  options: CatchScoreOptions,
): CatchScoreBreakdown {
  const baseValue = Math.max(
    0,
    Number.isFinite(options.baseValue) ? options.baseValue : 0,
  );
  const familyMultiplier =
    options.itemType === "rock"
      ? Math.max(0, options.rockValueMultiplier ?? 1)
      : options.itemType === "diamond" || options.itemType === "diamondMole"
        ? Math.max(0, options.diamondValueMultiplier ?? 1)
        : 1;
  const adjustedBaseValue = baseValue * familyMultiplier;
  const comboMultiplier = calculateComboMultiplier(options.combo);
  const perfectMultiplier = options.perfectGrab ? 1.25 : 1;
  const eventMultiplier = options.doubleValue ? 2 : 1;

  return {
    adjustedBaseValue: Math.round(adjustedBaseValue),
    comboMultiplier,
    perfectMultiplier,
    eventMultiplier,
    total: Math.round(
      adjustedBaseValue *
        comboMultiplier *
        perfectMultiplier *
        eventMultiplier,
    ),
  };
}

export function evaluateAchievements(
  stats: AchievementStats,
  unlockedIds: readonly string[] = [],
): AchievementProgress[] {
  const unlocked = new Set(unlockedIds);
  return ACHIEVEMENTS.map((achievement) => {
    const rawCurrent = stats[achievement.metric];
    const current = Math.max(0, Number.isFinite(rawCurrent) ? rawCurrent : 0);
    const meetsThreshold = current >= achievement.threshold;
    return {
      achievement,
      current,
      ratio: clamp(current / achievement.threshold, 0, 1),
      unlocked: unlocked.has(achievement.id) || meetsThreshold,
      newlyUnlocked: meetsThreshold && !unlocked.has(achievement.id),
    };
  });
}

/**
 * Returns a configured campaign level. Levels after the authored campaign use
 * a deterministic, increasingly difficult remix of the final configuration.
 */
export function getLevelConfig(levelNumber: number): LevelConfig {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const authored = LEVEL_CONFIGS[safeLevel - 1];
  if (authored) {
    return authored;
  }

  const finalLevel: LevelConfig =
    LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1] as LevelConfig;
  const extra = safeLevel - LEVEL_CONFIGS.length;
  return {
    ...finalLevel,
    id: safeLevel,
    name: `无尽矿层 ${extra}`,
    mode: "endless",
    target: Math.round(finalLevel.target * Math.pow(1.17, extra)),
    durationSeconds: Math.max(40, finalLevel.durationSeconds - Math.floor(extra / 2)),
    itemCount: [
      Math.min(36, finalLevel.itemCount[0] + Math.floor(extra / 2)),
      Math.min(40, finalLevel.itemCount[1] + Math.ceil(extra / 2)),
    ],
    rules: {
      ...finalLevel.rules,
      moleSpeedMultiplier:
        (finalLevel.rules.moleSpeedMultiplier ?? 1) * (1 + extra * 0.045),
      eventChancePerMinute: Math.min(
        0.48,
        (finalLevel.rules.eventChancePerMinute ?? 0) + extra * 0.015,
      ),
      description: "不断变深的无尽矿层，目标与移动速度逐层提高。",
    },
  };
}
