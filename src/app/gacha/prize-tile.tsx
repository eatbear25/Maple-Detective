"use client";

import { useState } from "react";
import { TIER_META, prizeIcon, type Prize } from "@/data/gacha";

/**
 * 獎品格子。
 *
 * 圖示來源走 `prize.icon`：101 個獎品裡有 61 個是台服專屬、自己沒有圖，
 * 改顯示「它實際代表的東西」（交換券→本體道具、變身藥水→變成的怪），
 * 對應表見 reference-data/gacha-icon-alias.json。目前 101/101 都有圖。
 *
 * 底下的文字 fallback 只在圖檔載入失敗時才會出現（例如還沒跑 download-icons.py）。
 *
 * `tone` 決定格子底色要配淺色版面還是深色版面。
 */
export function PrizeTile({
  prize,
  count,
  size = 48,
  dimmed = false,
  tone = "light",
}: {
  prize: Prize;
  /** 已抽到幾個；> 1 時右上角顯示數量徽章 */
  count?: number;
  size?: number;
  dimmed?: boolean;
  tone?: "light" | "dark";
}) {
  const [failed, setFailed] = useState(false);
  const meta = TIER_META[prize.tier];
  const src = prizeIcon(prize);
  const showFallback = failed || src === null;
  const chars = prize.name.slice(0, 2);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border transition ${
        dimmed ? "opacity-30 saturate-50" : ""
      }`}
      style={{
        width: size,
        height: size,
        borderColor: showFallback ? meta.deep : tone === "dark" ? "#ffffff26" : "var(--border)",
        background: showFallback
          ? `linear-gradient(160deg, ${meta.color} 0%, ${meta.deep} 100%)`
          : tone === "dark"
            ? "#0f172a"
            : "var(--bg)",
        boxShadow: showFallback ? "inset 0 -1px 3px rgba(0,0,0,0.35)" : undefined,
      }}
      title={`${prize.name}（${prize.rate}%）`}
    >
      {showFallback ? (
        <span
          className="select-none font-bold leading-none tracking-tight text-white"
          style={{
            fontSize: Math.round(size * 0.36),
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {chars}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 百來張像素小圖，不需要 next/image
        <img
          src={src}
          alt={prize.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain p-0.5"
          style={{ imageRendering: "pixelated" }}
          onError={() => setFailed(true)}
        />
      )}

      {count !== undefined && count > 1 && (
        <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-slate-900 px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white ring-1 ring-white/40">
          {count > 999 ? "999+" : count}
        </span>
      )}
    </span>
  );
}

/** 空格子，用於「還沒抽到」的格位與翻卡前的背面。 */
export function EmptySlot({
  size = 48,
  tone = "light",
  label,
}: {
  size?: number;
  tone?: "light" | "dark";
  label?: string;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-dashed text-[0.65rem] font-medium"
      style={{
        width: size,
        height: size,
        borderColor: tone === "dark" ? "#ffffff2e" : "var(--border)",
        background: tone === "dark" ? "#ffffff0a" : "var(--bg)",
        color: tone === "dark" ? "#ffffff4d" : "var(--text-muted)",
      }}
    >
      {label ?? ""}
    </span>
  );
}
