import type {
  GeneratedMineItem,
  LevelConfig,
  LevelItemEffects,
  MineItemType,
  SeedValue,
} from "../model";

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

export interface ActiveEvent {
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
  parent: HTMLElement;
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

export type RuntimeMineItemState =
  | "active"
  | "attached"
  | "collected"
  | "destroyed";

export interface RuntimeMineItem extends Omit<GeneratedMineItem, "x" | "y"> {
  x: number;
  y: number;
  state: RuntimeMineItemState;
  vx: number;
  previousX: number;
  previousY: number;
  phase: number;
  flash: number;
}

export interface HookSnapshot {
  state: HookState;
  angle: number;
  length: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  attachedId: string | null;
  perfect: boolean;
  pullWeight: number;
}

export interface SimulationSnapshot {
  elapsed: number;
  paused: boolean;
  terminal: boolean;
  score: number;
  combo: number;
  multiplier: number;
  timeRemaining: number;
  dynamite: number;
  activeEvent: ActiveEvent | null;
  hook: HookSnapshot;
  items: readonly RuntimeMineItem[];
}

export type SimulationEffectKind =
  | "grab"
  | "gold"
  | "diamond"
  | "rock-break"
  | "explosion"
  | "combo"
  | "success"
  | "failure"
  | "event";

export type SimulationEvent =
  | {
      type: "effect";
      kind: SimulationEffectKind;
      x: number;
      y: number;
      value?: number;
    }
  | {
      type: "floating-text";
      x: number;
      y: number;
      text: string;
      color: string;
      scale?: number;
    }
  | { type: "camera-shake"; intensity: number; duration: number }
  | { type: "sound"; name: SoundName }
  | { type: "announcement"; message: string }
  | { type: "item-added"; item: RuntimeMineItem }
  | {
      type: "item-removed";
      id: string;
      reason: "collected" | "destroyed";
    }
  | { type: "finished"; result: LevelResult };

export interface SimulationOptions {
  level: LevelConfig;
  items: readonly GeneratedMineItem[];
  effects: LevelItemEffects;
  mode: GameMode;
  seed: SeedValue;
  initialDynamite?: number;
  reducedMotion?: boolean;
}

export interface CollisionHit {
  item: RuntimeMineItem;
  t: number;
  perfect: boolean;
}

export interface SpawnedItemOptions {
  id: string;
  type: MineItemType;
  x: number;
  y: number;
}
