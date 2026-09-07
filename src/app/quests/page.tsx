import type { Metadata } from "next";
import QuestsClient from "./quests-client";

export const metadata: Metadata = {
  title: "任務查詢 - 新楓之谷經典版",
  description:
    "新楓之谷經典版任務查詢：490 個任務的接取條件、需求等級、要打的怪與要繳的道具、經驗值與獎勵，附任務鏈順序與 NPC 所在地圖。",
  alternates: { canonical: "/quests" },
};

export default function Page() {
  return <QuestsClient />;
}
