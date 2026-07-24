"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArtImage } from "./components/ArtImage";
import { GameIcon } from "./components/GameIcon";
import { ArtAssets } from "./config/artAssets";
import { gameAudio, type AudioSettings } from "./game/audio";
import {
  GoldMinerEngine,
  type GameMode,
  type HudSnapshot,
  type LevelResult,
} from "./game/engine";
import {
  SHOP_ITEMS,
  createShopState,
  dailyChallengeDateKey,
  evaluateAchievements,
  generateMineField,
  getLevelConfig,
  purchaseShopItem,
  resolveLevelItemEffects,
  seedForDailyChallenge,
  type GeneratedMineItem,
  type LevelConfig,
  type LevelItemEffects,
  type ShopInventory,
  type ShopItemId,
  type ShopState,
} from "./game/model";
import {
  createDefaultSaveData,
  gameStorage,
  type GameSaveData,
  type StoredAudioSettings,
} from "./game/storage";

type Screen =
  | "menu"
  | "game"
  | "result"
  | "failure"
  | "shop"
  | "achievements"
  | "help"
  | "settings";

interface RunState {
  mode: GameMode;
  level: number;
  wallet: number;
  totalScore: number;
  dynamite: number;
  inventory: ShopInventory;
}

interface Session {
  key: number;
  config: LevelConfig;
  items: readonly GeneratedMineItem[];
  effects: LevelItemEffects;
  mode: GameMode;
  seed: string | number;
  initialDynamite: number;
}

interface ResultView {
  result: LevelResult;
  runScore: number;
  rewardCoins: number;
  newAchievements: string[];
}

const DEFAULT_HUD: HudSnapshot = {
  level: 1,
  levelName: "初探金脉",
  mode: "campaign",
  score: 0,
  target: 720,
  secondsLeft: 65,
  combo: 0,
  multiplier: 1,
  dynamite: 0,
  hookState: "swinging",
  paused: false,
  event: null,
  warning: false,
};

const VISUAL_PARAMS = new URLSearchParams(window.location.search);
const VISUAL_SHOP_PREVIEW =
  VISUAL_PARAMS.has("visual") &&
  VISUAL_PARAMS.get("visualScreen") === "shop";
const VISUAL_PREVIEW_RUN: RunState = {
  mode: "campaign",
  level: 2,
  wallet: 2_450,
  totalScore: 1_620,
  dynamite: 1,
  inventory: {},
};
const VISUAL_PREVIEW_SHOP: ShopState = createShopState(
  VISUAL_PREVIEW_RUN.wallet,
  VISUAL_PREVIEW_RUN.inventory,
);
const INITIAL_SCREEN: Screen = VISUAL_SHOP_PREVIEW ? "shop" : "menu";

function formatCoins(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString("zh-CN");
}

function modeLabel(mode: GameMode): string {
  if (mode === "daily") return "每日挑战";
  if (mode === "endless") return "无尽矿井";
  return "经典闯关";
}

function localDateLabel(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function createModeConfig(mode: GameMode, levelNumber: number): LevelConfig {
  if (mode === "daily") {
    const base = getLevelConfig(3);
    return {
      ...base,
      id: 1,
      name: `今日矿脉 · ${localDateLabel()}`,
      target: 2_600,
      durationSeconds: 70,
      rules: {
        ...base.rules,
        eventChancePerMinute: 0.22,
        description: "每天固定布局，和所有淘金客挑战同一条矿脉。",
      },
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
      rules: {
        ...base.rules,
        eventChancePerMinute: 0.28,
        description: "没有目标线，抓取物品可补充少量时间。",
      },
    };
  }
  return getLevelConfig(levelNumber);
}

function balanceField(
  items: readonly GeneratedMineItem[],
  target: number,
): readonly GeneratedMineItem[] {
  if (target <= 0) return items;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const desired = target * 1.85;
  if (total >= desired || total <= 0) return items;
  const multiplier = Math.min(1.9, desired / total);
  return items.map((item) => ({
    ...item,
    value: Math.round((item.value * multiplier) / 5) * 5,
  }));
}

function parseSavedEffects(value: unknown): LevelItemEffects | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const finite = (key: keyof LevelItemEffects, fallback: number): number => {
    const candidate = record[key];
    return typeof candidate === "number" && Number.isFinite(candidate)
      ? candidate
      : fallback;
  };
  return {
    dynamiteCharges: 0,
    pullSpeedMultiplier: Math.max(0.2, finite("pullSpeedMultiplier", 1)),
    rareSpawnWeightMultiplier: Math.max(
      0,
      finite("rareSpawnWeightMultiplier", 1),
    ),
    rockValueMultiplier: Math.max(0, finite("rockValueMultiplier", 1)),
    diamondValueMultiplier: Math.max(
      0,
      finite("diamondValueMultiplier", 1),
    ),
    timeBonusSeconds: Math.max(0, finite("timeBonusSeconds", 0)),
    aimAssistSeconds: Math.max(0, finite("aimAssistSeconds", 0)),
  };
}

function MinerPortrait() {
  return (
    <ArtImage
      className="menu-art-picture"
      asset={ArtAssets.menuMinerPortrait}
      aria-hidden="true"
    />
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold" | "red" | "teal";
}) {
  return (
    <div className={`stat-pill ${tone ? `stat-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function GoldMinerGame() {
  const gameHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GoldMinerEngine | null>(null);
  const runRef = useRef<RunState | null>(
    VISUAL_SHOP_PREVIEW ? VISUAL_PREVIEW_RUN : null,
  );
  const sessionRef = useRef<Session | null>(null);
  const settingsRef = useRef<StoredAudioSettings>(
    createDefaultSaveData().audio,
  );
  const screenRef = useRef<Screen>(INITIAL_SCREEN);

  const [screen, setScreenState] = useState<Screen>(INITIAL_SCREEN);
  const [save, setSave] = useState<GameSaveData>(() => createDefaultSaveData());
  const [settings, setSettings] = useState<StoredAudioSettings>(
    () => createDefaultSaveData().audio,
  );
  const [run, setRunState] = useState<RunState | null>(
    VISUAL_SHOP_PREVIEW ? VISUAL_PREVIEW_RUN : null,
  );
  const [session, setSessionState] = useState<Session | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(DEFAULT_HUD);
  const [paused, setPaused] = useState(false);
  const [resultView, setResultView] = useState<ResultView | null>(null);
  const [shop, setShop] = useState<ShopState | null>(
    VISUAL_SHOP_PREVIEW ? VISUAL_PREVIEW_SHOP : null,
  );
  const [announcement, setAnnouncement] = useState(
    "欢迎来到黄金矿工：西部淘金记",
  );
  const [toast, setToast] = useState<string | null>(null);

  const setScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreenState(next);
  }, []);

  const setRun = useCallback((next: RunState | null) => {
    runRef.current = next;
    setRunState(next);
  }, []);

  const setSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  useEffect(() => {
    const loaded = gameStorage.load();
    const timer = window.setTimeout(() => {
      setSave(loaded);
      setSettings(loaded.audio);
      settingsRef.current = loaded.audio;
      gameAudio.configure(loaded.audio);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    gameAudio.configure(settings);
    if (!settings.musicEnabled || settings.muted) gameAudio.stopMusic();
    else if (gameAudio.isReady) gameAudio.startMusic();
  }, [settings]);

  const unlockAudio = useCallback(async () => {
    const ready = await gameAudio.init();
    if (
      ready &&
      settingsRef.current.musicEnabled &&
      !settingsRef.current.muted
    ) {
      gameAudio.startMusic();
    }
  }, []);

  useEffect(() => {
    const onFirstKey = () => void unlockAudio();
    window.addEventListener("keydown", onFirstKey, { once: true });
    return () => window.removeEventListener("keydown", onFirstKey);
  }, [unlockAudio]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 2_200);
  }, []);

  const playClick = useCallback(() => {
    void unlockAudio();
    gameAudio.play("click");
  }, [unlockAudio]);

  const checkpoint = useCallback(
    (
      nextRun: RunState,
      seed?: number,
      activeEffects?: LevelItemEffects,
    ) => {
      if (nextRun.mode !== "campaign") return;
      const updated = gameStorage.saveProgress({
        mode: "classic",
        level: nextRun.level,
        score: nextRun.totalScore,
        gold: nextRun.wallet,
        dynamite: nextRun.dynamite,
        seed,
        inventory: { ...nextRun.inventory },
        snapshot: activeEffects
          ? {
              activeEffects: {
                pullSpeedMultiplier: activeEffects.pullSpeedMultiplier,
                rareSpawnWeightMultiplier:
                  activeEffects.rareSpawnWeightMultiplier,
                rockValueMultiplier: activeEffects.rockValueMultiplier,
                diamondValueMultiplier: activeEffects.diamondValueMultiplier,
                timeBonusSeconds: activeEffects.timeBonusSeconds,
                aimAssistSeconds: activeEffects.aimAssistSeconds,
              },
            }
          : undefined,
      });
      setSave(updated);
    },
    [],
  );

  const prepareSession = useCallback(
    (
      nextRun: RunState,
      seedOverride?: string | number,
      restoredEffects?: LevelItemEffects,
    ) => {
      const config = createModeConfig(nextRun.mode, nextRun.level);
      const seed =
        seedOverride ??
        (nextRun.mode === "daily"
          ? seedForDailyChallenge(new Date())
          : Date.now() + nextRun.level * 1_009);

      const purchasedEffects =
        restoredEffects ?? resolveLevelItemEffects(nextRun.inventory);
      const effects: LevelItemEffects = {
        ...purchasedEffects,
        dynamiteCharges: 0,
      };
      const initialDynamite =
        nextRun.dynamite +
        (restoredEffects ? 0 : purchasedEffects.dynamiteCharges);
      const activeRun: RunState = {
        ...nextRun,
        dynamite: initialDynamite,
        inventory: {},
      };
      checkpoint(
        activeRun,
        typeof seed === "number" ? seed : undefined,
        effects,
      );
      const field = generateMineField({
        level: config,
        seed,
        bounds: { minX: 46, maxX: 1_234, minY: 196, maxY: 688 },
        rareSpawnWeightMultiplier:
          purchasedEffects.rareSpawnWeightMultiplier,
        minGap: 10,
      });
      const nextSession: Session = {
        key: Date.now() + Math.random(),
        config,
        items: balanceField(field, config.target),
        effects,
        mode: nextRun.mode,
        seed,
        initialDynamite,
      };
      setRun(activeRun);
      setSession(nextSession);
      setHud({
        ...DEFAULT_HUD,
        level: config.id,
        levelName: config.name,
        mode: nextRun.mode,
        target: config.target,
        secondsLeft: config.durationSeconds + effects.timeBonusSeconds,
        dynamite: initialDynamite,
      });
      setPaused(false);
      setScreen("game");
    },
    [checkpoint, setRun, setScreen, setSession],
  );

  const updateAchievements = useCallback(
    (stored: GameSaveData): { saved: GameSaveData; names: string[]; reward: number } => {
      const evaluated = evaluateAchievements(
        {
          totalCoins: stored.totalGold,
          highestCombo: stored.achievementStats.highestCombo,
          diamondsCaught: stored.achievementStats.diamondsCollected,
          levelsCleared: stored.achievementStats.levelsCompleted,
          highestScore: stored.highScore,
          perfectGrabs: stored.achievementStats.perfectGrabs,
          rocksDestroyed: stored.achievementStats.rocksDestroyed,
        },
        stored.unlockedAchievements,
      );
      const newlyUnlocked = evaluated.filter((item) => item.newlyUnlocked);
      if (newlyUnlocked.length === 0) {
        return { saved: stored, names: [], reward: 0 };
      }
      const reward = newlyUnlocked.reduce(
        (sum, item) => sum + item.achievement.rewardCoins,
        0,
      );
      const updated = gameStorage.update({
        totalGold: stored.totalGold + reward,
        unlockedAchievements: [
          ...stored.unlockedAchievements,
          ...newlyUnlocked.map((item) => item.achievement.id),
        ],
      });
      return {
        saved: updated,
        names: newlyUnlocked.map((item) => item.achievement.name),
        reward,
      };
    },
    [],
  );

  const handleLevelEnd = useCallback(
    (result: LevelResult) => {
      const currentRun = runRef.current;
      if (!currentRun) return;

      const completed = result.won && result.mode !== "endless";
      const candidateRunScore = currentRun.totalScore + result.score;
      let stored = gameStorage.recordRun({
        score: candidateRunScore,
        level: currentRun.level,
        goldEarned: result.score,
        highestCombo: result.highestCombo,
        diamondsCollected: result.stats.diamondsCaught,
        levelsCompleted:
          result.mode === "campaign" && result.won ? 1 : 0,
        perfectGrabs: result.stats.perfectGrabs,
        rocksDestroyed: result.stats.rocksDestroyed,
        itemsCollected: result.stats.catches,
        dynamiteUsed: Math.max(0, currentRun.dynamite - result.dynamite),
      });

      if (result.mode === "daily") {
        const date = dailyChallengeDateKey(new Date());
        stored = gameStorage.saveDailyChallenge({
          date,
          highScore: result.score,
          completed,
          bestCombo: result.highestCombo,
          attempts: (stored.dailyChallenges[date]?.attempts ?? 0) + 1,
        });
      }

      const unlocked = updateAchievements(stored);
      stored = unlocked.saved;
      setSave(stored);

      let nextRun = currentRun;
      if (result.mode === "campaign" && result.won) {
        nextRun = {
          ...currentRun,
          level: currentRun.level + 1,
          wallet: currentRun.wallet + result.score + unlocked.reward,
          totalScore: candidateRunScore,
          dynamite: result.dynamite,
          inventory: {},
        };
        setRun(nextRun);
        checkpoint(nextRun);
      } else if (result.mode === "endless" || result.mode === "daily") {
        nextRun = {
          ...currentRun,
          wallet: currentRun.wallet + result.score,
          totalScore: candidateRunScore,
          dynamite: result.dynamite,
        };
        setRun(nextRun);
      }

      setResultView({
        result,
        runScore: candidateRunScore,
        rewardCoins: unlocked.reward,
        newAchievements: unlocked.names,
      });
      setPaused(false);
      if (result.won || result.mode === "endless") setScreen("result");
      else setScreen("failure");
    },
    [checkpoint, setRun, setScreen, updateAchievements],
  );

  useEffect(() => {
    if (screen !== "game" || !session || !gameHostRef.current) return;
    engineRef.current?.stop();
    const engine = new GoldMinerEngine({
      parent: gameHostRef.current,
      level: session.config,
      items: session.items,
      effects: session.effects,
      mode: session.mode,
      seed: session.seed,
      initialDynamite: session.initialDynamite,
      reducedMotion: window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches,
      onHud: setHud,
      onEnd: handleLevelEnd,
      onPauseChange: setPaused,
      onSound: (name) => gameAudio.play(name),
      onAnnouncement: setAnnouncement,
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [handleLevelEnd, screen, session]);

  const startNew = useCallback(
    (mode: GameMode) => {
      playClick();
      const initial: RunState = {
        mode,
        level: 1,
        wallet: 0,
        totalScore: 0,
        dynamite: mode === "endless" ? 1 : 0,
        inventory: {},
      };
      setResultView(null);
      prepareSession(
        initial,
        mode === "daily" ? seedForDailyChallenge(new Date()) : undefined,
      );
    },
    [playClick, prepareSession],
  );

  const continueCampaign = useCallback(() => {
    playClick();
    const progress = gameStorage.load().continueProgress;
    if (!progress || progress.mode !== "classic") return;
    const initial: RunState = {
      mode: "campaign",
      level: progress.level,
      wallet: progress.gold ?? 0,
      totalScore: progress.score,
      dynamite: progress.dynamite ?? 0,
      inventory: (progress.inventory ?? {}) as ShopInventory,
    };
    const restoredEffects = parseSavedEffects(
      progress.snapshot?.activeEffects,
    );
    prepareSession(initial, progress.seed, restoredEffects);
  }, [playClick, prepareSession]);

  const retrySession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    playClick();
    const retried: Session = {
      ...current,
      key: Date.now() + Math.random(),
      items: current.items.map((item) => ({ ...item })),
    };
    setSession(retried);
    setHud({
      ...DEFAULT_HUD,
      level: retried.config.id,
      levelName: retried.config.name,
      mode: retried.mode,
      target: retried.config.target,
      secondsLeft:
        retried.config.durationSeconds + retried.effects.timeBonusSeconds,
      dynamite: retried.initialDynamite,
    });
    setPaused(false);
    setScreen("game");
  }, [playClick, setScreen, setSession]);

  const openShop = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    playClick();
    setShop(createShopState(current.wallet, current.inventory));
    setScreen("shop");
  }, [playClick, setScreen]);

  const buyItem = useCallback(
    (itemId: ShopItemId) => {
      playClick();
      setShop((current) => {
        if (!current) return current;
        const purchase = purchaseShopItem(current, itemId);
        if (!purchase.ok) {
          showToast(purchase.message);
          return current;
        }
        showToast(`${purchase.item.name} 已装进背包`);
        return purchase.state;
      });
    },
    [playClick, showToast],
  );

  const leaveShop = useCallback(() => {
    const currentRun = runRef.current;
    if (!currentRun || !shop) return;
    playClick();
    const nextRun: RunState = {
      ...currentRun,
      wallet: shop.coins,
      inventory: shop.inventory,
    };
    prepareSession(nextRun);
  }, [playClick, prepareSession, shop]);

  const returnHome = useCallback(() => {
    playClick();
    engineRef.current?.stop();
    setPaused(false);
    setScreen("menu");
  }, [playClick, setScreen]);

  const updateAudioSetting = useCallback(
    (patch: Partial<AudioSettings>) => {
      setSettings((current) => {
        const next: StoredAudioSettings = { ...current, ...patch };
        settingsRef.current = next;
        gameAudio.configure(next);
        const updated = gameStorage.saveAudioSettings(next);
        setSave(updated);
        return next;
      });
    },
    [],
  );

  const resetSave = useCallback(() => {
    if (!window.confirm("确定清除所有进度、成就和每日挑战记录吗？")) return;
    const defaults = gameStorage.reset();
    setSave(defaults);
    setSettings(defaults.audio);
    settingsRef.current = defaults.audio;
    gameAudio.configure(defaults.audio);
    showToast("本地记录已恢复默认");
  }, [showToast]);

  const achievementProgress = useMemo(
    () =>
      evaluateAchievements(
        {
          totalCoins: save.totalGold,
          highestCombo: save.achievementStats.highestCombo,
          diamondsCaught: save.achievementStats.diamondsCollected,
          levelsCleared: save.achievementStats.levelsCompleted,
          highestScore: save.highScore,
          perfectGrabs: save.achievementStats.perfectGrabs,
          rocksDestroyed: save.achievementStats.rocksDestroyed,
        },
        save.unlockedAchievements,
      ),
    [save],
  );

  const dailyKey = dailyChallengeDateKey(new Date());
  const dailyRecord = save.dailyChallenges[dailyKey];

  const preventCanvasLaunch = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
  };

  return (
    <main
      className="miner-app"
      onPointerDownCapture={() => void unlockAudio()}
    >
      <div className="sky-grain" aria-hidden="true" />
      <div className="sun-disc" aria-hidden="true" />
      <div className="distant-ridge ridge-one" aria-hidden="true" />
      <div className="distant-ridge ridge-two" aria-hidden="true" />

      {screen === "menu" && (
        <section className="menu-screen" aria-labelledby="game-title">
          <header className="menu-topbar">
            <div className="mini-brand">
              <span className="brand-pick"><GameIcon name="pickaxe" /></span>
              <span>OLD CANYON CO.</span>
            </div>
            <div className="menu-records">
              <span>最高分</span>
              <strong>{formatCoins(save.highScore)}</strong>
              <i />
              <span>最深矿层</span>
              <strong>{save.highestLevel}</strong>
            </div>
            <button
              className="icon-button sound-button"
              type="button"
              aria-label={settings.muted ? "打开声音" : "静音"}
              onClick={() => updateAudioSetting({ muted: !settings.muted })}
            >
              <GameIcon name={settings.muted ? "muted" : "sound"} />
            </button>
          </header>

          <div className="menu-layout">
            <div className="brand-panel">
              <p className="eyebrow">
                <span />
                FRONTIER FORTUNE
                <span />
              </p>
              <h1 id="game-title">
                <span>黄金</span>
                <span>矿工</span>
              </h1>
              <p className="brand-subtitle">西部淘金记</p>
              <p className="brand-copy">
                听准卷扬机的节拍，甩出抓钩。
                <br />
                地底的下一块金子，也许就是你的传奇。
              </p>

              <div className="primary-actions">
                <button
                  className="nugget-button"
                  type="button"
                  onClick={() => startNew("campaign")}
                >
                  <span className="nugget-shine" />
                  <small>CLASSIC RUN</small>
                  <strong>开始淘金</strong>
                </button>
                <button
                  className="continue-button"
                  type="button"
                  disabled={!save.continueProgress}
                  onClick={continueCampaign}
                >
                  <span>继续闯关</span>
                  <small>
                    {save.continueProgress
                      ? `从第 ${save.continueProgress.level} 层继续`
                      : "暂无可继续进度"}
                  </small>
                </button>
              </div>

              <div className="mode-actions">
                <button type="button" onClick={() => startNew("daily")}>
                  <span className="mode-icon"><GameIcon name="daily" /></span>
                  <span>
                    <strong>每日挑战</strong>
                    <small>
                      {dailyRecord
                        ? `今日最高 ${formatCoins(dailyRecord.highScore)}`
                        : "今日固定矿脉"}
                    </small>
                  </span>
                  <b>›</b>
                </button>
                <button type="button" onClick={() => startNew("endless")}>
                  <span className="mode-icon"><GameIcon name="endless" /></span>
                  <span>
                    <strong>无尽矿井</strong>
                    <small>抓取可续时</small>
                  </span>
                  <b>›</b>
                </button>
              </div>
            </div>

            <div className="menu-visual">
              <div className="wanted-stamp">EST. 1896</div>
              <MinerPortrait />
              <p className="visual-caption">
                <span>本周矿讯</span>
                水晶洞穴发现新金脉
              </p>
            </div>
          </div>

          <footer className="menu-footer">
            <div className="control-legend">
              <span>
                <kbd>SPACE</kbd> 发射
              </span>
              <span>
                <kbd>D</kbd> 爆破
              </span>
              <span>
                <kbd>ESC</kbd> 暂停
              </span>
              <span className="touch-legend">点击矿区也可发射</span>
            </div>
            <nav aria-label="其他功能">
              <button type="button" onClick={() => setScreen("help")}>
                玩法说明
              </button>
              <button type="button" onClick={() => setScreen("achievements")}>
                成就与记录
              </button>
              <button type="button" onClick={() => setScreen("settings")}>
                声音设置
              </button>
            </nav>
          </footer>
        </section>
      )}

      {screen === "game" && session && (
        <section className="game-screen" aria-label="游戏进行中">
          <header className={`game-hud ${hud.warning ? "hud-warning" : ""}`}>
            <div className="hud-brand">
              <span><GameIcon name="pickaxe" /></span>
              <div>
                <small>{modeLabel(hud.mode)}</small>
                <strong>
                  {hud.mode === "campaign" ? `矿层 ${run?.level ?? 1}` : hud.levelName}
                </strong>
              </div>
            </div>
            <div className="hud-score-cluster">
              <StatPill
                label="本关金额"
                value={`$${formatCoins(hud.score)}`}
                tone="gold"
              />
              <div className="target-meter">
                <span>
                  {hud.mode === "endless"
                    ? "尽可能多地淘金"
                    : `目标 $${formatCoins(hud.target)}`}
                </span>
                <i>
                  <b
                    style={{
                      width:
                        hud.mode === "endless"
                          ? "100%"
                          : `${Math.min(100, (hud.score / Math.max(1, hud.target)) * 100)}%`,
                    }}
                  />
                </i>
              </div>
            </div>
            <div className="hud-right">
              {hud.combo > 0 && (
                <StatPill
                  label={`${hud.combo} 连击`}
                  value={`×${hud.multiplier.toFixed(2)}`}
                  tone="teal"
                />
              )}
              <StatPill
                label={hud.warning ? "时间告急" : "剩余时间"}
                value={`${hud.secondsLeft}s`}
                tone={hud.warning ? "red" : undefined}
              />
              <button
                type="button"
                className="pause-button"
                aria-label="暂停游戏"
                onPointerDown={preventCanvasLaunch}
                onClick={() => engineRef.current?.togglePaused()}
              >
                <span />
                <span />
              </button>
            </div>
          </header>

          <div className="mine-stage">
            <div ref={gameHostRef} className="mine-phaser-host" />
            <div className="canvas-frame" aria-hidden="true" />
            {hud.event && (
              <div className={`event-card event-${hud.event.type}`}>
                <span>矿脉异动</span>
                <strong>{hud.event.label}</strong>
                <small>
                  {hud.event.detail} · {Math.ceil(hud.event.remaining)}s
                </small>
              </div>
            )}
            <div className="hook-hint">
              {hud.hookState === "swinging"
                ? "点击矿区 / 空格 发射"
                : hud.hookState === "retractingItem"
                  ? "正在收回 · 可使用炸药"
                  : "抓钩工作中"}
            </div>
            <button
              type="button"
              className="dynamite-button"
              disabled={
                hud.dynamite <= 0 || hud.hookState !== "retractingItem"
              }
              onPointerDown={preventCanvasLaunch}
              onClick={() => engineRef.current?.useDynamite()}
              aria-label={`使用炸药，剩余 ${hud.dynamite} 个`}
            >
              <span><GameIcon name="dynamite" /></span>
              <strong>爆破</strong>
              <i>×{hud.dynamite}</i>
            </button>
          </div>

          {paused && (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <div className="paper-modal pause-modal">
                <p className="modal-kicker">TAKE A BREATH</p>
                <h2>卷扬机已停下</h2>
                <p>倒计时、地鼠和随机事件都已暂停。</p>
                <div className="pause-actions">
                  <button
                    className="western-button primary"
                    type="button"
                    onClick={() => engineRef.current?.setPaused(false)}
                  >
                    继续淘金
                  </button>
                  <button
                    className="western-button"
                    type="button"
                    onClick={retrySession}
                  >
                    重开本关
                  </button>
                  <button
                    className="western-button quiet"
                    type="button"
                    onClick={returnHome}
                  >
                    返回首页
                  </button>
                </div>
                <label className="inline-volume">
                  <span>音量</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.volume}
                    onChange={(event) =>
                      updateAudioSetting({
                        volume: Number(event.currentTarget.value),
                      })
                    }
                  />
                  <strong>{Math.round(settings.volume * 100)}%</strong>
                </label>
              </div>
            </div>
          )}
        </section>
      )}

      {screen === "shop" && run && shop && (
        <section className="panel-screen shop-screen" aria-labelledby="shop-title">
          <header className="panel-header">
            <div>
              <p>BETWEEN THE SHAFTS</p>
              <h2 id="shop-title">老山姆补给站</h2>
              <span>每件商品本次只能购买一次，效果将在下一关生效。</span>
            </div>
            <div className="wallet-board">
              <small>可用金币</small>
              <strong>${formatCoins(shop.coins)}</strong>
            </div>
          </header>
          <div className="shop-grid">
            {(Object.keys(SHOP_ITEMS) as ShopItemId[]).map((id) => {
              const item = SHOP_ITEMS[id];
              const bought = (shop.purchasedThisShop[id] ?? 0) > 0;
              const held = shop.inventory[id] ?? 0;
              const canAfford = shop.coins >= item.price;
              return (
                <article
                  className={`shop-card ${bought ? "is-bought" : ""}`}
                  key={item.id}
                >
                  <div className="shop-icon" aria-hidden="true">
                    {item.icon}
                  </div>
                  <div className="shop-copy">
                    <small>{item.kind === "charge" ? "随身道具" : "下一关"}</small>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                  <div className="shop-buy-row">
                    <strong>${formatCoins(item.price)}</strong>
                    <button
                      type="button"
                      disabled={bought || !canAfford || held >= item.maxStack}
                      onClick={() => buyItem(item.id)}
                    >
                      {bought
                        ? "已购买"
                        : held >= item.maxStack
                          ? "已持有"
                          : canAfford
                            ? "购买"
                            : "金币不足"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <footer className="shop-footer">
            <div>
              <span>下一站</span>
              <strong>
                第 {run.level} 层 · {getLevelConfig(run.level).name}
              </strong>
            </div>
            <button
              type="button"
              className="western-button primary next-level"
              onClick={leaveShop}
            >
              进入下一层 <span>›</span>
            </button>
          </footer>
        </section>
      )}

      {screen === "result" && resultView && (
        <section className="panel-screen result-screen" aria-labelledby="result-title">
          <div className="result-sunburst" aria-hidden="true" />
          <div className="result-card">
            <p className="modal-kicker">
              {resultView.result.mode === "endless"
                ? "DEEP MINE RECORD"
                : "CLAIM SECURED"}
            </p>
            <div className="result-badge">
              {resultView.result.mode === "endless" ? "∞" : "★"}
            </div>
            <h2 id="result-title">
              {resultView.result.mode === "endless"
                ? "无尽矿井结算"
                : "目标达成！"}
            </h2>
            <p>
              {resultView.result.levelName} ·{" "}
              {resultView.result.mode === "campaign"
                ? `累计分数 ${formatCoins(resultView.runScore)}`
                : modeLabel(resultView.result.mode)}
            </p>
            <div className="result-amount">
              <small>本次淘金</small>
              <strong>${formatCoins(resultView.result.score)}</strong>
              {resultView.rewardCoins > 0 && (
                <span>成就奖励 +${formatCoins(resultView.rewardCoins)}</span>
              )}
            </div>
            <div className="result-stats">
              <StatPill
                label="成功抓取"
                value={`${resultView.result.stats.catches}`}
              />
              <StatPill
                label="最高连击"
                value={`${resultView.result.highestCombo}`}
                tone="teal"
              />
              <StatPill
                label="完美抓取"
                value={`${resultView.result.stats.perfectGrabs}`}
                tone="gold"
              />
              <StatPill
                label="钻石"
                value={`${resultView.result.stats.diamondsCaught}`}
              />
            </div>
            {resultView.newAchievements.length > 0 && (
              <div className="achievement-unlock">
                <span>新成就解锁</span>
                <strong>{resultView.newAchievements.join("、")}</strong>
              </div>
            )}
            <div className="result-actions">
              {resultView.result.mode === "campaign" ? (
                <button
                  className="western-button primary"
                  type="button"
                  onClick={openShop}
                >
                  前往补给站
                </button>
              ) : (
                <button
                  className="western-button primary"
                  type="button"
                  onClick={() => startNew(resultView.result.mode)}
                >
                  再来一局
                </button>
              )}
              <button
                className="western-button quiet"
                type="button"
                onClick={returnHome}
              >
                返回首页
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "failure" && resultView && (
        <section className="panel-screen failure-screen" aria-labelledby="failure-title">
          <div className="failure-card">
            <div className="broken-lantern" aria-hidden="true">
              <span />
            </div>
            <p className="modal-kicker">SHIFT ENDED</p>
            <h2 id="failure-title">矿灯熄灭了</h2>
            <p>
              距离目标还差{" "}
              <strong>
                ${formatCoins(
                  Math.max(0, resultView.result.target - resultView.result.score),
                )}
              </strong>
              ，再挑一条更好的出钩路线。
            </p>
            <div className="failure-score">
              <span>本关金额</span>
              <strong>${formatCoins(resultView.result.score)}</strong>
              <small>
                到达第 {run?.level ?? resultView.result.level} 层 · 最高{" "}
                {resultView.result.highestCombo} 连击
              </small>
            </div>
            <div className="result-actions">
              <button
                className="western-button primary"
                type="button"
                onClick={retrySession}
              >
                重试本关
              </button>
              <button
                className="western-button quiet"
                type="button"
                onClick={returnHome}
              >
                返回首页
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "achievements" && (
        <section
          className="panel-screen records-screen"
          aria-labelledby="records-title"
        >
          <header className="panel-header compact">
            <button
              className="back-button"
              type="button"
              onClick={returnHome}
              aria-label="返回首页"
            >
              ‹
            </button>
            <div>
              <p>MINER&apos;S LEDGER</p>
              <h2 id="records-title">矿工手册</h2>
              <span>所有记录仅保存在这台设备上。</span>
            </div>
          </header>
          <div className="record-summary">
            <StatPill
              label="最高分"
              value={`$${formatCoins(save.highScore)}`}
              tone="gold"
            />
            <StatPill label="最高关卡" value={`${save.highestLevel}`} />
            <StatPill
              label="累计金币"
              value={`$${formatCoins(save.totalGold)}`}
            />
            <StatPill
              label="最高连击"
              value={`${save.achievementStats.highestCombo}`}
              tone="teal"
            />
          </div>
          <div className="achievement-grid">
            {achievementProgress.map((entry) => (
              <article
                key={entry.achievement.id}
                className={entry.unlocked ? "unlocked" : "locked"}
              >
                <div className="achievement-icon">
                  {entry.unlocked ? entry.achievement.icon : "?"}
                </div>
                <div>
                  <span>{entry.unlocked ? "已解锁" : "进行中"}</span>
                  <h3>{entry.achievement.name}</h3>
                  <p>{entry.achievement.description}</p>
                  <i>
                    <b style={{ width: `${entry.ratio * 100}%` }} />
                  </i>
                  <small>
                    {formatCoins(entry.current)} /{" "}
                    {formatCoins(entry.achievement.threshold)}
                  </small>
                </div>
              </article>
            ))}
          </div>
          <div className="daily-record">
            <div>
              <span>今日挑战 · {dailyKey}</span>
              <strong>
                {dailyRecord
                  ? `$${formatCoins(dailyRecord.highScore)}`
                  : "尚未挑战"}
              </strong>
            </div>
            <div>
              <span>最佳连击</span>
              <strong>{dailyRecord?.bestCombo ?? 0}</strong>
            </div>
            <div>
              <span>完成状态</span>
              <strong>{dailyRecord?.completed ? "已完成" : "未完成"}</strong>
            </div>
          </div>
        </section>
      )}

      {screen === "help" && (
        <section className="panel-screen help-screen" aria-labelledby="help-title">
          <header className="panel-header compact">
            <button
              className="back-button"
              type="button"
              onClick={returnHome}
              aria-label="返回首页"
            >
              ‹
            </button>
            <div>
              <p>FIELD MANUAL</p>
              <h2 id="help-title">淘金入门</h2>
              <span>掌握方向、重量和时机，就掌握了整座矿山。</span>
            </div>
          </header>
          <div className="help-layout">
            <div className="help-steps">
              <article>
                <b>01</b>
                <div>
                  <h3>看准摆动方向</h3>
                  <p>抓钩会自动左右摆动，接近目标方向时再发射。</p>
                </div>
              </article>
              <article>
                <b>02</b>
                <div>
                  <h3>轻重决定速度</h3>
                  <p>钻石轻而值钱，大金块和石头会明显拖慢回收。</p>
                </div>
              </article>
              <article>
                <b>03</b>
                <div>
                  <h3>冲击中心得完美</h3>
                  <p>钩尖越接近物品中心，奖励和拉取加速越高。</p>
                </div>
              </article>
              <article>
                <b>04</b>
                <div>
                  <h3>谨慎使用炸药</h3>
                  <p>拉到不想要的重物时按 D，或点击画面右下爆破。</p>
                </div>
              </article>
            </div>
            <div className="ore-guide">
              <h3>矿物图鉴</h3>
              <div className="ore-row">
                <span className="ore gold-ore" />
                <div>
                  <strong>金块</strong>
                  <small>越大越值钱，也越重</small>
                </div>
              </div>
              <div className="ore-row">
                <span className="ore diamond-ore" />
                <div>
                  <strong>钻石</strong>
                  <small>极轻，最适合连续抓取</small>
                </div>
              </div>
              <div className="ore-row">
                <span className="ore rock-ore" />
                <div>
                  <strong>岩石</strong>
                  <small>沉重低价，会中断连击</small>
                </div>
              </div>
              <div className="ore-row">
                <span className="ore chest-ore">?</span>
                <div>
                  <strong>神秘宝箱</strong>
                  <small>金币奖励，也可能开出炸药</small>
                </div>
              </div>
              <div className="help-controls">
                <span>
                  <kbd>空格 / ↓</kbd> 发射
                </span>
                <span>
                  <kbd>D</kbd> 炸药
                </span>
                <span>
                  <kbd>Esc</kbd> 暂停
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === "settings" && (
        <section
          className="panel-screen settings-screen"
          aria-labelledby="settings-title"
        >
          <div className="settings-card">
            <button
              className="back-button floating"
              type="button"
              onClick={returnHome}
              aria-label="返回首页"
            >
              ×
            </button>
            <p className="modal-kicker">SALOON PIANO</p>
            <h2 id="settings-title">声音与本地数据</h2>
            <p>音频会在首次点击后播放；设置自动保存在本机。</p>
            <label className="settings-slider">
              <span>
                <strong>主音量</strong>
                <small>{Math.round(settings.volume * 100)}%</small>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(event) =>
                  updateAudioSetting({
                    volume: Number(event.currentTarget.value),
                  })
                }
              />
            </label>
            <div className="toggle-list">
              <label>
                <span>
                  <strong>全部静音</strong>
                  <small>保留当前音量</small>
                </span>
                <input
                  type="checkbox"
                  checked={!settings.muted}
                  onChange={(event) =>
                    updateAudioSetting({ muted: !event.currentTarget.checked })
                  }
                />
                <i />
              </label>
              <label>
                <span>
                  <strong>背景音乐</strong>
                  <small>原创西部酒馆合成旋律</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.musicEnabled}
                  onChange={(event) =>
                    updateAudioSetting({
                      musicEnabled: event.currentTarget.checked,
                    })
                  }
                />
                <i />
              </label>
              <label>
                <span>
                  <strong>游戏音效</strong>
                  <small>抓钩、钻石、爆炸与倒计时提示</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.sfxEnabled}
                  onChange={(event) =>
                    updateAudioSetting({
                      sfxEnabled: event.currentTarget.checked,
                    })
                  }
                />
                <i />
              </label>
            </div>
            <button className="reset-button" type="button" onClick={resetSave}>
              恢复默认并清除本地记录
            </button>
          </div>
        </section>
      )}

      {toast && <div className="toast-message">{toast}</div>}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </main>
  );
}
