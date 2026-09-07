import type { Metadata } from "next";
import GachaClient from "./gacha-client";

export const metadata: Metadata = {
  title: "轉蛋模擬器 - 新楓之谷經典版",
  description:
    "新楓之谷經典版轉蛋模擬器：用官方公布的機率表模擬單抽與連抽，記錄抽到的獎品與累計花費，先在這裡試手氣再決定要不要課。",
  alternates: { canonical: "/gacha" },
};

export default function Page() {
  return <GachaClient />;
}
