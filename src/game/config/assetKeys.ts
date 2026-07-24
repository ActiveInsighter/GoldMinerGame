export const AssetKeys = {
  backgrounds: {
    sky: "background-sky",
    surface: "background-surface",
    mineFar: "background-mine-far",
    mineMid: "background-mine-mid",
    mineSupports: "background-mine-supports",
    mineFront: "background-mine-front",
  },
  miner: {
    atlas: "miner",
    placeholder: "miner-placeholder",
    idle: "miner-idle",
    fire: "miner-fire",
    pullLight: "miner-pull-light",
    pullHeavy: "miner-pull-heavy",
    dynamite: "miner-dynamite",
    celebrate: "miner-celebrate",
    fail: "miner-fail",
  },
  hook: {
    head: "hook-head",
  },
  items: {
    goldSmall: "gold-small",
    goldMedium: "gold-medium",
    goldLarge: "gold-large",
    rock: "rock",
    diamond: "diamond",
    chest: "chest",
    tnt: "tnt",
    mole: "mole",
    diamondMole: "diamond-mole",
  },
  particles: {
    dust: "particle-dust",
    spark: "particle-spark",
    smoke: "particle-smoke",
    rockChip: "particle-rock-chip",
    goldChip: "particle-gold-chip",
    star: "particle-star",
  },
} as const;

export type BackgroundTextureKey =
  (typeof AssetKeys.backgrounds)[keyof typeof AssetKeys.backgrounds];
export type MinerTextureKey =
  | typeof AssetKeys.miner.atlas
  | typeof AssetKeys.miner.placeholder;
export type MinerAnimationKey =
  | typeof AssetKeys.miner.idle
  | typeof AssetKeys.miner.fire
  | typeof AssetKeys.miner.pullLight
  | typeof AssetKeys.miner.pullHeavy
  | typeof AssetKeys.miner.dynamite
  | typeof AssetKeys.miner.celebrate
  | typeof AssetKeys.miner.fail;
export type HookTextureKey =
  (typeof AssetKeys.hook)[keyof typeof AssetKeys.hook];
export type ItemTextureKey =
  (typeof AssetKeys.items)[keyof typeof AssetKeys.items];
export type ParticleTextureKey =
  (typeof AssetKeys.particles)[keyof typeof AssetKeys.particles];

export type TextureAssetKey =
  | BackgroundTextureKey
  | MinerTextureKey
  | HookTextureKey
  | ItemTextureKey
  | ParticleTextureKey;

export type AssetKey = TextureAssetKey | MinerAnimationKey;

export const ALL_TEXTURE_KEYS: readonly TextureAssetKey[] = [
  ...Object.values(AssetKeys.backgrounds),
  AssetKeys.miner.atlas,
  AssetKeys.miner.placeholder,
  ...Object.values(AssetKeys.hook),
  ...Object.values(AssetKeys.items),
  ...Object.values(AssetKeys.particles),
];

export const ALL_ANIMATION_KEYS: readonly MinerAnimationKey[] = [
  AssetKeys.miner.idle,
  AssetKeys.miner.fire,
  AssetKeys.miner.pullLight,
  AssetKeys.miner.pullHeavy,
  AssetKeys.miner.dynamite,
  AssetKeys.miner.celebrate,
  AssetKeys.miner.fail,
];

export const ALL_ASSET_KEYS: readonly AssetKey[] = [
  ...ALL_TEXTURE_KEYS,
  ...ALL_ANIMATION_KEYS,
];
