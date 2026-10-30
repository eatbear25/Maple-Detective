"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * 站內連結一律用這個，不要直接用 next/link。
 *
 * next/link 預設「連結一出現在畫面上」就先向伺服器抓那一頁的資料（prefetch），
 * 每一次都算一個 Vercel CDN Request。2026-10-30 實測一個新訪客逛 5 頁打了 128 次，
 * 一半是這種預先載入——選單、怪物詳情頁的掉落清單，幾十個連結大多沒人點。
 * Hobby 方案一個月 100 萬次，流量一衝就見底。
 *
 * 改成「滑鼠移上去（或手指按下去）才預先載入」：會點的連結點下去一樣是瞬間換頁，
 * 沒人碰的連結不花錢。做法照 Next 官方文件的 HoverPrefetchLink。
 */
export function HoverPrefetchLink({
  prefetch,
  onMouseEnter,
  onTouchStart,
  ...props
}: ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={prefetch === false ? false : active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
    />
  );
}
