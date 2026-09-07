import type { Metadata } from "next";
import MapClient from "./map-client";

export const metadata: Metadata = {
  title: "地圖導覽與世界地圖 - 新楓之谷經典版",
  description:
    "新楓之谷經典版地圖導覽：在遊戲世界地圖上找地圖位置，看每張地圖有哪些怪物出沒、等級多少，也能一路查到隱藏地圖與迷你地城。",
  alternates: { canonical: "/map" },
};

export default function Page() {
  return <MapClient />;
}
