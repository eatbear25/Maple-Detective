"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { currentPool, type Goal, type Prize } from "@/data/merchant";
import {
  DEFAULT_AUTO_COUNT,
  buildTable,
  categoryCounts,
  cloneState,
  emptyState,
  goalProgress,
  refreshMany,
  refreshOnce,
  refreshPrice,
  type AutoResult,
  type MerchantState,
} from "./engine";

/** 連續刷新快轉播放的長度（毫秒）。不要瞬間出結果——重點是讓人感受到次數與金額的重量。 */
const PLAYBACK_MS = 3500;

export const CUSTOM_GOAL_ID = "__custom__";

/** /merchant 的全部狀態與操作。版面在 merchant-client.tsx，純邏輯在 engine.ts。 */
export function useMerchant() {
  const pool = useMemo(() => currentPool(), []);
  const table = useMemo(() => buildTable(pool), [pool]);

  // 純 session：重整即歸零，不寫 localStorage。
  const [state, setState] = useState<MerchantState>(emptyState);
  const [reveal, setReveal] = useState<Prize[]>([]);
  const [revealSeq, setRevealSeq] = useState(0);
  const [autoCount, setAutoCount] = useState(DEFAULT_AUTO_COUNT);
  const [goalId, setGoalId] = useState(pool.goals[0]?.id ?? CUSTOM_GOAL_ID);
  const [custom, setCustom] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<AutoResult | null>(null);
  const [playback, setPlayback] = useState<{
    total: number;
    shown: number;
    /** 這一輪的總花費，用來回推「播到第 k 次時花了多少」 */
    runSpent: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);
  const stopRef = useRef(false);

  const goal: Goal = useMemo(
    () =>
      pool.goals.find((g) => g.id === goalId) ?? {
        id: CUSTOM_GOAL_ID,
        label: "自訂目標",
        keys: [...custom],
      },
    [pool.goals, goalId, custom],
  );

  /** 播放中把還沒播到的那截從尾端扣掉，播完就等於真實 state。 */
  const view = useMemo(() => {
    if (!playback) return { refreshes: state.refreshes, spent: state.spent, counts: state.counts };
    const hidden = (playback.total - playback.shown) * pool.slots;
    const counts = new Map(state.counts);
    for (let i = state.log.length - hidden; i < state.log.length; i++) {
      const k = state.log[i];
      const n = (counts.get(k) ?? 0) - 1;
      if (n <= 0) counts.delete(k);
      else counts.set(k, n);
    }
    return {
      refreshes: state.refreshes - (playback.total - playback.shown),
      spent: state.spent - playback.runSpent + refreshPrice(playback.shown, pool.ticket),
      counts,
    };
  }, [playback, state, pool.slots, pool.ticket]);

  /** 貨架上現在擺的那一批。播放中跟著快轉，平常是最後一次刷新的結果。 */
  const shelf: Prize[] = useMemo(() => {
    if (!playback) return reveal;
    if (view.refreshes === 0) return [];
    const end = view.refreshes * pool.slots;
    return state.log.slice(end - pool.slots, end).map((k) => pool.prizes[k]);
  }, [playback, reveal, view.refreshes, state.log, pool]);

  const progress = useMemo(() => goalProgress(view.counts, goal), [view.counts, goal]);
  const categories = useMemo(() => categoryCounts(view.counts, pool), [view.counts, pool]);
  const goalKeys = useMemo(() => new Set(goal.keys), [goal]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function handleRefresh() {
    const next = cloneState(state);
    const got = refreshOnce(next, pool, table);
    setState(next);
    setReveal(got);
    setRevealSeq((s) => s + 1);
  }

  /** 連續刷新 autoCount 次。 */
  function handleAuto() {
    if (autoCount < 1) return;
    setResult(null);
    stopRef.current = false;

    // 引擎一次算完，下面的 raf 只負責把過程快轉播放出來
    const next = cloneState(state);
    const r = refreshMany(next, pool, table, autoCount, goal);
    setState(next);
    if (r.refreshes === 0) {
      setResult(r);
      return;
    }

    const finish = () => {
      setPlayback(null);
      setReveal(next.log.slice(-pool.slots).map((k) => pool.prizes[k]));
      setRevealSeq((s) => s + 1);
      setResult(r);
    };
    setPlayback({ total: r.refreshes, shown: 0, runSpent: r.spent });
    const start = performance.now();
    const step = (now: number) => {
      if (stopRef.current) return finish();
      const t = Math.min(1, (now - start) / PLAYBACK_MS);
      setPlayback({ total: r.refreshes, shown: Math.round(t * r.refreshes), runSpent: r.spent });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else finish();
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function handleReset() {
    stopRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setState(emptyState());
    setReveal([]);
    setResult(null);
    setPlayback(null);
  }

  function toggleCustom(key: number) {
    const next = new Set(custom);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCustom(next);
  }

  return {
    pool,
    state,
    view,
    goal,
    goalId,
    setGoalId,
    goalKeys,
    custom,
    toggleCustom,
    autoCount,
    setAutoCount,
    progress,
    categories,
    shelf,
    revealSeq,
    result,
    setResult,
    spinning: playback !== null,
    playbackShown: playback?.shown ?? 0,
    playbackTotal: playback?.total ?? 0,
    handleRefresh,
    handleAuto,
    handleReset,
    stopAuto: () => {
      stopRef.current = true;
    },
  };
}

export type MerchantCtx = ReturnType<typeof useMerchant>;
