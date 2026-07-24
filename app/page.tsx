import type { Metadata } from "next";
import { GoldMinerGame } from "./GoldMinerGame";

export const metadata: Metadata = {
  title: "黄金矿工：西部淘金记",
  description:
    "原创卡通西部风格的完整黄金矿工网页游戏：摆动抓钩、限时闯关、商店道具、每日挑战与无尽模式。",
};

export default function Home() {
  return <GoldMinerGame />;
}
