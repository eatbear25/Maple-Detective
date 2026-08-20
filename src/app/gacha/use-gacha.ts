"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { currentPool, type Goal, type Prize } from "@/data/gacha";
import {
  DEFAULT_AUTO_COUNT,
  buildTable,
  cloneState,
  emptyState,
  goalProgress,
  pull,
  pullMany,
  tierCounts,
  type AutoResult,
  type GachaState,
} from "./engine";

/** 自動模式快轉播放的長度（毫秒）。不要瞬間出結果——重點是讓人感受到抽數與金額的重量。 */
const PLAYBACK_MS = 3500;

export const CUSTOM_GOAL_ID = "__custom__";

/** 一次連抽 n 次的價錢：滿 10 次用整包價，餘數用單抽價。 */
function priceOf(n: number, single: number, bundle10: number) {
  return Math.floor(n / 10) * bundle10 + (n % 10) * single;
}

/** /gacha 的全部狀態與操作。版面在 page.tsx，純邏輯在 engine.ts。 */
export function useGacha() {
  const pool = useMemo(() => currentPool(), []);
  const table = useMemo(() => buildTable(pool), [pool]);
  const prizeById = useMemo(() => {
    const m = new Map<number, Prize>();
    for (const p of pool.prizes) if (p.itemId !== null) m.set(p.itemId, p);
    return m;
  }, [pool]);

  // 純 session：重整即歸零，不寫 localStorage。
  const [state, setState] = useState<GachaState>(emptyState);
  const [reveal, setReveal] = useState<Prize[]>([]);
  const [revealSeq, setRevealSeq] = useState(0);
  const [autoCount, setAutoCount] = useState(DEFAULT_AUTO_COUNT);
  const [goalId, setGoalId] = useState(pool.goals[0]?.id ?? CUSTOM_GOAL_ID);
  const [custom, setCustom] = useState<Map<number, number>>(new Map());
  const [result, setResult] = useState<AutoResult | null>(null);
  const [playback, setPlayback] = useState<{
    total: number;
    shown: number;
    /** 這一輪連抽的總花費，用來回推「播到第 k 抽時花了多少」 */
    runSpent: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);
  const stopRef = useRef(false);

  const goal: Goal = useMemo(() => {
    const built = pool.goals.find((g) => g.id === goalId);
    if (built) return built;
    return {
      id: CUSTOM_GOAL_ID,
      label: "自訂目標",
      reward: null,
      groups: [...custom]
        .filter(([, n]) => n > 0)
        .map(([itemId, n]) => ({ any: [itemId], count: n })),
    };
  }, [pool.goals, goalId, custom]);

  /** 播放中把還沒播到的那截從尾端扣掉，播完就等於真實 state。 */
  const view = useMemo(() => {
    if (!playback) return { pulls: state.pulls, spent: state.spent, counts: state.counts };
    const hidden = playback.total - playback.shown;
    const counts = new Map(state.counts);
    for (let i = state.log.length - hidden; i < state.log.length; i++) {
      const id = state.log[i];
      const n = (counts.get(id) ?? 0) - 1;
      if (n <= 0) counts.delete(id);
      else counts.set(id, n);
    }
    return {
      pulls: state.pulls - hidden,
      spent:
        state.spent -
        playback.runSpent +
        priceOf(playback.shown, pool.ticket.single, pool.ticket.bundle10),
      counts,
    };
  }, [playback, state, pool.ticket.single, pool.ticket.bundle10]);

  const viewState: GachaState = useMemo(
    () => ({ pulls: view.pulls, spent: view.spent, counts: view.counts, log: [] }),
    [view],
  );
  const progress = useMemo(() => goalProgress(viewState, goal), [viewState, goal]);
  const tiers = useMemo(() => tierCounts(viewState, pool), [viewState, pool]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function handlePull(n: 1 | 10) {
    const next = cloneState(state);
    const got = pull(next, pool, table, n);
    setState(next);
    setReveal(got);
    setRevealSeq((s) => s + 1);
  }

  /** 連抽 autoCount 次。 */
  function handleAuto() {
    if (autoCount < 1) return;
    setReveal([]);
    setResult(null);
    stopRef.current = false;

    // 引擎一次算完（1000 抽 <1ms），下面的 raf 只負責把過程快轉播放出來
    const next = cloneState(state);
    const r = pullMany(next, pool, table, autoCount);
    setState(next);
    if (r.pulls === 0) {
      setResult(r);
      return;
    }

    setPlayback({ total: r.pulls, shown: 0, runSpent: r.spent });
    const start = performance.now();
    const step = (now: number) => {
      if (stopRef.current) {
        setPlayback(null);
        setResult(r);
        return;
      }
      const t = Math.min(1, (now - start) / PLAYBACK_MS);
      setPlayback({ total: r.pulls, shown: Math.round(t * r.pulls), runSpent: r.spent });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setPlayback(null);
        setResult(r);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function handleReset() {
    stopRef.current = true;
    setState(emptyState());
    setReveal([]);
    setResult(null);
    setPlayback(null);
  }

  return {
    pool,
    prizeById,
    state,
    view,
    goal,
    goalId,
    setGoalId,
    custom,
    setCustom,
    autoCount,
    setAutoCount,
    progress,
    tiers,
    reveal,
    revealSeq,
    result,
    setResult,
    spinning: playback !== null,
    playbackShown: playback?.shown ?? 0,
    playbackTotal: playback?.total ?? 0,
    handlePull,
    handleAuto,
    handleReset,
    stopAuto: () => {
      stopRef.current = true;
    },
  };
}

export type GachaCtx = ReturnType<typeof useGacha>;
