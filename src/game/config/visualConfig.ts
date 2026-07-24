import { WORLD_HEIGHT, WORLD_WIDTH } from "./gameConfig";

export const VisualDepth = {
  sky: -60,
  mineFar: -50,
  mineMid: -40,
  supports: -30,
  items: 0,
  rope: 10,
  hook: 12,
  miner: 20,
  mineFront: 30,
  effects: 50,
  floatingText: 60,
} as const;

export const BackgroundLayerConfig = {
  sky: { depth: VisualDepth.sky, alpha: 1, parallax: 0.02 },
  surface: { depth: VisualDepth.mineFar + 1, alpha: 1, parallax: 0.04 },
  mineFar: { depth: VisualDepth.mineFar, alpha: 1, parallax: 0.08 },
  mineMid: { depth: VisualDepth.mineMid, alpha: 1, parallax: 0.14 },
  mineSupports: { depth: VisualDepth.supports, alpha: 0.72, parallax: 0.2 },
  mineFront: { depth: VisualDepth.mineFront, alpha: 0.22, parallax: 0.28 },
} as const;

export const CameraConfig = {
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  desktopAspect: 16 / 9,
  portraitMinimumVisibleWidth: 900,
  portraitMinimumVisibleHeight: 650,
} as const;

export const ItemVisualScale: Record<string, number> = {
  smallGold: 0.72,
  mediumGold: 0.9,
  largeGold: 1.2,
  diamond: 0.82,
  rock: 1,
  mysteryChest: 0.96,
  tnt: 0.96,
  mole: 0.92,
  diamondMole: 0.96,
};
