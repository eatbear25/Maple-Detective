import type { Metadata } from "next";
import SkillBuildClient from "./skill-build-client";

export const metadata: Metadata = {
  title: "技能模擬器 / 配點模擬 - 新楓之谷經典版",
  description:
    "新楓之谷經典版技能模擬器：線上模擬一轉、二轉的 SP 配點，會依前置技能與累計可得 SP 自動檢查，配好可以存草稿或產生分享連結。",
  alternates: { canonical: "/skill-build" },
};

export default function Page() {
  return <SkillBuildClient />;
}
