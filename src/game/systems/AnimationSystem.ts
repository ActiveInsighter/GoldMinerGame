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
