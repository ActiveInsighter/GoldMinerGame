/**
 * Versioned and defensive local persistence for Gold Miner.
 *
 * The module is safe to import during SSR. Storage is resolved lazily and all
 * browser/storage errors fall back to an in-memory default result.
 */

export const GAME_STORAGE_KEY = "gold-miner:save";
export const GAME_STORAGE_VERSION = 2 as const;

export type GameMode = "classic" | "daily" | "endless";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface StoredAudioSettings {
  volume: number;
  muted: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
}

export interface AchievementStats {
  highestCombo: number;
  diamondsCollected: number;
  levelsCompleted: number;
  perfectGrabs: number;
  rocksDestroyed: number;
  itemsCollected: number;
  dynamiteUsed: number;
}

export interface DailyChallengeRecord {
  /** Local calendar date in YYYY-MM-DD form. */
  date: string;
  highScore: number;
  completed: boolean;
  bestCombo: number;
  attempts: number;
}

export type DailyChallengeInput = Omit<DailyChallengeRecord, "attempts"> & {
  attempts?: number;
};

export interface ContinueProgress {
  mode: GameMode;
  level: number;
  score: number;
  gold?: number;
  timeRemaining?: number;
  dynamite?: number;
  seed?: number;
  inventory?: Record<string, number>;
  /**
   * Optional game-owned serializable state. Keeping this namespaced lets the
   * core save format evolve without knowing every canvas entity field.
   */
  snapshot?: JsonObject;
  savedAt: number;
}

export type ContinueProgressInput = Omit<ContinueProgress, "savedAt"> & {
  savedAt?: number;
};

export interface GameSaveData {
  version: typeof GAME_STORAGE_VERSION;
  highScore: number;
  highestLevel: number;
  totalGold: number;
  achievementStats: AchievementStats;
  unlockedAchievements: string[];
  unlockedContent: string[];
  dailyChallenges: Record<string, DailyChallengeRecord>;
  audio: StoredAudioSettings;
  continueProgress: ContinueProgress | null;
  updatedAt: number;
}

export interface GameSavePatch
  extends Partial<
    Omit<
      GameSaveData,
      | "version"
      | "achievementStats"
      | "dailyChallenges"
      | "audio"
      | "continueProgress"
    >
  > {
  achievementStats?: Partial<AchievementStats>;
  dailyChallenges?: Record<string, DailyChallengeRecord>;
  audio?: Partial<StoredAudioSettings>;
  continueProgress?: ContinueProgress | null;
}

export interface RunSummary {
  score: number;
  level: number;
  goldEarned: number;
  highestCombo?: number;
  diamondsCollected?: number;
  levelsCompleted?: number;
  perfectGrabs?: number;
  rocksDestroyed?: number;
  itemsCollected?: number;
  dynamiteUsed?: number;
  unlockedAchievements?: readonly string[];
  unlockedContent?: readonly string[];
}

export type SaveUpdater = (current: GameSaveData) => GameSaveData | GameSavePatch;

const DEFAULT_AUDIO: Readonly<StoredAudioSettings> = Object.freeze({
  volume: 0.72,
  muted: false,
  sfxEnabled: true,
  musicEnabled: true,
});

const DEFAULT_ACHIEVEMENT_STATS: Readonly<AchievementStats> = Object.freeze({
  highestCombo: 0,
  diamondsCollected: 0,
  levelsCompleted: 0,
  perfectGrabs: 0,
  rocksDestroyed: 0,
  itemsCollected: 0,
  dynamiteUsed: 0,
});

const MAX_DAILY_RECORDS = 120;
const MAX_STRING_LIST_LENGTH = 256;
const MAX_ID_LENGTH = 96;
const MAX_JSON_DEPTH = 12;

const LEGACY_STORAGE_KEYS = ["gold-miner-save", "goldMinerSave"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function volumeValue(value: unknown, fallback = DEFAULT_AUDIO.volume): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

function gameMode(value: unknown): GameMode {
  return value === "daily" || value === "endless" ? value : "classic";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().slice(0, MAX_ID_LENGTH);
    if (normalized) {
      unique.add(normalized);
    }
    if (unique.size >= MAX_STRING_LIST_LENGTH) {
      break;
    }
  }
  return [...unique];
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function sanitizeJsonValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (depth >= MAX_JSON_DEPTH || typeof value !== "object") {
    return undefined;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (const item of value) {
      const sanitized = sanitizeJsonValue(item, depth + 1, seen);
      if (sanitized !== undefined) {
        result.push(sanitized);
      }
    }
    seen.delete(value);
    return result;
  }

  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value).slice(0, 512)) {
    const sanitized = sanitizeJsonValue(item, depth + 1, seen);
    if (sanitized !== undefined) {
      result[key.slice(0, MAX_ID_LENGTH)] = sanitized;
    }
  }
  seen.delete(value);
  return result;
}

function normalizeAudio(value: unknown): StoredAudioSettings {
  const source = isRecord(value) ? value : {};
  return {
    volume: volumeValue(source.volume),
    muted: booleanValue(source.muted, DEFAULT_AUDIO.muted),
    sfxEnabled: booleanValue(source.sfxEnabled, DEFAULT_AUDIO.sfxEnabled),
    musicEnabled: booleanValue(source.musicEnabled, DEFAULT_AUDIO.musicEnabled),
  };
}

function normalizeAchievementStats(value: unknown): AchievementStats {
  const source = isRecord(value) ? value : {};
  return {
    highestCombo: nonNegativeInteger(source.highestCombo),
    diamondsCollected: nonNegativeInteger(source.diamondsCollected),
    levelsCompleted: nonNegativeInteger(source.levelsCompleted),
    perfectGrabs: nonNegativeInteger(source.perfectGrabs),
    rocksDestroyed: nonNegativeInteger(source.rocksDestroyed),
    itemsCollected: nonNegativeInteger(source.itemsCollected),
    dynamiteUsed: nonNegativeInteger(source.dynamiteUsed),
  };
}

function normalizeDailyRecord(
  value: unknown,
  fallbackDate?: string,
): DailyChallengeRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const date =
    typeof value.date === "string" && isDateKey(value.date)
      ? value.date
      : fallbackDate && isDateKey(fallbackDate)
        ? fallbackDate
        : null;
  if (!date) {
    return null;
  }

  return {
    date,
    highScore: nonNegativeInteger(value.highScore ?? value.bestScore),
    completed: booleanValue(value.completed, false),
    bestCombo: nonNegativeInteger(value.bestCombo),
    attempts: nonNegativeInteger(value.attempts),
  };
}

function normalizeDailyChallenges(value: unknown): Record<string, DailyChallengeRecord> {
  if (!isRecord(value)) {
    return {};
  }

  const records: Array<[string, DailyChallengeRecord]> = [];
  for (const [key, item] of Object.entries(value)) {
    const record = normalizeDailyRecord(item, key);
    if (record) {
      records.push([record.date, record]);
    }
  }

  records.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(records.slice(-MAX_DAILY_RECORDS));
}

function normalizeInventory(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const inventory: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value).slice(0, 128)) {
    const normalizedKey = key.trim().slice(0, MAX_ID_LENGTH);
    if (normalizedKey) {
      inventory[normalizedKey] = nonNegativeInteger(amount);
    }
  }
  return inventory;
}

function normalizeProgress(value: unknown): ContinueProgress | null {
  if (!isRecord(value)) {
    return null;
  }

  const snapshotValue = sanitizeJsonValue(value.snapshot);
  const snapshot = isRecord(snapshotValue) ? (snapshotValue as JsonObject) : undefined;
  const inventory = normalizeInventory(value.inventory);
  const progress: ContinueProgress = {
    mode: gameMode(value.mode),
    level: Math.max(1, nonNegativeInteger(value.level, 1)),
    score: nonNegativeInteger(value.score),
    savedAt: nonNegativeInteger(value.savedAt),
  };

  if (typeof value.gold === "number" && Number.isFinite(value.gold)) {
    progress.gold = nonNegativeInteger(value.gold);
  }
  if (typeof value.timeRemaining === "number" && Number.isFinite(value.timeRemaining)) {
    progress.timeRemaining = Math.max(0, finiteNumber(value.timeRemaining));
  }
  if (typeof value.dynamite === "number" && Number.isFinite(value.dynamite)) {
    progress.dynamite = nonNegativeInteger(value.dynamite);
  }
  if (typeof value.seed === "number" && Number.isFinite(value.seed)) {
    progress.seed = Math.floor(value.seed);
  }
  if (inventory) {
    progress.inventory = inventory;
  }
  if (snapshot) {
    progress.snapshot = snapshot;
  }

  return progress;
}

function legacyToCurrent(value: Record<string, unknown>): Record<string, unknown> {
  const legacyAchievements = value.achievements;
  const dailyChallenges =
    value.dailyChallenges ??
    (isRecord(value.dailyChallenge) &&
    typeof value.dailyChallenge.date === "string" &&
    isDateKey(value.dailyChallenge.date)
      ? { [value.dailyChallenge.date]: value.dailyChallenge }
      : {});

  return {
    version: GAME_STORAGE_VERSION,
    highScore: value.highScore ?? value.bestScore,
    highestLevel: value.highestLevel ?? value.maxLevel,
    totalGold: value.totalGold ?? value.lifetimeGold,
    achievementStats:
      value.achievementStats ?? (isRecord(legacyAchievements) ? legacyAchievements : {}),
    unlockedAchievements:
      value.unlockedAchievements ?? (Array.isArray(legacyAchievements) ? legacyAchievements : []),
    unlockedContent: value.unlockedContent,
    dailyChallenges,
    audio: value.audio ?? value.settings,
    continueProgress: value.continueProgress ?? value.progress,
    updatedAt: value.updatedAt,
  };
}

function normalizeSaveData(value: unknown): GameSaveData {
  const original = isRecord(value) ? value : {};
  const source =
    original.version === GAME_STORAGE_VERSION ? original : legacyToCurrent(original);

  return {
    version: GAME_STORAGE_VERSION,
    highScore: nonNegativeInteger(source.highScore),
    highestLevel: Math.max(1, nonNegativeInteger(source.highestLevel, 1)),
    totalGold: nonNegativeInteger(source.totalGold),
    achievementStats: normalizeAchievementStats(source.achievementStats),
    unlockedAchievements: stringList(source.unlockedAchievements),
    unlockedContent: stringList(source.unlockedContent),
    dailyChallenges: normalizeDailyChallenges(source.dailyChallenges),
    audio: normalizeAudio(source.audio),
    continueProgress: normalizeProgress(source.continueProgress),
    updatedAt: nonNegativeInteger(source.updatedAt),
  };
}

function mergePatch(current: GameSaveData, patch: GameSavePatch): GameSaveData {
  return normalizeSaveData({
    ...current,
    ...patch,
    achievementStats: {
      ...current.achievementStats,
      ...patch.achievementStats,
    },
    dailyChallenges: {
      ...current.dailyChallenges,
      ...patch.dailyChallenges,
    },
    audio: {
      ...current.audio,
      ...patch.audio,
    },
    continueProgress:
      patch.continueProgress === undefined
        ? current.continueProgress
        : patch.continueProgress,
    version: GAME_STORAGE_VERSION,
    updatedAt: Date.now(),
  });
}

export function createDefaultSaveData(): GameSaveData {
  return {
    version: GAME_STORAGE_VERSION,
    highScore: 0,
    highestLevel: 1,
    totalGold: 0,
    achievementStats: { ...DEFAULT_ACHIEVEMENT_STATS },
    unlockedAchievements: [],
    unlockedContent: [],
    dailyChallenges: {},
    audio: { ...DEFAULT_AUDIO },
    continueProgress: null,
    updatedAt: 0,
  };
}

export class GameStorage {
  constructor(
    private readonly key = GAME_STORAGE_KEY,
    private readonly injectedStorage?: Storage,
  ) {}

  isAvailable(): boolean {
    return this.resolveStorage() !== null;
  }

  load(): GameSaveData {
    const storage = this.resolveStorage();
    if (!storage) {
      return createDefaultSaveData();
    }

    let sourceKey = this.key;
    let raw: string | null = null;
    try {
      raw = storage.getItem(sourceKey);
      if (raw === null && this.key === GAME_STORAGE_KEY) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacyRaw = storage.getItem(legacyKey);
          if (legacyRaw !== null) {
            raw = legacyRaw;
            sourceKey = legacyKey;
            break;
          }
        }
      }
    } catch {
      return createDefaultSaveData();
    }

    if (raw === null) {
      return createDefaultSaveData();
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        this.removeKey(storage, sourceKey);
        return createDefaultSaveData();
      }

      const storedVersion = nonNegativeInteger(parsed.version);
      if (storedVersion > GAME_STORAGE_VERSION) {
        this.removeKey(storage, sourceKey);
        return createDefaultSaveData();
      }

      const normalized = normalizeSaveData(parsed);
      const normalizedJson = JSON.stringify(normalized);
      if (sourceKey !== this.key || normalizedJson !== raw) {
        if (this.write(storage, normalized)) {
          if (sourceKey !== this.key) {
            this.removeKey(storage, sourceKey);
          }
        }
      }
      return normalized;
    } catch {
      this.removeKey(storage, sourceKey);
      return createDefaultSaveData();
    }
  }

  /** Writes a complete save after validating and clamping every field. */
  save(data: GameSaveData): boolean {
    const storage = this.resolveStorage();
    if (!storage) {
      return false;
    }
    const normalized = normalizeSaveData({
      ...data,
      version: GAME_STORAGE_VERSION,
      updatedAt: Date.now(),
    });
    return this.write(storage, normalized);
  }

  /**
   * Applies a shallow patch with nested merging for stats, audio, and daily
   * records. The returned data is useful even when localStorage is unavailable.
   */
  update(patchOrUpdater: GameSavePatch | SaveUpdater): GameSaveData {
    const current = this.load();
    const patch =
      typeof patchOrUpdater === "function"
        ? patchOrUpdater(structuredCloneSafe(current))
        : patchOrUpdater;
    const next = mergePatch(current, patch);
    const storage = this.resolveStorage();
    if (storage) {
      this.write(storage, next);
    }
    return next;
  }

  saveAudioSettings(settings: Partial<StoredAudioSettings>): GameSaveData {
    return this.update({ audio: settings });
  }

  saveProgress(progress: ContinueProgressInput): GameSaveData {
    const normalized = normalizeProgress({
      ...progress,
      savedAt: progress.savedAt ?? Date.now(),
    });
    return this.update({ continueProgress: normalized });
  }

  clearProgress(): GameSaveData {
    return this.update({ continueProgress: null });
  }

  hasProgress(): boolean {
    return this.load().continueProgress !== null;
  }

  getDailyChallenge(date: string): DailyChallengeRecord | null {
    if (!isDateKey(date)) {
      return null;
    }
    return this.load().dailyChallenges[date] ?? null;
  }

  saveDailyChallenge(record: DailyChallengeInput): GameSaveData {
    const normalized = normalizeDailyRecord(record);
    if (!normalized) {
      return this.load();
    }

    const current = this.load().dailyChallenges[normalized.date];
    const merged: DailyChallengeRecord = {
      date: normalized.date,
      highScore: Math.max(current?.highScore ?? 0, normalized.highScore),
      completed: (current?.completed ?? false) || normalized.completed,
      bestCombo: Math.max(current?.bestCombo ?? 0, normalized.bestCombo),
      attempts: Math.max(current?.attempts ?? 0, normalized.attempts),
    };
    return this.update({ dailyChallenges: { [merged.date]: merged } });
  }

  unlockAchievement(id: string): GameSaveData {
    const current = this.load();
    return this.update({
      unlockedAchievements: stringList([...current.unlockedAchievements, id]),
    });
  }

  unlockContent(id: string): GameSaveData {
    const current = this.load();
    return this.update({
      unlockedContent: stringList([...current.unlockedContent, id]),
    });
  }

  /**
   * Records one completed/failed run. Counters are additive while score,
   * level and combo fields keep their maxima.
   */
  recordRun(summary: RunSummary): GameSaveData {
    const current = this.load();
    return this.update({
      highScore: Math.max(current.highScore, nonNegativeInteger(summary.score)),
      highestLevel: Math.max(
        current.highestLevel,
        Math.max(1, nonNegativeInteger(summary.level, 1)),
      ),
      totalGold:
        current.totalGold + nonNegativeInteger(summary.goldEarned),
      achievementStats: {
        highestCombo: Math.max(
          current.achievementStats.highestCombo,
          nonNegativeInteger(summary.highestCombo),
        ),
        diamondsCollected:
          current.achievementStats.diamondsCollected +
          nonNegativeInteger(summary.diamondsCollected),
        levelsCompleted:
          current.achievementStats.levelsCompleted +
          nonNegativeInteger(summary.levelsCompleted),
        perfectGrabs:
          current.achievementStats.perfectGrabs +
          nonNegativeInteger(summary.perfectGrabs),
        rocksDestroyed:
          current.achievementStats.rocksDestroyed +
          nonNegativeInteger(summary.rocksDestroyed),
        itemsCollected:
          current.achievementStats.itemsCollected +
          nonNegativeInteger(summary.itemsCollected),
        dynamiteUsed:
          current.achievementStats.dynamiteUsed +
          nonNegativeInteger(summary.dynamiteUsed),
      },
      unlockedAchievements: stringList([
        ...current.unlockedAchievements,
        ...(summary.unlockedAchievements ?? []),
      ]),
      unlockedContent: stringList([
        ...current.unlockedContent,
        ...(summary.unlockedContent ?? []),
      ]),
    });
  }

  /** Removes current and known legacy saves, restoring all defaults. */
  reset(): GameSaveData {
    const storage = this.resolveStorage();
    if (storage) {
      this.removeKey(storage, this.key);
      if (this.key === GAME_STORAGE_KEY) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          this.removeKey(storage, legacyKey);
        }
      }
    }
    return createDefaultSaveData();
  }

  private resolveStorage(): Storage | null {
    if (this.injectedStorage) {
      return this.injectedStorage;
    }
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private write(storage: Storage, data: GameSaveData): boolean {
    try {
      storage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  private removeKey(storage: Storage, key: string): void {
    try {
      storage.removeItem(key);
    } catch {
      // Storage can be denied or exhausted; defaults are still returned.
    }
  }
}

function structuredCloneSafe(data: GameSaveData): GameSaveData {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(data);
    } catch {
      // Fall through to the normalized JSON-compatible copy.
    }
  }
  return normalizeSaveData(JSON.parse(JSON.stringify(data)) as unknown);
}

/** SSR-safe shared store. Browser storage is looked up only when used. */
export const gameStorage = new GameStorage();
