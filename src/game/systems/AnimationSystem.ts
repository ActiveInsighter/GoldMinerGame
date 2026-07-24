import Phaser from "phaser";
import { AssetKeys, type MinerAnimationKey } from "../config/assetKeys";

export type MinerAnimationState =
  | "idle"
  | "fire"
  | "pull-light"
  | "pull-heavy"
  | "dynamite"
  | "celebrate"
  | "fail";

export interface MinerAnimationDescriptor {
  state: MinerAnimationState;
  key: MinerAnimationKey;
  framePrefix: string;
  frames: number;
  frameRate: number;
  loop: boolean;
  placeholder: boolean;
}

export const MINER_ANIMATIONS: Record<
  MinerAnimationState,
  MinerAnimationDescriptor
> = {
  idle: {
    state: "idle",
    key: AssetKeys.miner.idle,
    framePrefix: "miner/idle/",
    frames: 8,
    frameRate: 8,
    loop: true,
    placeholder: true,
  },
  fire: {
    state: "fire",
    key: AssetKeys.miner.fire,
    framePrefix: "miner/fire/",
    frames: 5,
    frameRate: 14,
    loop: false,
    placeholder: true,
  },
  "pull-light": {
    state: "pull-light",
    key: AssetKeys.miner.pullLight,
    framePrefix: "miner/pull-light/",
    frames: 8,
    frameRate: 10,
    loop: true,
    placeholder: true,
  },
  "pull-heavy": {
    state: "pull-heavy",
    key: AssetKeys.miner.pullHeavy,
    framePrefix: "miner/pull-heavy/",
    frames: 8,
    frameRate: 7,
    loop: true,
    placeholder: true,
  },
  dynamite: {
    state: "dynamite",
    key: AssetKeys.miner.dynamite,
    framePrefix: "miner/dynamite/",
    frames: 6,
    frameRate: 12,
    loop: false,
    placeholder: true,
  },
  celebrate: {
    state: "celebrate",
    key: AssetKeys.miner.celebrate,
    framePrefix: "miner/celebrate/",
    frames: 10,
    frameRate: 10,
    loop: true,
    placeholder: true,
  },
  fail: {
    state: "fail",
    key: AssetKeys.miner.fail,
    framePrefix: "miner/fail/",
    frames: 8,
    frameRate: 8,
    loop: false,
    placeholder: true,
  },
};

export const MINER_ANIMATION_STATES = Object.keys(
  MINER_ANIMATIONS,
) as MinerAnimationState[];

export const MINER_PLACEHOLDER_FRAMES: Record<
  MinerAnimationState,
  readonly [string, string]
> = Object.fromEntries(
  MINER_ANIMATION_STATES.map((state) => [
    state,
    [`miner-placeholder-${state}-0`, `miner-placeholder-${state}-1`] as const,
  ]),
) as Record<MinerAnimationState, readonly [string, string]>;

function formalFrameNames(
  scene: Phaser.Scene,
  descriptor: MinerAnimationDescriptor,
): string[] | null {
  if (!scene.textures.exists(AssetKeys.miner.atlas)) return null;
  const texture = scene.textures.get(AssetKeys.miner.atlas);
  const names = Array.from({ length: descriptor.frames }, (_, index) =>
    `${descriptor.framePrefix}${String(index).padStart(2, "0")}`,
  );
  return names.every((name) => texture.has(name)) ? names : null;
}

export function registerMinerAnimations(scene: Phaser.Scene): void {
  for (const state of MINER_ANIMATION_STATES) {
    const descriptor = MINER_ANIMATIONS[state];
    if (scene.anims.exists(descriptor.key)) continue;

    const formalNames = formalFrameNames(scene, descriptor);
    const frames = formalNames
      ? formalNames.map((frame) => ({
          key: AssetKeys.miner.atlas,
          frame,
        }))
      : MINER_PLACEHOLDER_FRAMES[state].map((key) => ({ key }));

    scene.anims.create({
      key: descriptor.key,
      frames,
      frameRate: descriptor.frameRate,
      repeat: descriptor.loop ? -1 : 0,
    });

    if (
      import.meta.env.DEV &&
      scene.textures.exists(AssetKeys.miner.atlas) &&
      !formalNames
    ) {
      console.warn(
        `[animations] Atlas frames for ${descriptor.key} were not found; placeholder frames are active.`,
      );
    }
  }
}

export function getMinerInitialTexture(scene: Phaser.Scene): string {
  const idle = MINER_ANIMATIONS.idle;
  const formalNames = formalFrameNames(scene, idle);
  return formalNames ? AssetKeys.miner.atlas : MINER_PLACEHOLDER_FRAMES.idle[0];
}
