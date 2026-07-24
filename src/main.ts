import Phaser from "phaser";
import "./styles/main.css";
import { CloudSaveClient, CloudSaveConflictError, type CloudSaveSnapshot } from "./cloud/CloudSaveClient";
import {
  loadOrCreateCloudIdentity,
  parseSyncKey,
  saveCloudIdentity,
  serializeSyncKey,
  type CloudIdentity,
} from "./cloud/identity";
import { GoldMinerScene, type LevelOutcome, type PlayMode, type SceneHud } from "./game/GoldMinerScene";
import { gameStorage, type GameSaveData } from "./game/storage";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}.`);
  return node as T;
}

const menuScreen = element<HTMLElement>("menu-screen");
const gameScreen = element<HTMLElement>("game-screen");
const gameRoot = element<HTMLElement>("game-root");
const resultDialog = element<HTMLDialogElement>("result-dialog");
const syncKeyInput = element<HTMLInputElement>("sync-key");
const cloudStatus = element<HTMLElement>("cloud-status");

let identity: CloudIdentity = loadOrCreateCloudIdentity();
let cloudClient = new CloudSaveClient(identity);
let cloudRevision: number | undefined;
let game: Phaser.Game | null = null;
let scene: GoldMinerScene | null = null;
let currentMode: PlayMode = "classic";
let currentLevel = 1;
let latestOutcome: LevelOutcome | null = null;
let saveData = gameStorage.load();

function formatNumber(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString("zh-CN");
}

function modeLabel(mode: PlayMode): string {
  if (mode === "daily") return "每日挑战";
  if (mode === "endless") return "无尽矿井";
  return "经典闯关";
}

function updateMeta(save: GameSaveData): void {
  element("high-score").textContent = formatNumber(save.highScore);
  element("highest-level").textContent = formatNumber(save.highestLevel);
  element("total-gold").textContent = formatNumber(save.totalGold);
}

function updateHud(hud: SceneHud): void {
  element("hud-mode").textContent = modeLabel(hud.mode);
  element("hud-level").textContent = `${hud.level} · ${hud.levelName}`;
  element("hud-score").textContent = formatNumber(hud.score);
  element("hud-target").textContent = hud.target > 0 ? formatNumber(hud.target) : "无上限";
  element("hud-time").textContent = `${hud.secondsLeft}s`;
  element("hud-combo").textContent = `×${hud.multiplier.toFixed(2)}`;
  element("hud-dynamite").textContent = formatNumber(hud.dynamite);
  element<HTMLButtonElement>("pause-button").textContent = hud.paused ? "继续" : "暂停";
}

function setCloudStatus(text: string, tone: "ok" | "busy" | "error" = "ok"): void {
  cloudStatus.textContent = text;
  cloudStatus.style.color = tone === "error" ? "#ff9b8f" : tone === "busy" ? "#ffd77e" : "#9be8c2";
}

async function pushCloud(save: GameSaveData): Promise<void> {
  try {
    setCloudStatus("正在上传…", "busy");
    const snapshot = await cloudClient.save(save, cloudRevision);
    cloudRevision = snapshot.revision;
    setCloudStatus(`已同步 · r${snapshot.revision}`);
  } catch (error) {
    if (error instanceof CloudSaveConflictError) {
      await applyRemote(error.latest);
      setCloudStatus(`已合并远程新版本 · r${error.latest.revision}`);
      return;
    }
    console.error(error);
    setCloudStatus("云同步失败，本地存档仍可用", "error");
  }
}

async function applyRemote(remote: CloudSaveSnapshot): Promise<void> {
  cloudRevision = remote.revision;
  if (CloudSaveClient.chooseNewest(saveData, remote) === "remote") {
    gameStorage.save(remote.save);
    saveData = gameStorage.load();
    updateMeta(saveData);
  } else if (saveData.updatedAt > remote.save.updatedAt) {
    await pushCloud(saveData);
  }
}

async function syncCloud(): Promise<void> {
  syncKeyInput.value = serializeSyncKey(identity);
  setCloudStatus("正在连接…", "busy");
  try {
    const remote = await cloudClient.load();
    if (!remote) {
      await pushCloud(saveData);
      return;
    }
    await applyRemote(remote);
    setCloudStatus(`已同步 · r${cloudRevision ?? remote.revision}`);
  } catch (error) {
    console.error(error);
    setCloudStatus("暂时离线，使用本地存档", "error");
  }
}

function disposeGame(): void {
  game?.destroy(true);
  game = null;
  scene = null;
  gameRoot.replaceChildren();
}

function showMenu(): void {
  disposeGame();
  resultDialog.close();
  gameScreen.classList.add("is-hidden");
  menuScreen.classList.remove("is-hidden");
  updateMeta(saveData);
}

function startGame(mode: PlayMode, level?: number): void {
  disposeGame();
  resultDialog.close();
  currentMode = mode;
  currentLevel = level ?? (mode === "classic" ? Math.max(1, saveData.highestLevel) : 1);
  latestOutcome = null;
  menuScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");

  scene = new GoldMinerScene({
    mode: currentMode,
    level: currentLevel,
    dynamite: 2,
    onHud: updateHud,
    onFinish: finishLevel,
  });

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameRoot,
    width: 960,
    height: 640,
    backgroundColor: "#17100b",
    scene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
  });
}

function finishLevel(outcome: LevelOutcome): void {
  latestOutcome = outcome;
  const unlockedLevel = outcome.mode === "classic" && outcome.success ? outcome.level + 1 : outcome.level;
  saveData = gameStorage.recordRun({
    score: outcome.score,
    level: unlockedLevel,
    goldEarned: outcome.score,
    highestCombo: outcome.highestCombo,
    diamondsCollected: outcome.diamondsCollected,
    levelsCompleted: outcome.success ? 1 : 0,
    perfectGrabs: outcome.perfectGrabs,
    rocksDestroyed: outcome.rocksDestroyed,
    itemsCollected: outcome.itemsCollected,
    dynamiteUsed: outcome.dynamiteUsed,
  });
  updateMeta(saveData);
  void pushCloud(saveData);

  element("result-kicker").textContent = `${modeLabel(outcome.mode)} · 第 ${outcome.level} 关`;
  element("result-title").textContent = outcome.success ? "淘金成功" : "本轮结束";
  element("result-detail").textContent = outcome.target > 0
    ? `获得 ${formatNumber(outcome.score)} 金币，目标为 ${formatNumber(outcome.target)}。最高连击 ${outcome.highestCombo}。`
    : `获得 ${formatNumber(outcome.score)} 金币，最高连击 ${outcome.highestCombo}。`;
  element<HTMLButtonElement>("next-button").textContent = outcome.mode === "classic" && outcome.success ? "下一关" : "再来一局";
  resultDialog.showModal();
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
  button.addEventListener("click", () => startGame(button.dataset.mode as PlayMode));
}

element("fire-button").addEventListener("click", () => scene?.fire());
element("dynamite-button").addEventListener("click", () => scene?.useDynamite());
element("pause-button").addEventListener("click", () => scene?.togglePause());
element("exit-button").addEventListener("click", showMenu);
element("menu-button").addEventListener("click", showMenu);
element("next-button").addEventListener("click", () => {
  const outcome = latestOutcome;
  if (!outcome) return showMenu();
  const nextLevel = outcome.mode === "classic" && outcome.success ? outcome.level + 1 : outcome.level;
  startGame(outcome.mode, nextLevel);
});

element("copy-key").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(serializeSyncKey(identity));
    setCloudStatus("同步密钥已复制");
  } catch {
    syncKeyInput.type = "text";
    syncKeyInput.select();
    setCloudStatus("请手动复制密钥", "busy");
  }
});

element("import-key").addEventListener("click", () => {
  const imported = parseSyncKey(syncKeyInput.value);
  if (!imported) {
    setCloudStatus("同步密钥格式不正确", "error");
    return;
  }
  identity = imported;
  saveCloudIdentity(identity);
  cloudClient = new CloudSaveClient(identity);
  cloudRevision = undefined;
  void syncCloud();
});

updateMeta(saveData);
void syncCloud();
