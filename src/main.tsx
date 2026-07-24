import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GoldMinerGame } from "./GoldMinerGame";
import { CloudSyncService, type CloudSyncStatus } from "./cloud/sync";
import "./styles/main.css";
import "./styles/phaser-polish.css";
import "./styles/cloud-sync.css";

const VISUAL_TEST_MODE = new URLSearchParams(window.location.search).has("visual");

const INITIAL_STATUS: CloudSyncStatus = {
  label: "正在准备云存档",
  detail: "本地进度始终可用",
  tone: "busy",
};

function CloudSyncDock({
  service,
  status,
}: {
  service: CloudSyncService | null;
  status: CloudSyncStatus;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const open = (): void => {
    if (inputRef.current && service) inputRef.current.value = service.syncKey;
    dialogRef.current?.showModal();
  };

  const copy = async (): Promise<void> => {
    if (!service) return;
    try {
      await navigator.clipboard.writeText(service.syncKey);
    } catch {
      if (inputRef.current) {
        inputRef.current.value = service.syncKey;
        inputRef.current.select();
      }
    }
  };

  const importKey = async (): Promise<void> => {
    if (!service || !inputRef.current) return;
    const imported = await service.importSyncKey(inputRef.current.value);
    if (imported) window.location.reload();
  };

  return (
    <>
      <button className={`cloud-sync-dock cloud-${status.tone}`} type="button" onClick={open}>
        <span aria-hidden="true">☁</span>
        <span>
          <strong>{status.label}</strong>
          <small>{status.revision ? `云端版本 r${status.revision}` : status.detail}</small>
        </span>
      </button>
      <dialog ref={dialogRef} className="cloud-sync-dialog">
        <button className="cloud-dialog-close" type="button" onClick={() => dialogRef.current?.close()} aria-label="关闭">
          ×
        </button>
        <p className="cloud-dialog-kicker">CROSS-DEVICE SAVE</p>
        <h2>跨设备云存档</h2>
        <p>同步密钥相当于这份存档的密码。仅在自己的设备之间复制，不要公开分享。</p>
        <label>
          <span>同步密钥</span>
          <input ref={inputRef} type="password" autoComplete="off" defaultValue={service?.syncKey ?? ""} />
        </label>
        <div className="cloud-dialog-actions">
          <button type="button" onClick={() => void copy()}>复制密钥</button>
          <button className="primary" type="button" onClick={() => void importKey()}>导入并同步</button>
          <button type="button" onClick={() => void service?.syncNow()}>立即同步</button>
        </div>
      </dialog>
    </>
  );
}

function LoadingScreen() {
  return (
    <main className="phaser-loading" aria-label="正在载入游戏">
      <div className="loading-sun" />
      <div className="loading-nugget">⛏</div>
      <p>OLD CANYON CO.</p>
      <h1>正在打开西部金矿</h1>
      <span>准备矿层、卷扬机与云端进度…</span>
    </main>
  );
}

function App() {
  const [ready, setReady] = useState(VISUAL_TEST_MODE);
  const [status, setStatus] = useState<CloudSyncStatus>(INITIAL_STATUS);
  const [service, setService] = useState<CloudSyncService | null>(null);

  useEffect(() => {
    if (VISUAL_TEST_MODE) return undefined;

    const cloud = new CloudSyncService(setStatus);
    setService(cloud);
    let active = true;
    void cloud.initialize().finally(() => {
      if (active) setReady(true);
    });
    const fallback = window.setTimeout(() => setReady(true), 2_800);
    return () => {
      active = false;
      window.clearTimeout(fallback);
      cloud.stop();
    };
  }, []);

  return (
    <>
      {ready ? <GoldMinerGame /> : <LoadingScreen />}
      {!VISUAL_TEST_MODE && <CloudSyncDock service={service} status={status} />}
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount.");
createRoot(root).render(<App />);
