import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-metadata";
import { quests } from "@/data/quests";
import QuestsClient from "./quests-client";

export const metadata: Metadata = pageMetadata({
  title: "任務查詢 - 新楓之谷經典版",
  // 任務數從資料算，遊戲更新後重跑 build-quest-data 就會跟著變，不會再寫死過期
  description: `新楓之谷經典版任務查詢：${quests.length} 個任務的說明、接取與完成條件、要打的怪與要繳的道具、經驗值與獎勵，附任務流程與 NPC 所在地圖，可用任務名、怪物、道具或 NPC 搜尋。`,
  path: "/quests",
});

export default function Page() {
  return <QuestsClient />;
}
