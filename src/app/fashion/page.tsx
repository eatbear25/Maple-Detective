import type { Metadata } from "next";
import FashionClient from "./fashion-client";

export const metadata: Metadata = {
  title: "時裝搭配 / 點裝搭配模擬 - 新楓之谷經典版",
  description:
    "新楓之谷經典版時裝搭配（點裝搭配）紙娃娃試衣間：線上試穿髮型、臉型與各部位時裝，可疊上點裝特效預覽，收錄七千多件時裝、含客戶端尚未開放的品項。",
  alternates: { canonical: "/fashion" },
};

export default function Page() {
  return <FashionClient />;
}
