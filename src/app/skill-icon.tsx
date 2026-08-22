"use client";

/**
 * 技能圖示。圖檔在 public/icons/skill/<skillId>.png，來源見
 * reference-data/skill-icon-map.json。
 *
 * 少數技能兩邊來源都比對不到圖（客戶端圖集沒有名字、參考站也沒收），
 * 這時退回一個中性色塊——破圖的 alt 框比沒有圖還吵。
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { skillIconSrc } from "@/data/skills";

export function SkillIcon({
  id,
  size = 24,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (failed) {
    return (
      <span
        style={box}
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[var(--text-muted)] ${className}`}
      >
        <Sparkles size={Math.max(10, Math.round(size * 0.5))} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={skillIconSrc(id)}
      alt=""
      style={box}
      onError={() => setFailed(true)}
      className={`shrink-0 ${className}`}
    />
  );
}
