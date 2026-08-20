// 轉蛋抽卡引擎：不碰 DOM 的純邏輯，方便單獨驗證。
//
// 這裡沒有任何機率計算——不算期望值、不算 CDF、不算分佈、不算百分位。
// 引擎只回答「實際發生了什麼」。（規格 .scratch/gacha-sim/spec.md 的「已知取捨 1」）
import type { GachaPool, Goal, Prize } from "@/data/gacha";

/** 安全煞車：一個 session 最多抽這麼多次。 */
export const PULL_CAP = 10000;

/** 連抽的預設次數。 */
export const DEFAULT_AUTO_COUNT = 100;

export interface GachaState {
  pulls: number;
  /** 已花費（新台幣；樂豆點與台幣 1:1） */
  spent: number;
  /** itemId → 抽到幾個 */
  counts: Map<number, number>;
  /** 依序記錄每次抽到的 itemId。結算用，不對外顯示逐筆。 */
  log: number[];
}

export function emptyState(): GachaState {
  return { pulls: 0, spent: 0, counts: new Map(), log: [] };
}

/** 淺拷貝一份可安全變更的狀態。引擎的函式都是就地變更，UI 要保持 React 的不可變慣例就先 clone。 */
export function cloneState(s: GachaState): GachaState {
  return { pulls: s.pulls, spent: s.spent, counts: new Map(s.counts), log: [...s.log] };
}

/**
 * 加權隨機表。101 筆，建一次重複用，不要每抽都重算。
 *
 * 官方機率總和是 99.97% 不是 100%（四捨五入誤差）。做法是按實際權重正規化，
 * 不補一個 0.03% 的「什麼都沒有」——那 0.03% 是進位誤差，不是真的有空獎。
 */
export interface WeightedTable {
  prizes: Prize[];
  /** 累積權重，最後一項等於 total */
  cumulative: number[];
  total: number;
}

export function buildTable(pool: GachaPool): WeightedTable {
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

function record(state: GachaState, prize: Prize) {
  if (prize.itemId === null) return;
  state.counts.set(prize.itemId, (state.counts.get(prize.itemId) ?? 0) + 1);
  state.log.push(prize.itemId);
}

/**
 * 手動抽 1 次或 10 次並計價。
 *
 * 計價依實際操作：單抽用 ticket.single，10 連整包用 ticket.bundle10。
 */
export function pull(
  state: GachaState,
  pool: GachaPool,
  table: WeightedTable,
  n: 1 | 10,
  rng: () => number = Math.random,
): Prize[] {
  const got: Prize[] = [];
  for (let i = 0; i < n; i++) {
    const prize = drawOne(table, rng);
    record(state, prize);
    got.push(prize);
  }
  state.pulls += n;
  state.spent += n === 1 ? pool.ticket.single : pool.ticket.bundle10;
  return got;
}

// --- 目標判定 -----------------------------------------------------------

export interface GroupProgress {
  /** 這個條件涉及的 itemId（OR 關係） */
  any: number[];
  have: number;
  need: number;
  done: boolean;
}

export interface GoalProgress {
  done: boolean;
  groups: GroupProgress[];
  /** 已滿足的條件數 */
  cleared: number;
}

/**
 * 每個 group 是「`any` 裡任一 itemId 的持有量**加總** >= count」，
 * 全部 group 都滿足才算達成。神秘任務的第 7 個 group 是
 * `any: [六角水晶項鍊, 水女神的衣料]`，任一即可——這就是 OR 的實作。
 */
export function goalProgress(state: GachaState, goal: Goal): GoalProgress {
  const groups = goal.groups.map((g) => {
    const have = g.any.reduce((sum, id) => sum + (state.counts.get(id) ?? 0), 0);
    return { any: g.any, have, need: g.count, done: have >= g.count };
  });
  const cleared = groups.filter((g) => g.done).length;
  return { done: cleared === groups.length, groups, cleared };
}

// --- 自動模式 -----------------------------------------------------------

export interface AutoResult {
  /** 這一輪實際抽了幾次（可能被 PULL_CAP 截短） */
  pulls: number;
  /** 這一輪花了多少 */
  spent: number;
  /** 要求抽的次數；被 PULL_CAP 截短時會大於 pulls */
  requested: number;
  /** 這一輪抽到的 itemId 序列，UI 快轉播放用 */
  drawn: number[];
}

/**
 * 連抽 n 次。
 *
 * 計價按「理性購買」：滿 10 次用整包價，餘數用單抽價。
 * 這是同步純計算（1000 抽 <1ms）——**播放動畫是 UI 的事**，
 * 引擎一次算完回傳結果，UI 再把過程快轉播放出來。
 */
export function pullMany(
  state: GachaState,
  pool: GachaPool,
  table: WeightedTable,
  count: number,
  rng: () => number = Math.random,
): AutoResult {
  const requested = Math.max(0, Math.floor(count));
  const room = Math.max(0, PULL_CAP - state.pulls);
  const n = Math.min(requested, room);

  const startLog = state.log.length;
  for (let i = 0; i < n; i++) record(state, drawOne(table, rng));
  state.pulls += n;

  const spent =
    Math.floor(n / 10) * pool.ticket.bundle10 + (n % 10) * pool.ticket.single;
  state.spent += spent;

  return { pulls: n, spent, requested, drawn: state.log.slice(startLog) };
}

// --- 統計 ---------------------------------------------------------------

export interface TierCount {
  tier: Prize["tier"];
  /** 抽到幾個（含重複） */
  got: number;
  /** 這一層共有幾種道具 */
  kinds: number;
  /** 蒐集到幾種（不含重複） */
  collected: number;
}

export function tierCounts(state: GachaState, pool: GachaPool): TierCount[] {
  const byTier = new Map<Prize["tier"], { got: number; kinds: number; collected: number }>();
  for (const p of pool.prizes) {
    const e = byTier.get(p.tier) ?? { got: 0, kinds: 0, collected: 0 };
    e.kinds += 1;
    const n = p.itemId === null ? 0 : (state.counts.get(p.itemId) ?? 0);
    e.got += n;
    if (n > 0) e.collected += 1;
    byTier.set(p.tier, e);
  }
  return [...byTier].map(([tier, v]) => ({ tier, ...v }));
}
