// 神秘商人模擬資料（來源：官方活動公告的機率表快照）。
// 產生流程：fetch-gacha-odds.py → build-merchant-data.py → generated/merchant.json
//
// 這裡不放刷新邏輯（見 src/app/merchant/engine.ts），也不放任何機率計算——
// 模擬器只回答「實際發生了什麼」，不回答「應該會發生什麼」。
import data from "./generated/merchant.json";
import { ASSET_BASE_URL } from "@/lib/asset-base";

/** 依 itemId 號段分的商品類別（build-merchant-data.py 的 category_of）。 */
export type Category =
  | "outfit"
  | "effect"
  | "weather"
  | "emote"
  | "throw"
  | "megaphone"
  | "utility"
  | "potion";

export interface Prize {
  /**
   * 在官方機率表裡的序號。同一個道具會以不同數量出現好幾次（橙色藥丸 ×50 與 ×100），
   * 所以出現次數、目標都用 key 識別，不用 itemId。
   */
  key: number;
  itemId: number;
  name: string;
  /** 一格裡給幾個（官方表寫成「高效能喇叭*20」） */
  qty: number;
  /** 官方公告的機率，百分比（例 0.35 = 0.35%）。每一格各自用這張表抽。 */
  rate: number;
  category: Category;
  /** fashion = 時裝搭配頁烤好的縮圖；item = maplestory.io 的道具圖 */
  icon: "fashion" | "item";
}

export interface Ticket {
  itemId: number;
  /** 刷新券單張價（樂豆點，與新台幣 1:1） */
  single: number;
  /** 10 張整包價 */
  bundle10: number;
  source: string;
}

export interface MerchantPool {
  eventAdId: number;
  title: string;
  startDate: string;
  endDate: string;
  /** 快照擷取日。官方頁面下線後這份就是唯一來源。 */
  capturedAt: string;
  /** 每一批上架幾個商品 */
  slots: number;
  ticket: Ticket;
  prizes: Prize[];
}

/** 依 endDate 由新到舊。 */
export const pools = data.pools as MerchantPool[];

/** 當期（最新一期）。 */
export function currentPool(): MerchantPool {
  return pools[0];
}

/** 「10/29 – 11/12」。這是資料標籤不是免責聲明——每期都從資料算，頁面上不寫死日期。 */
export function poolPeriod(pool: MerchantPool): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return `${fmt(pool.startDate)} – ${fmt(pool.endDate)}`;
}

/** 貨架與清單上顯示的名稱：「高效能喇叭 ×20」 */
export const prizeLabel = (p: Prize) => (p.qty > 1 ? `${p.name} ×${p.qty}` : p.name);

/**
 * 類別的顯示名稱、顏色、排序。UI 各處都從這裡拿，單一事實來源。
 *
 * `color` 用於文字與邊框，`deep` 是同色系的深色，當圖檔載入失敗時的 fallback 色塊底色。
 */
export const CATEGORY_META: Record<
  Category,
  { label: string; short: string; color: string; deep: string; order: number }
> = {
  outfit: { label: "時裝", short: "時裝", color: "#a855f7", deep: "#7e22ce", order: 0 },
  effect: { label: "角色特效", short: "特效", color: "#f59e0b", deep: "#b45309", order: 1 },
  weather: { label: "天氣效果", short: "天氣", color: "#0ea5e9", deep: "#0369a1", order: 2 },
  emote: { label: "表情", short: "表情", color: "#ec4899", deep: "#be185d", order: 3 },
  throw: { label: "投擲道具", short: "投擲", color: "#22c55e", deep: "#15803d", order: 4 },
  megaphone: { label: "喇叭", short: "喇叭", color: "#f97316", deep: "#c2410c", order: 5 },
  utility: { label: "護身符、復活與瞬移", short: "功能", color: "#14b8a6", deep: "#0f766e", order: 6 },
  potion: { label: "藥水", short: "藥水", color: "#ef4444", deep: "#b91c1c", order: 7 },
};

export const CATEGORY_ORDER = (Object.keys(CATEGORY_META) as Category[]).sort(
  (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order,
);

/** 圖示網址。時裝縮圖跟時裝搭配頁共用同一份檔案。 */
export function prizeIcon(prize: Prize): string {
  return prize.icon === "fashion"
    ? `${ASSET_BASE_URL}/icons/fashion/${prize.itemId}.png`
    : `${ASSET_BASE_URL}/icons/item/${prize.itemId}.png`;
}

/** 神秘商人麥吉。官方活動圖畫的就是勇士之村那位戴斗笠的麥吉（NPC 1022002）。 */
export const MERCHANT_NPC_ICON = `${ASSET_BASE_URL}/icons/npc/1022002.png`;
