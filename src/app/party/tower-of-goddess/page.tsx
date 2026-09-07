import type { Metadata } from "next";
import TowerOfGoddessClient from "./tower-of-goddess-client";

export const metadata: Metadata = {
  title: "女神之塔速查 - 新楓之谷經典版",
  description:
    "新楓之谷經典版組隊任務「女神之塔」關卡速查：休息室唱盤對照、封印房站位解答、倉庫怪物擊殺順序。",
  alternates: { canonical: "/party/tower-of-goddess" },
};

export default function Page() {
  return <TowerOfGoddessClient />;
}
