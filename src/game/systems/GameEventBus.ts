import Phaser from "phaser";
import type { HudSnapshot, LevelResult, SimulationEvent } from "../simulation/simulationTypes";

interface EventMap {
  hud: HudSnapshot;
  simulation: SimulationEvent;
  paused: boolean;
  finished: LevelResult;
}

export class GameEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
