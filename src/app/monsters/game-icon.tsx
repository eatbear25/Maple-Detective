"use client";

import { useState } from "react";

/** 遊戲小圖示：載入失敗時顯示 emoji fallback（少數怪在 maplestory.io 沒圖） */
export function GameIcon({
  src,
  alt,
  fallback,
  className,
}: {
  src: string;
  alt: string;
  fallback: string;
  className?: string;
}) {
  // 記「哪個 src 失敗了」而不是 true/false：同一個元件換 src（任務頁切換 NPC）時
  // 不會把上一張的失敗狀態帶過去
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    <span className={`flex items-center justify-center ${className ?? ""}`}>
      {failed ? (
        <span className="text-xl leading-none">{fallback}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 上千張像素小圖，不需要 next/image 最佳化
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="max-w-full max-h-full object-contain"
          onError={() => setFailedSrc(src)}
          // 伺服器端渲染的頁面，圖可能在 React 接手前就 404 了，onError 會錯過；
          // 掛上去時補查一次（complete 且寬度 0 = 已經載入失敗）
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
          }}
        />
      )}
    </span>
  );
}
