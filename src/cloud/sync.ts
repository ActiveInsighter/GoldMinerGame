import { gameStorage, type GameSaveData } from "../game/storage";
import { CloudSaveClient, CloudSaveConflictError } from "./CloudSaveClient";
import {
  loadOrCreateCloudIdentity,
  parseSyncKey,
  saveCloudIdentity,
  serializeSyncKey,
  type CloudIdentity,
} from "./identity";

export type CloudSyncTone = "ok" | "busy" | "offline" | "error";

export interface CloudSyncStatus {
  label: string;
  detail: string;
  tone: CloudSyncTone;
  revision?: number;
}

type StatusListener = (status: CloudSyncStatus) => void;

const INITIAL_TIMEOUT_MS = 2_500;
const POLL_INTERVAL_MS = 1_800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class CloudSyncService {
  private identity: CloudIdentity = loadOrCreateCloudIdentity();
  private client = new CloudSaveClient(this.identity);
  private revision: number | undefined;
  private intervalId = 0;
  private stopped = false;
  private syncing = false;
  private lastObservedUpdate = 0;

  constructor(private readonly onStatus: StatusListener) {}

  get syncKey(): string {
    return serializeSyncKey(this.identity);
  }

  async initialize(): Promise<void> {
    this.setStatus("正在连接云存档…", "首次同步会自动合并最新进度", "busy");
    const initial = this.reconcile(true);
    await Promise.race([initial, delay(INITIAL_TIMEOUT_MS)]).catch(() => undefined);
    if (!this.stopped) {
      this.lastObservedUpdate = gameStorage.load().updatedAt;
      this.intervalId = window.setInterval(() => void this.pushIfChanged(), POLL_INTERVAL_MS);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.intervalId) window.clearInterval(this.intervalId);
    this.intervalId = 0;
  }

  async importSyncKey(raw: string): Promise<boolean> {
    const parsed = parseSyncKey(raw);
    if (!parsed) {
      this.setStatus("同步密钥无效", "请完整粘贴另一台设备导出的同步密钥", "error");
      return false;
    }
    this.identity = parsed;
    saveCloudIdentity(parsed);
    this.client.setIdentity(parsed);
    this.revision = undefined;
    this.setStatus("正在导入云存档…", "完成后将刷新游戏进度", "busy");
    try {
      const remote = await this.client.load();
      if (remote) {
        this.revision = remote.revision;
        gameStorage.save(remote.save);
      } else {
        const created = await this.client.save(gameStorage.load());
        this.revision = created.revision;
      }
      this.lastObservedUpdate = gameStorage.load().updatedAt;
      this.setStatus("云存档已导入", "正在刷新界面", "ok", this.revision);
      return true;
    } catch (error) {
      console.error(error);
      this.setStatus("导入失败", "本地进度没有受到影响", "error");
      return false;
    }
  }

  async syncNow(): Promise<void> {
    await this.reconcile(false);
  }

  private async pushIfChanged(): Promise<void> {
    if (this.stopped || this.syncing) return;
    const local = gameStorage.load();
    if (local.updatedAt <= this.lastObservedUpdate) return;
    await this.push(local);
  }

  private async reconcile(initial: boolean): Promise<void> {
    if (this.syncing || this.stopped) return;
    this.syncing = true;
    try {
      const local = gameStorage.load();
      const remote = await this.client.load();
      if (!remote) {
        const created = await this.client.save(local);
        this.revision = created.revision;
        this.lastObservedUpdate = local.updatedAt;
        this.setStatus("云存档已启用", "进度会在游玩时自动保存", "ok", created.revision);
        return;
      }

      this.revision = remote.revision;
      if (initial && CloudSaveClient.chooseNewest(local, remote) === "remote") {
        gameStorage.save(remote.save);
        this.lastObservedUpdate = gameStorage.load().updatedAt;
        this.setStatus("已载入云端进度", "当前设备已与云端同步", "ok", remote.revision);
        return;
      }
      if (local.updatedAt > remote.save.updatedAt) {
        await this.push(local, true);
        return;
      }
      this.lastObservedUpdate = local.updatedAt;
      this.setStatus("云存档已同步", "本地与云端进度一致", "ok", remote.revision);
    } catch (error) {
      console.error(error);
      this.setStatus("当前使用本地存档", "网络恢复后会自动继续同步", "offline");
    } finally {
      this.syncing = false;
    }
  }

  private async push(local: GameSaveData, alreadyLocked = false): Promise<void> {
    if (!alreadyLocked) {
      if (this.syncing || this.stopped) return;
      this.syncing = true;
    }
    try {
      let snapshot;
      try {
        snapshot = await this.client.save(local, this.revision);
      } catch (error) {
        if (!(error instanceof CloudSaveConflictError)) throw error;
        this.revision = error.latest.revision;
        if (CloudSaveClient.chooseNewest(local, error.latest) === "remote") {
          gameStorage.save(error.latest.save);
          this.lastObservedUpdate = gameStorage.load().updatedAt;
          this.setStatus("已合并其他设备进度", "云端版本更新较新", "ok", error.latest.revision);
          return;
        }
        snapshot = await this.client.save(local, error.latest.revision);
      }
      this.revision = snapshot.revision;
      this.lastObservedUpdate = local.updatedAt;
      this.setStatus("进度已保存", "云端自动存档正常", "ok", snapshot.revision);
    } catch (error) {
      console.error(error);
      this.setStatus("云同步暂时离线", "本地存档仍会正常保存", "offline");
    } finally {
      if (!alreadyLocked) this.syncing = false;
    }
  }

  private setStatus(
    label: string,
    detail: string,
    tone: CloudSyncTone,
    revision = this.revision,
  ): void {
    this.onStatus({ label, detail, tone, revision });
  }
}
