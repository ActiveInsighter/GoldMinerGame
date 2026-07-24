import { useState, type ImgHTMLAttributes } from "react";
import type { ArtAssetSource } from "../config/artAssets";

interface ArtImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  asset: ArtAssetSource;
}

export function ArtImage({ asset, ...props }: ArtImageProps) {
  const [failed, setFailed] = useState(false);
  const source = failed ? asset.fallback : (asset.png ?? asset.fallback);
  return (
    <picture data-art-state={failed || asset.placeholder ? "placeholder" : "formal"}>
      {!failed && asset.webp && <source srcSet={asset.webp} type="image/webp" />}
      <img
        {...props}
        src={source}
        alt={asset.alt}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
