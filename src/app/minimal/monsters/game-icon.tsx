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
  const [failed, setFailed] = useState(false);
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
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
