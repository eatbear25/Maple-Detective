import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-metadata";
import { fashionItems } from "@/data/fashion";
import FashionClient from "./fashion-client";

export const metadata: Metadata = pageMetadata({
  title: "時裝搭配 / 點裝搭配模擬 - 新楓之谷經典版",
  // 件數從資料算，重跑 build-fashion-data 就會跟著變。
  // 特效分頁目前關著（fashion-client.tsx 註解掉），重新開放前別把「特效」寫回來。
  description: `新楓之谷經典版時裝搭配（點裝搭配）紙娃娃試衣間：線上試穿髮型、臉型與各部位時裝，收錄 ${fashionItems.length.toLocaleString("en-US")} 件時裝、含客戶端尚未開放的品項，搭好可以存起來或產生分享連結。`,
  path: "/fashion",
});

export default function Page() {
  return <FashionClient />;
}
