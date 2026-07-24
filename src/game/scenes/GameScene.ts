import Phaser from "phaser";
import { GROUND_Y, SimulationConfig, WORLD_HEIGHT, WORLD_WIDTH } from "../config/gameConfig";
import { BackgroundLayers } from "../objects/BackgroundLayers";
import { Hook } from "../objects/Hook";
import { MineItemView } from "../objects/MineItemView";
import { Miner } from "../objects/Miner";
import { Rope } from "../objects/Rope";
import { GameSimulation } from "../simulation/GameSimulation";
import type { EngineOptions, SimulationEvent } from "../simulation/simulationTypes";
import { EffectsSystem } from "../systems/EffectsSystem";

export interface GameSceneHost {
  attachScene(scene: GameScene): void;
  detachScene(scene: GameScene): void;
  shouldStartImmediately(): boolean;
}

export class GameScene extends Phaser.Scene {
  private simulation?: GameSimulation;
  private background?: BackgroundLayers;
  private miner?: Miner;
  private rope?: Rope;
  private hookView?: Hook;
  private effects?: EffectsSystem;
  private readonly itemViews = new Map<string, MineItemView>();
  private running = false;
  private hudAccumulator = 1;
  private finished = false;

  constructor(
    key: string,
    private readonly options: EngineOptions,
    private readonly host: GameSceneHost,
  ) {
    super({ key });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor("#8f5f3d");
    this.background = new BackgroundLayers(this);
    this.simulation = new GameSimulation(this.options);
    this.effects = new EffectsSystem(this, this.options.reducedMotion ?? false);
    this.rope = new Rope(this);
    this.hookView = new Hook(this);
    this.miner = new Miner(this, WORLD_WIDTH / 2, GROUND_Y - 2, this.options.reducedMotion ?? false);

    const snapshot = this.simulation.getSnapshot();
    for (const item of snapshot.items) this.ensureItemView(item);
    this.syncViews();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);
    this.input.keyboard?.on("keydown-SPACE", this.handleFireKey, this);
    this.input.keyboard?.on("keydown-DOWN", this.handleFireKey, this);
    this.input.keyboard?.on("keydown-D", this.handleDynamiteKey, this);
    this.input.keyboard?.on("keydown-ESC", this.handlePauseKey, this);
    this.input.keyboard?.on("keydown-LEFT", this.handleLeftKey, this);
    this.input.keyboard?.on("keydown-RIGHT", this.handleRightKey, this);
    document.addEventListener("visibilitychange", this.handleVisibility);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.host.attachScene(this);
    this.running = this.host.shouldStartImmediately();
    this.options.onHud(this.simulation.getHudSnapshot());
    this.flushEvents();
  }

  update(_time: number, deltaMilliseconds: number): void {
    if (!this.running || !this.simulation || this.finished) return;
    const delta = deltaMilliseconds / 1_000;
    this.simulation.update(delta);
    this.hudAccumulator += Math.min(delta, SimulationConfig.maximumDeltaSeconds);
    this.syncViews();
    this.flushEvents();
    if (this.hudAccumulator >= SimulationConfig.hudIntervalSeconds) {
      this.hudAccumulator = 0;
      this.options.onHud(this.simulation.getHudSnapshot());
    }
  }

  setRunning(running: boolean): void {
    this.running = running && !this.finished;
  }

  fire(): boolean {
    const fired = this.simulation?.fire() ?? false;
    if (fired) this.flushEvents();
    return fired;
  }

  useDynamite(): boolean {
    const used = this.simulation?.useDynamite() ?? false;
    if (used) {
      this.syncViews();
      this.flushEvents();
      if (this.simulation) this.options.onHud(this.simulation.getHudSnapshot());
    }
    return used;
  }

  setPaused(paused: boolean): void {
    if (!this.simulation || this.finished) return;
    this.simulation.setPaused(paused);
    this.options.onPauseChange?.(paused);
    this.options.onHud(this.simulation.getHudSnapshot());
  }

  togglePaused(): void {
    if (!this.simulation || this.finished) return;
    this.setPaused(!this.simulation.getSnapshot().paused);
  }

  private syncViews(): void {
    if (!this.simulation) return;
    const snapshot = this.simulation.getSnapshot();
    this.background?.sync(this.cameras.main.midPoint.x);
    this.rope?.setAimAssist(this.options.effects.aimAssistSeconds > snapshot.elapsed);
    this.rope?.sync(snapshot.hook);
    this.hookView?.sync(snapshot.hook);
    this.miner?.setX(snapshot.hook.originX);
    this.miner?.syncFromHook(snapshot.hook.state, snapshot.hook.pullWeight);

    for (const item of snapshot.items) {
      const view = this.ensureItemView(item);
      view.sync(item, snapshot.elapsed);
    }
  }

  private ensureItemView(item: ReturnType<GameSimulation["getSnapshot"]>["items"][number]): MineItemView {
    const existing = this.itemViews.get(item.id);
    if (existing) return existing;
    const view = new MineItemView(this, item);
    this.itemViews.set(item.id, view);
    return view;
  }

  private flushEvents(): void {
    if (!this.simulation) return;
    for (const event of this.simulation.drainEvents()) this.handleSimulationEvent(event);
  }

  private handleSimulationEvent(event: SimulationEvent): void {
    this.effects?.handle(event);
    if (event.type === "sound") this.options.onSound?.(event.name);
    else if (event.type === "announcement") this.options.onAnnouncement?.(event.message);
    else if (event.type === "item-added") this.ensureItemView(event.item);
    else if (event.type === "item-removed") {
      const view = this.itemViews.get(event.id);
      if (view) {
        this.itemViews.delete(event.id);
        this.tweens.add({
          targets: view,
          alpha: 0,
          scaleX: event.reason === "destroyed" ? 1.45 : 0.5,
          scaleY: event.reason === "destroyed" ? 1.45 : 0.5,
          duration: this.options.reducedMotion ? 80 : 220,
          onComplete: () => view.destroy(),
        });
      }
    } else if (event.type === "finished") {
      this.finished = true;
      this.running = false;
      this.miner?.playState(event.result.won ? "celebrate" : "fail");
      this.options.onHud(this.simulation!.getHudSnapshot());
      this.options.onEnd(event.result);
    }
  }

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.primaryDown) this.fire();
  }

  private handleFireKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    event.preventDefault();
    this.fire();
  }

  private handleDynamiteKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    event.preventDefault();
    this.useDynamite();
  }

  private handlePauseKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    event.preventDefault();
    this.togglePaused();
  }

  private handleLeftKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (this.simulation?.moveOrigin(-30)) event.preventDefault();
  }

  private handleRightKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (this.simulation?.moveOrigin(30)) event.preventDefault();
  }

  private handleVisibility = (): void => {
    if (document.hidden && this.simulation && !this.simulation.getSnapshot().paused && !this.finished) {
      this.setPaused(true);
    }
  };

  private shutdown(): void {
    this.host.detachScene(this);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);
    this.input.keyboard?.off("keydown-SPACE", this.handleFireKey, this);
    this.input.keyboard?.off("keydown-DOWN", this.handleFireKey, this);
    this.input.keyboard?.off("keydown-D", this.handleDynamiteKey, this);
    this.input.keyboard?.off("keydown-ESC", this.handlePauseKey, this);
    this.input.keyboard?.off("keydown-LEFT", this.handleLeftKey, this);
    this.input.keyboard?.off("keydown-RIGHT", this.handleRightKey, this);
    this.effects?.destroy();
    this.effects = undefined;
    this.itemViews.clear();
    this.simulation = undefined;
  }
}
