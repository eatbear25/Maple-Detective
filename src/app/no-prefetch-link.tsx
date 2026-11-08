import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * 站內連結一律用這個，不要直接用 next/link。
 *
 * next/link 預設「連結一出現在畫面上」就先向伺服器抓那一頁的資料（prefetch），
 * 每一次都算一個 Vercel CDN Request。2026-10-30 實測一個新訪客逛 5 頁打了 128 次，
 * 一半是這種預先載入——選單、怪物詳情頁的掉落清單，幾十個連結大多沒人點。
 * Hobby 方案一個月 100 萬次，流量一衝就見底。
 *
 * 2026-10-30 先改成「滑鼠移上去才預先載入」，2026-11-08 再改成完全不預先載入：
 * - 預先載入一頁要打兩次（`/_tree` 與 `/__PAGE__` 各一次），點了才載入只要一次；
 *   滑鼠掃過選單、首頁卡片沒點下去的，每個還會白打兩三次。
 * - 實測正式站點下去到新頁標題出現：有預先載入 250–350ms、沒有 275–420ms，
 *   時間大多花在畫面渲染，差距感覺不出來。
 */
export function NoPrefetchLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  return <Link {...props} prefetch={false} />;
}
