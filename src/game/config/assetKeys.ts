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

export type AssetKey =
  | (typeof AssetKeys.backgrounds)[keyof typeof AssetKeys.backgrounds]
  | (typeof AssetKeys.miner)[keyof typeof AssetKeys.miner]
  | (typeof AssetKeys.hook)[keyof typeof AssetKeys.hook]
  | (typeof AssetKeys.items)[keyof typeof AssetKeys.items]
  | (typeof AssetKeys.particles)[keyof typeof AssetKeys.particles];

export const ALL_ASSET_KEYS: readonly AssetKey[] = [
  ...Object.values(AssetKeys.backgrounds),
  ...Object.values(AssetKeys.miner),
  ...Object.values(AssetKeys.hook),
  ...Object.values(AssetKeys.items),
  ...Object.values(AssetKeys.particles),
];
