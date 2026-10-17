import type { Metadata } from "next";
import SkillBuildClient from "./skill-build-client";

export const metadata: Metadata = {
  title: "技能模擬器 / 配點模擬 - 新楓之谷經典版",
  description:
    "新楓之谷經典版技能模擬器：線上模擬一轉到三轉的 SP 配點，會依前置技能、累計可得 SP 與轉職前要點完的規則自動檢查，配好可以存草稿或產生分享連結。",
  alternates: { canonical: "/skill-build" },
};

export default function Page() {
  return <SkillBuildClient />;
}
