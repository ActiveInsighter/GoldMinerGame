import { useState, type ImgHTMLAttributes } from "react";
import type { ArtAssetSource } from "../config/artAssets";

interface ArtImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  asset: ArtAssetSource;
}

export function ArtImage({ asset, ...props }: ArtImageProps) {
  const [failed, setFailed] = useState(false);
  const useFallback = asset.placeholder || failed;
  const source = useFallback
    ? asset.fallback
    : (asset.png ?? asset.fallback);

  return (
    <picture data-art-state={useFallback ? "placeholder" : "formal"}>
      {!useFallback && asset.webp && (
        <source srcSet={asset.webp} type="image/webp" />
      )}
      <img
        {...props}
        src={source}
        alt={asset.alt}
        onError={() => {
          if (!useFallback && import.meta.env.DEV) {
            console.warn(
              `[art] Failed to load formal artwork; using ${asset.fallback}.`,
            );
          }
          setFailed(true);
        }}
      />
    </picture>
  );
}
