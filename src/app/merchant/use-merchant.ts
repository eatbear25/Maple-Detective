"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { currentPool, prizeLabel } from "@/data/merchant";
import { useStored } from "@/app/fashion/storage";
import {
  AUTO_MAX,
  DEFAULT_AUTO_COUNT,
  RECORD_CAP,
  batchAt,
  buildTable,
  cloneState,
  emptyState,
  goalHitsAfter,
  refresh,
  refreshPrice,
  refreshUntil,
  type MerchantState,
} from "./engine";
import { setRecord, useRecord } from "./record";

const GOAL_KEY = "merchant-goal";
const AUTO_KEY = "merchant-auto-count";

/** 清空目標後幾毫秒內可以按「復原」（跟 BOSS 計時器一樣 8 秒） */
export const UNDO_MS = 8000;
/** 刷 N 次後那行摘要停留多久（淡出動畫在 globals.css 的 .merchant-flash，長度要對上） */
const FLASH_MS = 2600;

// useStored 的 fallback 要是固定的參照
const NO_GOAL = { pool: 0, keys: [] as number[] };

const parseCount = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= AUTO_MAX ? v : null;
/** 目標存的是 prize key（當期機率表的序號），所以要連同是哪一期一起存，換期就作廢 */
const parseGoal = (v: unknown) => {
  if (typeof v !== "object" || v === null) return null;
  const { pool, keys } = v as { pool?: unknown; keys?: unknown };
  if (typeof pool !== "number" || !Array.isArray(keys)) return null;
  if (!keys.every((k) => Number.isInteger(k))) return null;
  return { pool, keys: keys as number[] };
};

/** 「刷到集滿為止」的結果。彈窗顯示這一份，不跟著之後改目標變動。 */
export interface UntilResult {
  keys: number[];
  /** 按下去之前的紀錄，「再模擬一次」從這裡重刷 */
  before: MerchantState;
  done: boolean;
  /** 停在第幾批（集滿的那批，或刷到上限停下來的那批） */
  at: number;
  /** 每件第一次出現在第幾批，沒出現是 null */
  firsts: { key: number; batch: number | null }[];
}

/** 清空目標之前的清單，復原就是把它寫回去。重置紀錄不給復原（站長說不需要） */
interface Undo {
  id: number;
  keys: number[];
}

/** /merchant 的全部狀態與操作。版面在 merchant-client.tsx，純邏輯在 engine.ts。 */
export function useMerchant() {
  const pool = useMemo(() => currentPool(), []);
  const table = useMemo(() => buildTable(pool), [pool]);
  const state = useRecord(pool);

  /**
   * 目標只有一份：在機率表點星星挑的商品。2026-10-31 拿掉了內建的套組（裁決者等三組）——
   * 套組跟自訂兩份清單並存，星星到底在改哪一份講不清楚，而且每期都要手動維護套組名單。
   */
  const [goalStored, setGoalStored] = useStored(GOAL_KEY, NO_GOAL, parseGoal);
  const [autoCount, setAutoCount] = useStored(AUTO_KEY, DEFAULT_AUTO_COUNT, parseCount);

  /** 要播翻牌動畫的那一批（只有刷 1 次才播）。換成新的批數，舊的動畫就跟著被換掉 */
  const [flip, setFlip] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [result, setResult] = useState<UntilResult | null>(null);
  /** 給螢幕閱讀器念的：「第 213 批：裁決者白翼（目標）、黑冠…」 */
  const [live, setLive] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const goal = useMemo(
    () =>
      goalStored.pool === pool.eventAdId
        ? goalStored.keys.filter((k) => k >= 0 && k < pool.prizes.length)
        : [],
    [goalStored, pool],
  );
  const goalKeys = useMemo(() => new Set(goal), [goal]);
  const progress = useMemo(
    () => goal.map((key) => ({ key, batch: state.first.get(key) ?? null })),
    [goal, state.first],
  );
  const cleared = progress.filter((g) => g.batch !== null).length;
  const goalDone = goal.length > 0 && cleared === goal.length;
  /** 目標商品在整份紀錄裡一共出現幾格 */
  const goalAppearances = useMemo(
    () => goal.reduce((n, k) => n + (state.counts.get(k) ?? 0), 0),
    [goal, state.counts],
  );

  const shelf = useMemo(() => batchAt(state, pool, state.refreshes), [state, pool]);
  const full = state.refreshes >= RECORD_CAP;

  function setGoal(keys: number[]) {
    setGoalStored({ pool: pool.eventAdId, keys });
  }

  function announce(next: MerchantState) {
    const items = batchAt(next, pool, next.refreshes).map(
      (p) => `${prizeLabel(p)}${goalKeys.has(p.key) ? "（目標）" : ""}`,
    );
    setLive(`第 ${next.refreshes} 批：${items.join("、")}`);
  }

  function showFlash(text: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ id: Date.now(), text });
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }


  function refreshOne() {
    if (full) return;
    const next = cloneState(state);
    refresh(next, pool, table, 1);
    setRecord(pool, next);
    setFlip(next.refreshes);
    announce(next);
  }

  /** 刷 autoCount 次：一次算完，不逐批播動畫 */
  function refreshMany() {
    if (full) return;
    const from = state.refreshes;
    const next = cloneState(state);
    const got = refresh(next, pool, table, autoCount);
    setRecord(pool, next);
    setFlip(null);
    announce(next);
    const hits = goalHitsAfter(next, pool.slots, goalKeys, from);
    if (got < autoCount) showFlash(`紀錄到上限了，只刷了 ${got.toLocaleString()} 批`);
    else if (hits > 0) showFlash(`這 ${got.toLocaleString()} 批出現目標 ${hits} 件`);
  }

  function runUntil(before: MerchantState, keys: number[]) {
    const next = cloneState(before);
    const done = refreshUntil(next, pool, table, keys);
    setRecord(pool, next);
    setFlip(null);
    setResult({
      keys,
      before,
      done,
      at: next.refreshes,
      firsts: keys.map((key) => ({ key, batch: next.first.get(key) ?? null })),
    });
  }

  /** 接著目前的紀錄一直刷到目標集滿，跳結果彈窗 */
  function refreshUntilDone() {
    if (full || goal.length === 0 || goalDone) return;
    runUntil(state, goal);
  }

  function rerun() {
    if (result) runUntil(result.before, result.keys);
  }

  function reset() {
    if (state.refreshes === 0) return;
    setRecord(pool, emptyState());
    setFlip(null);
    setFlash(null);
    setResult(null);
    setLive("已重置紀錄");
  }

  function toggleStar(key: number) {
    setGoal(goal.includes(key) ? goal.filter((k) => k !== key) : [...goal, key]);
  }

  function clearGoal() {
    if (goal.length === 0) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id: Date.now(), keys: goal });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    setGoal([]);
  }

  function undoClear() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setGoal(undo.keys);
    setUndo(null);
  }

  return {
    pool,
    state,
    shelf,
    full,
    goal,
    goalKeys,
    progress,
    cleared,
    goalDone,
    goalAppearances,
    toggleStar,
    clearGoal,
    autoCount,
    setAutoCount,
    spent: refreshPrice(state.refreshes, pool.ticket),
    flip,
    flash,
    live,
    undo,
    undoClear,
    result,
    closeResult: () => setResult(null),
    rerun,
    refreshOne,
    refreshMany,
    refreshUntilDone,
    reset,
  };
}

export type MerchantCtx = ReturnType<typeof useMerchant>;
