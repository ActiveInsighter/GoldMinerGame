import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const SITE_TITLE = "黄金矿工：西部淘金记";
const SITE_DESCRIPTION =
  "甩出抓钩，掘出黄金。支持键盘、鼠标与触屏的原创黄金矿工网页游戏。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const imageUrl = `${origin}/og.png`;

  return {
    title: {
      default: SITE_TITLE,
      template: "%s｜黄金矿工",
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_TITLE,
    keywords: ["黄金矿工", "网页游戏", "休闲游戏", "Gold Miner"],
    icons: {
      icon: [{ url: imageUrl, type: "image/png" }],
      apple: [{ url: imageUrl, type: "image/png" }],
    },
    openGraph: {
      type: "website",
      url: origin,
      siteName: SITE_TITLE,
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      locale: "zh_CN",
      images: [
        {
          url: imageUrl,
          width: 1_731,
          height: 909,
          alt: "黄金矿工：西部淘金记——原创西部矿场与抓钩淘金场景",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
