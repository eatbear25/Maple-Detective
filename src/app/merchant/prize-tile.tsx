"use client";

import { useState } from "react";
import { CATEGORY_META, prizeIcon, prizeLabel, type Prize } from "@/data/merchant";

/**
 * 商品圖示。外框（底色、目標框線）由呼叫端決定，這裡只畫圖。
 *
 * 261 個商品都有圖（時裝用時裝搭配頁的縮圖、其他用 maplestory.io 的道具圖），
 * 文字色塊只在圖檔載入失敗時才會出現（例如還沒跑 download-icons.py）。
 *
 * `fit` 給了就把圖放大到塞得進 fit×fit 的最大整數倍（像素圖非整數倍放大會糊），
 * 沒給就照原尺寸、塞不下才縮。
 */
export function PrizeIcon({
  prize,
  fit,
  dimmed = false,
}: {
  prize: Prize;
  fit?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [scaled, setScaled] = useState<{ w: number; h: number } | null>(null);
  const meta = CATEGORY_META[prize.category];
  const dim = dimmed ? "opacity-45 dark:opacity-60" : "";

  if (failed) {
    return (
      <span
        className={`inline-flex size-9 shrink-0 select-none items-center justify-center rounded-md text-xs font-bold text-white ${dim}`}
        style={{ background: `linear-gradient(160deg, ${meta.color} 0%, ${meta.deep} 100%)` }}
        title={prizeLabel(prize)}
      >
        {prize.name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 兩百多張像素小圖，不需要 next/image
    <img
      src={prizeIcon(prize)}
      alt={prizeLabel(prize)}
      loading="lazy"
      className={`max-h-full max-w-full object-contain ${dim}`}
      style={{ imageRendering: "pixelated", width: scaled?.w, height: scaled?.h }}
      onLoad={(e) => {
        if (!fit) return;
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        const k = Math.max(1, Math.floor(fit / Math.max(w, h, 1)));
        setScaled({ w: w * k, h: h * k });
      }}
      onError={() => setFailed(true)}
    />
  );
}
