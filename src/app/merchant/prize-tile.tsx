"use client";

import { useState } from "react";
import { CATEGORY_META, prizeIcon, prizeLabel, type Prize } from "@/data/merchant";

/**
 * 商品圖示格子。
 *
 * 261 個商品都有圖（時裝用時裝搭配頁的縮圖、其他用 maplestory.io 的道具圖），
 * 底下的文字 fallback 只在圖檔載入失敗時才會出現（例如還沒跑 download-icons.py）。
 */
export function PrizeTile({
  prize,
  count,
  size = 48,
  dimmed = false,
  showQty = true,
}: {
  prize: Prize;
  /** 出現過幾次；> 1 時右上角顯示數量徽章 */
  count?: number;
  size?: number;
  dimmed?: boolean;
  /**
   * 右下角標一格給幾個（×50）。同一個道具會以不同數量出現（橙色藥丸 ×50／×100），
   * 圖一模一樣，只有圖示的地方（挑選器、目標）不標就分不出來。旁邊已經寫了名稱的傳 false。
   */
  showQty?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const meta = CATEGORY_META[prize.category];
  const chars = prize.name.slice(0, 2);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-md border transition ${
        dimmed ? "opacity-30 saturate-50 dark:opacity-50" : ""
      }`}
      style={{
        width: size,
        height: size,
        borderColor: failed ? meta.deep : "var(--border)",
        background: failed
          ? `linear-gradient(160deg, ${meta.color} 0%, ${meta.deep} 100%)`
          : "var(--bg)",
        boxShadow: failed ? "inset 0 -1px 3px rgba(0,0,0,0.35)" : undefined,
      }}
      title={`${prizeLabel(prize)}（${prize.rate}%）`}
    >
      {failed ? (
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
        // eslint-disable-next-line @next/next/no-img-element -- 兩百多張像素小圖，不需要 next/image
        <img
          src={prizeIcon(prize)}
          alt={prize.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain p-0.5"
          style={{ imageRendering: "pixelated" }}
          onError={() => setFailed(true)}
        />
      )}

      {showQty && prize.qty > 1 && (
        <span className="absolute bottom-0 right-0 rounded-tl rounded-br-md bg-black/65 px-0.5 text-[0.55rem] font-bold leading-tight text-white">
          {prize.qty}
        </span>
      )}

      {count !== undefined && count > 1 && (
        <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-slate-900 px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white ring-1 ring-white/40">
          {count > 999 ? "999+" : count}
        </span>
      )}
    </span>
  );
}
