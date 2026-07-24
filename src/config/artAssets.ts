export interface ArtAssetSource {
  webp?: string;
  png?: string;
  fallback: string;
  alt: string;
  placeholder: boolean;
}

export const ArtAssets = {
  menuMinerPortrait: {
    webp: "/assets/menu/miner-portrait.webp",
    png: "/assets/menu/miner-portrait.png",
    fallback: "/assets/placeholders/menu/miner-portrait-placeholder.svg",
    alt: "",
    placeholder: true,
  },
} as const satisfies Record<string, ArtAssetSource>;
