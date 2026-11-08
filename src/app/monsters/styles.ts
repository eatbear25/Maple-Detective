// 怪物詳情共用的 class 字串。獨立成一個檔、不放 panels.tsx：panels 會引入整包怪物資料，
// 分享按鈕這種 client 元件從那邊拿樣式的話，/monsters/[id] 的 JS 會多出幾百 KB 的資料。

/** 圖示底下那塊淺色方框（設計稿 #F7F3EA）；跟著主題變，深色模式一樣是「比卡片深一點」 */
export const WELL_BG = "bg-[color-mix(in_srgb,var(--border)_45%,var(--surface))]";
/** 地圖 chip 的底色（設計稿 #F4EFE4） */
export const CHIP_BG = "bg-[color-mix(in_srgb,var(--border)_60%,var(--surface))]";

/** 標頭那排「分享」「完整頁面」小圓角按鈕 */
export const PILL =
  "inline-flex h-7 items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]";

/** 地圖 chip：可以點的（實心底）、不能點的（細框）、未實裝的（虛線框） */
export const MAP_CHIP = {
  link: `inline-flex min-h-8 items-center rounded-full px-3 py-1 text-[13px] text-[var(--text)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] ${CHIP_BG}`,
  plain:
    "inline-flex min-h-8 items-center rounded-full border border-[var(--border)] px-3 py-1 text-[13px] text-[var(--text-muted)]",
  future:
    "inline-flex min-h-8 items-center rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1 text-[13px] text-[var(--text-muted)]",
};

/** 掉落物的格子：360px 以下一欄、390px 的手機兩欄，寬一點自動排滿 */
export const DROP_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-2";

/** 一般卡片的外框 */
export const CARD = "rounded-2xl border border-[var(--border)] bg-[var(--surface)]";
