/**
 * Compatibility exports for code that previously imported the legacy Canvas
 * runtime. The runtime itself was removed: GameSimulation is now the only
 * gameplay state owner and Phaser renders its snapshot directly.
 */
export { WORLD_HEIGHT, WORLD_WIDTH } from "./config/gameConfig";
export { GameSimulation as GoldMinerSimulation } from "./simulation/GameSimulation";
export type {
  EngineOptions,
  EngineStats,
  GameMode,
  HookState,
  HudSnapshot,
  LevelResult,
  RandomEventType,
  SoundName,
} from "./simulation/simulationTypes";
