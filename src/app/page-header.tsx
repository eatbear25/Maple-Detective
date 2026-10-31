import type { ReactNode } from "react";

/**
 * 內頁共用的頁首：標題＋一句副標＋（選填）標題底下的東西（分頁 pill、搜尋框）。
 *
 * 2026-10-31 統一：原本技能查詢／任務查詢／技能配點是小一號的細標題（text-xl semibold），
 * 其他頁是 text-3xl bold，換頁時標題忽大忽小。
 *
 * 沒有 "use client"、也不用 hook，伺服器端與 client 元件都能用。用了 useSearchParams 的頁面
 * （怪物掉落、BOSS 計時器、任務查詢、女神之塔）在靜態輸出時只會產出 <Suspense> 的 fallback，
 * 所以那幾頁的 fallback 也要放一份這個——不然伺服器回傳的 HTML 裡沒有 h1，搜尋引擎看不到標題。
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
      )}
      {children}
    </div>
  );
}
