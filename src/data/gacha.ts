// 轉蛋模擬器資料（來源：官方活動公告的機率表快照）。
// 產生流程：fetch-gacha-odds.py → build-gacha-data.py → generated/gacha.json
//
// 這裡不放抽卡邏輯（見 src/app/gacha/engine.ts），也不放任何機率計算——
// 模擬器只回答「實際發生了什麼」，不回答「應該會發生什麼」。
import data from "./generated/gacha.json";

/** 稀有度分層。依官方機率值分組，是分類不是計算。 */
export type Tier =
  | "emote"
  | "chair"
  | "bag"
  | "morph"
  | "reset"
  | "scroll"
  | "slot"
  | "rare";

/**
 * 獎品實際要顯示的圖示來源。
 *
 * 101 個獎品裡有 61 個是台服經典版專屬、maplestory.io 沒有自己的圖，
 * 所以顯示「它實際代表的東西」：交換券顯示它換到的本體道具，
 * 變身藥水顯示它變成的那隻怪。對應表在 reference-data/gacha-icon-alias.json。
 */
export interface IconRef {
  kind: "item" | "mob";
  id: number;
}

export interface Prize {
  itemId: number | null;
  name: string;
  /** 官方公告的機率，百分比（例 1.48 = 1.48%） */
  rate: number;
  tier: Tier;
  icon: IconRef | null;
}

/** 目標的一個條件：`any` 裡任一道具的持有量加總達到 `count` 即滿足。 */
export interface GoalGroup {
  any: number[];
  count: number;
}

/** 目標 = AND of OR-groups。所有 group 都滿足才算達成。 */
export interface Goal {
  id: string;
  label: string;
  /** null = 獎勵未公開 */
  reward: string | null;
  groups: GoalGroup[];
}

export interface Ticket {
  itemId: number;
  /** 單抽價（樂豆點，與新台幣 1:1） */
  single: number;
  /** 十連整包價 */
  bundle10: number;
  source: string;
}

export interface GachaPool {
  eventAdId: number;
  title: string;
  startDate: string;
  endDate: string;
  /** 快照擷取日。官方頁面下線後這份就是唯一來源。 */
  capturedAt: string;
  ticket: Ticket;
  prizes: Prize[];
  goals: Goal[];
}

/** 依 endDate 由新到舊。 */
export const pools = data.pools as GachaPool[];

/** 當期（最新一期）。目前只有一期。 */
export function currentPool(): GachaPool {
  return pools[0];
}

export function isExpired(pool: GachaPool): boolean {
  return new Date(pool.endDate).getTime() < Date.now();
}

/** 「2026/08/20 ~ 09/10」。這是資料標籤不是免責聲明——多期並存時用來分辨哪張表是哪期的。 */
export function poolPeriod(pool: GachaPool): string {
  const fmt = (iso: string, withYear: boolean) => {
    const d = new Date(iso);
    const md = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    return withYear ? `${d.getFullYear()}/${md}` : md;
  };
  return `${fmt(pool.startDate, true)} ~ ${fmt(pool.endDate, false)}`;
}

/**
 * 稀有度的顯示名稱、顏色、分群排序。UI 各處都從這裡拿，單一事實來源。
 *
 * 兩組顏色：`color` 用於文字與邊框（淺底可讀），`deep` 是同色系的深色，
 * 專門當「缺圖 fallback 色塊」的底色——白字放在上面才有足夠對比。
 * 101 個獎品裡有 61 個沒有圖示，fallback 出現的頻率很高，不能只是淡淡的色塊。
 */
export const TIER_META: Record<
  Tier,
  { label: string; short: string; color: string; deep: string; glow: string; order: number }
> = {
  rare: {
    label: "橡皮擦與任務道具",
    short: "稀有",
    color: "#f59e0b",
    deep: "#b45309",
    glow: "0 0 26px 7px rgba(245,158,11,0.7)",
    order: 0,
  },
  chair: {
    label: "椅子",
    short: "椅子",
    color: "#a855f7",
    deep: "#7e22ce",
    glow: "0 0 22px 6px rgba(168,85,247,0.6)",
    order: 1,
  },
  slot: {
    label: "擴充券與瞬移之石",
    short: "擴充",
    color: "#0ea5e9",
    deep: "#0369a1",
    glow: "0 0 18px 5px rgba(14,165,233,0.5)",
    order: 2,
  },
  reset: {
    label: "重配卷軸交換券",
    short: "重配",
    color: "#14b8a6",
    deep: "#0f766e",
    glow: "0 0 18px 5px rgba(20,184,166,0.5)",
    order: 3,
  },
  morph: {
    label: "變身藥水與雕像",
    short: "變身",
    color: "#22c55e",
    deep: "#15803d",
    glow: "0 0 16px 4px rgba(34,197,94,0.45)",
    order: 4,
  },
  bag: {
    label: "黑之包",
    short: "包包",
    color: "#94a3b8",
    deep: "#475569",
    glow: "0 0 14px 4px rgba(148,163,184,0.4)",
    order: 5,
  },
  scroll: {
    label: "100% 卷軸",
    short: "卷軸",
    color: "#a1a1aa",
    deep: "#52525b",
    glow: "none",
    order: 6,
  },
  emote: {
    label: "表情與特效交換券",
    short: "表情",
    color: "#a8a29e",
    deep: "#57534e",
    glow: "none",
    order: 7,
  },
};

export const TIER_ORDER = (Object.keys(TIER_META) as Tier[]).sort(
  (a, b) => TIER_META[a].order - TIER_META[b].order,
);

export function prizeIcon(prize: Prize): string | null {
  if (!prize.icon) return null;
  return prize.icon.kind === "mob"
    ? `/icons/mob/${prize.icon.id}.gif`
    : `/icons/item/${prize.icon.id}.png`;
}

/** 轉蛋機圖。9110011 = 遊戲截圖裡那台（機身有紅楓葉）。 */
export const GACHA_MACHINE_ICON = "/icons/npc/9110011.png";

/** itemId → 獎品，供獲得清單與機率表連動用。 */
export function prizeIndex(pool: GachaPool): Map<number, Prize> {
  const m = new Map<number, Prize>();
  for (const p of pool.prizes) if (p.itemId !== null) m.set(p.itemId, p);
  return m;
}
