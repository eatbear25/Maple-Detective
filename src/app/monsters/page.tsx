import type { Metadata } from "next";
import MonstersClient from "./monsters-client";

export const metadata: Metadata = {
  title: "怪物掉落查詢 - 新楓之谷經典版",
  description:
    "新楓之谷經典版怪物掉落查詢：查每隻怪掉哪些道具、出沒在哪些地圖，也可以反查一件道具是哪些怪掉的。附等級、HP、經驗值與屬性弱點，資料取自遊戲用戶端圖鑑。",
  alternates: { canonical: "/monsters" },
};

export default function Page() {
  return <MonstersClient />;
}
