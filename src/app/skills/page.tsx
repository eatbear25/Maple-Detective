import type { Metadata } from "next";
import SkillsClient from "./skills-client";

export const metadata: Metadata = {
  title: "技能查詢 - 新楓之谷經典版",
  description:
    "新楓之谷經典版技能查詢：各職業每個技能的等級上限、前置技能與每一級的詳細數值，含尚未開放的四轉技能（未來視）。",
  alternates: { canonical: "/skills" },
};

export default function Page() {
  return <SkillsClient />;
}
