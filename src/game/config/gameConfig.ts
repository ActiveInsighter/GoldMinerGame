export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
export const GROUND_Y = 142;

export const HookConfig = {
  minimumLength: 48,
  maximumLength: 690,
  radius: 10,
  angleLimit: (68 * Math.PI) / 180,
  swingSpeed: (52 * Math.PI) / 180,
  extendSpeed: 780,
  emptyReturnSpeed: 1_080,
  originMinX: 510,
  originMaxX: 770,
} as const;

export const SimulationConfig = {
  maximumDeltaSeconds: 0.25,
  fixedSubstepSeconds: 0.05,
  hudIntervalSeconds: 0.1,
} as const;
