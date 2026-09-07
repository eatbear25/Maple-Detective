import type { Metadata } from "next";
import BossTimerClient from "./boss-timer-client";

export const metadata: Metadata = {
  title: "BOSS 重生計時器 - 新楓之谷經典版",
  description:
    "新楓之谷經典版 BOSS 重生時間計時器：記下擊殺時間，自動算出下次重生的時間區間。重生間隔依社群玩家回報統計而來。",
  alternates: { canonical: "/boss-timer" },
};

export default function Page() {
  return <BossTimerClient />;
}
