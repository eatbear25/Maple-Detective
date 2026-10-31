// 神秘商人刷新引擎：不碰 DOM 的純邏輯，方便單獨驗證。
//
// 這裡沒有任何機率計算——不算期望值、不算 CDF、不算分佈、不算百分位。
// 引擎只回答「實際發生了什麼」。官方機率是四捨五入到 0.01% 的數字，
// 拿它推「要刷幾次」誤差很大，所以頁面只顯示這次實際模擬出來的結果。
import type { MerchantPool, Prize, Ticket } from "@/data/merchant";

/** 紀錄上限：整份紀錄最多這麼多批（存在瀏覽器裡，5 萬批 × 6 格 = 30 萬字元）。 */
export const RECORD_CAP = 50000;

/** 「刷 N 次」一次最多幾次。 */
export const AUTO_MAX = 10000;

/** 「刷到集滿為止」一次最多刷幾次，刷到還沒集滿就停下來回報。 */
export const UNTIL_MAX = 20000;

/** 「刷 N 次」的預設次數。 */
export const DEFAULT_AUTO_COUNT = 100;

export interface MerchantState {
  /** 已經刷了幾批 */
  refreshes: number;
  /** 依序記錄每一格出現的 prize key，每批 pool.slots 筆 */
  log: number[];
  /** prize key → 在貨架上出現過幾次 */
  counts: Map<number, number>;
  /** prize key → 第一次出現在第幾批（從 1 起算） */
  first: Map<number, number>;
}

export function emptyState(): MerchantState {
  return { refreshes: 0, log: [], counts: new Map(), first: new Map() };
}

/** 淺拷貝一份可安全變更的狀態。引擎的函式都是就地變更，UI 要保持 React 的不可變慣例就先 clone。 */
export function cloneState(s: MerchantState): MerchantState {
  return {
    refreshes: s.refreshes,
    log: [...s.log],
    counts: new Map(s.counts),
    first: new Map(s.first),
  };
}

/** 從存下來的 log 重建整份狀態。 */
export function fromLog(log: number[], slots: number): MerchantState {
  const s = emptyState();
  const n = Math.floor(log.length / slots) * slots;
  for (let i = 0; i < n; i++) {
    const k = log[i];
    s.counts.set(k, (s.counts.get(k) ?? 0) + 1);
    if (!s.first.has(k)) s.first.set(k, Math.floor(i / slots) + 1);
  }
  s.log = log.slice(0, n);
  s.refreshes = n / slots;
  return s;
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
 * 刷 n 次要花多少（新台幣；樂豆點與台幣 1:1）：自動用最省的買法，10 張一組優先，
 * 零頭單買超過一組的價錢就改買一組。只算刷新券，不含買下商品的錢。
 *
 * 一律拿「整份紀錄的總次數」算，不是每按一次各自算——一張一張點 10 次也是買一組最划算。
 */
export function refreshPrice(n: number, ticket: Ticket): number {
  return (
    Math.floor(n / 10) * ticket.bundle10 + Math.min((n % 10) * ticket.single, ticket.bundle10)
  );
}

/**
 * 換一批貨：每一格各自用官方機率表抽。
 *
 * 官方只公布「每一格的機率」，沒說同一批會不會避開重複，所以照字面每格獨立抽——
 * 同一批出現兩格一樣的商品是可能的（機率最高的藥丸也才 2%，很少見）。
 */
function restock(state: MerchantState, pool: MerchantPool, table: WeightedTable, rng: () => number) {
  const batch = state.refreshes + 1;
  for (let i = 0; i < pool.slots; i++) {
    const { key } = drawOne(table, rng);
    state.counts.set(key, (state.counts.get(key) ?? 0) + 1);
    if (!state.first.has(key)) state.first.set(key, batch);
    state.log.push(key);
  }
  state.refreshes = batch;
}

/** 刷 n 次（會被 RECORD_CAP 截短）。回傳實際刷了幾次。 */
export function refresh(
  state: MerchantState,
  pool: MerchantPool,
  table: WeightedTable,
  n: number,
  rng: () => number = Math.random,
): number {
  const count = Math.max(0, Math.min(Math.floor(n), RECORD_CAP - state.refreshes));
  for (let i = 0; i < count; i++) restock(state, pool, table, rng);
  return count;
}

/**
 * 一直刷到 keys 每件都出現過為止，最多 UNTIL_MAX 次（也會被 RECORD_CAP 截短）。
 * 回傳有沒有集滿。同步算完（2 萬批 × 6 格 <10ms），不需要 Web Worker。
 */
export function refreshUntil(
  state: MerchantState,
  pool: MerchantPool,
  table: WeightedTable,
  keys: number[],
  rng: () => number = Math.random,
): boolean {
  const waiting = new Set(keys.filter((k) => !state.first.has(k)));
  const stop = Math.min(state.refreshes + UNTIL_MAX, RECORD_CAP);
  while (waiting.size > 0 && state.refreshes < stop) {
    const start = state.log.length;
    restock(state, pool, table, rng);
    for (let j = start; j < state.log.length; j++) waiting.delete(state.log[j]);
  }
  return waiting.size === 0;
}

/** 第 n 批（從 1 起算）上架的商品。 */
export function batchAt(state: MerchantState, pool: MerchantPool, n: number): Prize[] {
  if (n < 1 || n > state.refreshes) return [];
  return state.log.slice((n - 1) * pool.slots, n * pool.slots).map((k) => pool.prizes[k]);
}

/** 第 from 批以後（不含 from）目標商品一共出現幾格。 */
export function goalHitsAfter(
  state: MerchantState,
  slots: number,
  goal: Set<number>,
  from: number,
): number {
  let hits = 0;
  for (let i = from * slots; i < state.log.length; i++) if (goal.has(state.log[i])) hits++;
  return hits;
}
