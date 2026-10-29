// 神秘商人刷新引擎：不碰 DOM 的純邏輯，方便單獨驗證。
//
// 這裡沒有任何機率計算——不算期望值、不算 CDF、不算分佈、不算百分位。
// 引擎只回答「實際發生了什麼」。（規格 .scratch/gacha-sim/spec.md 的「已知取捨 1」，
// 轉蛋改成神秘商人之後這條照舊）
import type { Goal, MerchantPool, Prize, Ticket } from "@/data/merchant";

/** 安全煞車：一個 session 最多刷新這麼多次。 */
export const REFRESH_CAP = 10000;

/** 連續刷新的預設次數。 */
export const DEFAULT_AUTO_COUNT = 100;

export interface MerchantState {
  refreshes: number;
  /** 已花費（新台幣；樂豆點與台幣 1:1）。只算刷新券，不含買下商品的錢。 */
  spent: number;
  /** prize key → 在貨架上出現過幾次 */
  counts: Map<number, number>;
  /** 依序記錄每一格出現的 prize key，每次刷新 pool.slots 筆。播放與結算用。 */
  log: number[];
}

export function emptyState(): MerchantState {
  return { refreshes: 0, spent: 0, counts: new Map(), log: [] };
}

/** 淺拷貝一份可安全變更的狀態。引擎的函式都是就地變更，UI 要保持 React 的不可變慣例就先 clone。 */
export function cloneState(s: MerchantState): MerchantState {
  return { refreshes: s.refreshes, spent: s.spent, counts: new Map(s.counts), log: [...s.log] };
}

/**
 * 加權隨機表。261 筆，建一次重複用，不要每格都重算。
 *
 * 官方機率總和是 100.06% 不是 100%（四捨五入誤差），按實際權重正規化。
 */
export interface WeightedTable {
  prizes: Prize[];
  /** 累積權重，最後一項等於 total */
  cumulative: number[];
  total: number;
}

export function buildTable(pool: MerchantPool): WeightedTable {
  const prizes = pool.prizes;
  const cumulative: number[] = [];
  let acc = 0;
  for (const p of prizes) {
    acc += p.rate;
    cumulative.push(acc);
  }
  return { prizes, cumulative, total: acc };
}

export function drawOne(table: WeightedTable, rng: () => number = Math.random): Prize {
  const r = rng() * table.total;
  // 二分搜尋累積權重
  let lo = 0;
  let hi = table.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table.cumulative[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return table.prizes[lo];
}

/**
 * 刷新 n 次的刷新券價錢：滿 10 次用整包價，餘數用單張價。
 * （100 張包的單價跟 10 張包一樣，不用另外算。）
 */
export function refreshPrice(n: number, ticket: Ticket): number {
  return Math.floor(n / 10) * ticket.bundle10 + (n % 10) * ticket.single;
}

/**
 * 換一批貨：每一格各自用官方機率表抽。
 *
 * 官方只公布「每一格的機率」，沒說同一批會不會避開重複，所以照字面每格獨立抽——
 * 同一批出現兩格一樣的商品是可能的（機率最高的藥丸也才 2%，很少見）。
 */
function restock(state: MerchantState, pool: MerchantPool, table: WeightedTable, rng: () => number) {
  for (let i = 0; i < pool.slots; i++) {
    const p = drawOne(table, rng);
    state.counts.set(p.key, (state.counts.get(p.key) ?? 0) + 1);
    state.log.push(p.key);
  }
  state.refreshes += 1;
}

/** 手動刷新 1 次，用單張刷新券計價。回傳這一批上架的商品。 */
export function refreshOnce(
  state: MerchantState,
  pool: MerchantPool,
  table: WeightedTable,
  rng: () => number = Math.random,
): Prize[] {
  restock(state, pool, table, rng);
  state.spent += pool.ticket.single;
  return state.log.slice(-pool.slots).map((k) => pool.prizes[k]);
}

// --- 目標判定 -----------------------------------------------------------

export interface GoalItem {
  key: number;
  /** 在貨架上出現過幾次 */
  seen: number;
}

export interface GoalProgress {
  done: boolean;
  items: GoalItem[];
  /** 已出現過的件數 */
  cleared: number;
}

/** 目標裡每件商品都至少出現過一次才算湊齊。 */
export function goalProgress(counts: Map<number, number>, goal: Goal): GoalProgress {
  const items = goal.keys.map((key) => ({ key, seen: counts.get(key) ?? 0 }));
  const cleared = items.filter((g) => g.seen > 0).length;
  return { done: items.length > 0 && cleared === items.length, items, cleared };
}

// --- 連續刷新 -----------------------------------------------------------

export interface AutoResult {
  /** 這一輪實際刷新了幾次（可能被 REFRESH_CAP 截短） */
  refreshes: number;
  /** 這一輪花了多少 */
  spent: number;
  /** 要求刷新的次數；被 REFRESH_CAP 截短時會大於 refreshes */
  requested: number;
  /**
   * 這一輪裡目標是在第幾次刷新湊齊的（從 1 起算、只算這一輪），以及那時這一輪花了多少。
   * 開始前就已經湊齊、或這一輪沒湊齊都是 null。
   */
  reached: { at: number; spent: number } | null;
}

/**
 * 連續刷新 n 次。
 *
 * 計價按「理性購買」：滿 10 次用整包價，餘數用單張價。
 * 這是同步純計算（10000 次 <10ms）——**播放動畫是 UI 的事**，
 * 引擎一次算完回傳結果，UI 再把過程快轉播放出來。
 *
 * 不會因為湊齊目標就停下來（「刷到湊齊為止」的模式 2026-08-20 因為太複雜廢除過），
 * 改成在結果裡回報是第幾次湊齊的。
 */
export function refreshMany(
  state: MerchantState,
  pool: MerchantPool,
  table: WeightedTable,
  count: number,
  goal: Goal,
  rng: () => number = Math.random,
): AutoResult {
  const requested = Math.max(0, Math.floor(count));
  const room = Math.max(0, REFRESH_CAP - state.refreshes);
  const n = Math.min(requested, room);

  // 開始前還沒出現過的目標商品。一開始就是空的＝已經湊齊（或沒設目標），不回報
  const waiting = new Set(goal.keys.filter((k) => !state.counts.has(k)));
  let reachedAt: number | null = null;

  for (let i = 0; i < n; i++) {
    const start = state.log.length;
    restock(state, pool, table, rng);
    if (reachedAt !== null || waiting.size === 0) continue;
    for (let j = start; j < state.log.length; j++) waiting.delete(state.log[j]);
    if (waiting.size === 0) reachedAt = i + 1;
  }

  const spent = refreshPrice(n, pool.ticket);
  state.spent += spent;

  return {
    refreshes: n,
    spent,
    requested,
    reached: reachedAt === null ? null : { at: reachedAt, spent: refreshPrice(reachedAt, pool.ticket) },
  };
}

// --- 統計 ---------------------------------------------------------------

export interface CategoryCount {
  category: Prize["category"];
  /** 出現過幾格（含重複） */
  seen: number;
  /** 這一類共有幾種商品 */
  kinds: number;
  /** 看過幾種（不含重複） */
  collected: number;
}

export function categoryCounts(counts: Map<number, number>, pool: MerchantPool): CategoryCount[] {
  const byCat = new Map<Prize["category"], { seen: number; kinds: number; collected: number }>();
  for (const p of pool.prizes) {
    const e = byCat.get(p.category) ?? { seen: 0, kinds: 0, collected: 0 };
    e.kinds += 1;
    const n = counts.get(p.key) ?? 0;
    e.seen += n;
    if (n > 0) e.collected += 1;
    byCat.set(p.category, e);
  }
  return [...byCat].map(([category, v]) => ({ category, ...v }));
}
