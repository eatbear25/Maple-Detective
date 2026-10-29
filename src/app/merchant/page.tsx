import type { Metadata } from "next";
import MerchantClient from "./merchant-client";

export const metadata: Metadata = {
  title: "神秘商人模擬器 - 新楓之谷經典版",
  description:
    "新楓之谷經典版神秘商人模擬器：用官方公布的機率表模擬刷新貨架，看要刷新幾次、花多少刷新券才等得到想要的時裝。",
  alternates: { canonical: "/merchant" },
};

export default function Page() {
  return <MerchantClient />;
}
