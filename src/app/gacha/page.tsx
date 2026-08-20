"use client";

/*
 * /gacha 轉蛋模擬。
 *
 * 版面（2026-08-20 由 ?variant= 原型三選一定案，選中「遊戲視窗雙欄」）：
 *   遊戲視窗（左機台 / 右結果盤）→ 目標設定 → 統計面板 → 官方機率表
 *
 * 遊戲視窗保留原版的外框印象，但結果盤放在機台**右邊**、做成固定的 5×2 格位：
 * 結果不會擠在機台下方，也不會因為單抽/十連的數量差異而讓版面跳高。
 * 只有這一區是遊戲風，以下都是站內簡約風——上面是爽度、下面是真相。
 *
 * 邏輯在 engine.ts（純函式）與 use-gacha.ts（狀態），這裡只負責版面。
 */

import { useEffect, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import {
  GACHA_MACHINE_ICON,
  TIER_META,
  TIER_ORDER,
  poolPeriod,
  type Prize,
} from "@/data/gacha";
import { EmptySlot, PrizeTile } from "./prize-tile";
import { CUSTOM_GOAL_ID, useGacha, type GachaCtx } from "./use-gacha";
import {
  AutoCountInput,
  CustomPicker,
  GoalDots,
  ResultModal,
  useCollected,
  useOddsSearch,
} from "./parts";

/** 結果盤格位數＝一次十連的上限 */
const SLOTS = 10;

export default function GachaPage() {
  const ctx = useGacha();
  return (
    <>
      <GachaView ctx={ctx} />
      {ctx.result && <ResultModal ctx={ctx} onClose={() => ctx.setResult(null)} />}
    </>
  );
}

function GachaView({ ctx }: { ctx: GachaCtx }) {
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [oddsOpen, setOddsOpen] = useState(false);
  const collected = useCollected(ctx);
  const odds = useOddsSearch(ctx);
  const isCustom = ctx.goalId === CUSTOM_GOAL_ID;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-5">
      <Header ctx={ctx} />

      {/* 遊戲視窗：左機台 / 右結果盤 */}
      <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-slate-300 shadow-lg dark:border-slate-600 dark:bg-slate-700">
        <header className="flex items-center justify-between border-b-2 border-slate-400 bg-gradient-to-b from-slate-50 to-slate-200 px-3 py-1.5 dark:border-slate-600 dark:from-slate-600 dark:to-slate-700">
          <span className="text-sm font-black tracking-wide text-slate-800 dark:text-slate-50">
            轉蛋機
          </span>
          <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-sky-600 text-[0.6rem] font-bold text-white">
            ✕
          </span>
        </header>

        <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
          {/* 機台 */}
          <div
            className="relative grid place-items-center rounded-lg border border-amber-300/70 py-4"
            style={{
              background:
                "radial-gradient(circle at 50% 42%, #fff8e1 0%, #ffe9a8 55%, #f5cf72 100%)",
            }}
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-lg opacity-70 ${ctx.spinning ? "animate-spin-slow" : ""}`}
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 42%, rgba(255,196,60,0.55) 0deg 7deg, rgba(255,255,255,0) 7deg 22deg)",
                maskImage: "radial-gradient(circle at 50% 42%, #000 30%, transparent 70%)",
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 42%, #000 30%, transparent 70%)",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- 像素圖 */}
            <img
              src={GACHA_MACHINE_ICON}
              alt="轉蛋機"
              className={`relative h-32 w-auto drop-shadow-md sm:h-36 ${ctx.spinning ? "animate-machine-shake" : ""}`}
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          {/* 結果盤：固定 5×2，不會因為換行跳版 */}
          <div className="rounded-lg border border-slate-500/40 bg-slate-800 p-2.5">
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
              {ctx.spinning
                ? `自動抽 ${ctx.playbackShown} / ${ctx.playbackTotal}`
                : ctx.reveal.length > 0
                  ? "本次結果"
                  : "結果"}
            </p>
            {/* 固定 5 欄 × 44px：欄寬寫死，填入的格子才不會被拉伸成整欄寬而跟空格錯位 */}
            <div className="mx-auto grid w-fit grid-cols-[repeat(5,2.75rem)] gap-2">
              {Array.from({ length: SLOTS }).map((_, i) => {
                const p: Prize | undefined = ctx.reveal[i];
                return p ? (
                  <FlipSlot key={`${ctx.revealSeq}-${i}`} prize={p} delay={i * 70} />
                ) : (
                  <EmptySlot key={`e-${i}`} size={44} tone="dark" />
                );
              })}
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t-2 border-slate-400 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              已抽 <span className="text-amber-600 dark:text-amber-400">{ctx.view.pulls}</span> 次
              <span className="mx-1.5 opacity-30">・</span>
              <span className="text-rose-600 dark:text-rose-400">
                NT${ctx.view.spent.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={ctx.handleReset}
                disabled={ctx.spinning || ctx.view.pulls === 0}
                className="ml-2 inline-flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700"
              >
                <RotateCcw size={11} /> 重置
              </button>
            </p>
            <Buttons ctx={ctx} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-300 pt-2 text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <AutoCountInput ctx={ctx} tone="light" />
          </div>
        </footer>
      </section>

      {/* 目標 */}
      <section className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">目標</span>
          <GoalChips ctx={ctx} onCustom={() => setPicking(true)} />
        </div>
        {!isCustom && ctx.goal.reward === null && (
          <p className="mb-2 text-xs text-slate-500">
            獎勵內容：<span className="font-bold">未公開</span>
          </p>
        )}
        <GoalDots ctx={ctx} tone="light" />
        {isCustom && picking && (
          <CustomPicker ctx={ctx} tone="light" onClose={() => setPicking(false)} />
        )}
      </section>

      {/* 統計 */}
      <section className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-bold">統計</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="已抽" value={ctx.view.pulls.toLocaleString()} />
          <Stat label="花費" value={`NT$${ctx.view.spent.toLocaleString()}`} />
          <Stat
            label="目標進度"
            value={
              ctx.goal.groups.length
                ? `${ctx.progress.cleared}/${ctx.goal.groups.length}`
                : "—"
            }
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TIER_ORDER.map((t) => {
            const row = ctx.tiers.find((x) => x.tier === t);
            if (!row) return null;
            return (
              <span
                key={t}
                className="rounded-full px-2 py-0.5 text-[0.7rem] font-bold text-white"
                style={{ background: TIER_META[t].deep }}
              >
                {TIER_META[t].short} {row.got}
                <span className="opacity-70">
                  {" "}
                  ({row.collected}/{row.kinds})
                </span>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold opacity-70 hover:opacity-100"
        >
          <ChevronDown size={13} className={listOpen ? "rotate-180" : ""} />
          完整獲得清單（{collected.length} 種）
        </button>
        {listOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {collected.length === 0 ? (
              <p className="text-xs opacity-50">還沒抽到任何東西。</p>
            ) : (
              collected.map(({ prize, n }) => (
                <PrizeTile key={prize.name} prize={prize} size={40} count={n} />
              ))
            )}
          </div>
        )}
      </section>

      {/* 官方機率表 */}
      <section className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setOddsOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between"
        >
          <span className="text-sm font-bold">
            官方機率表
            <span className="ml-2 text-xs font-normal opacity-60">
              {ctx.pool.prizes.length} 筆
            </span>
          </span>
          <ChevronDown size={15} className={oddsOpen ? "rotate-180" : ""} />
        </button>
        <p className="mt-0.5 text-[0.7rem] opacity-50">
          活動期間 {poolPeriod(ctx.pool)}・{ctx.pool.capturedAt} 擷取
        </p>
        {oddsOpen && (
          <>
            <input
              value={odds.q}
              onChange={(e) => odds.setQ(e.target.value)}
              placeholder="搜尋道具名稱"
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-amber-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <div className="mt-2 space-y-3">
              {TIER_ORDER.filter((t) => odds.byTier.has(t)).map((t) => (
                <div key={t}>
                  <p
                    className="mb-1 text-[0.7rem] font-bold"
                    style={{ color: TIER_META[t].color }}
                  >
                    {TIER_META[t].label}
                  </p>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(odds.byTier.get(t) ?? []).map((p) => {
                      const n = p.itemId === null ? 0 : (ctx.view.counts.get(p.itemId) ?? 0);
                      return (
                        <li key={p.name} className="flex items-center gap-2 py-1">
                          <PrizeTile prize={p} size={28} dimmed={n === 0} />
                          <span className="flex-1 truncate text-xs">{p.name}</span>
                          {n > 0 && (
                            <span className="text-[0.7rem] font-bold text-emerald-600">
                              ×{n}
                            </span>
                          )}
                          <span className="w-14 text-right text-xs tabular-nums opacity-60">
                            {p.rate.toFixed(2)}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Header({ ctx }: { ctx: GachaCtx }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-xl font-black">轉蛋模擬</h1>
      <p className="text-xs opacity-60">
        {ctx.pool.title}
        <span className="mx-1.5 opacity-40">・</span>
        活動期間 {poolPeriod(ctx.pool)}
      </p>
    </header>
  );
}

function GoalChips({ ctx, onCustom }: { ctx: GachaCtx; onCustom: () => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ctx.pool.goals.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => ctx.setGoalId(g.id)}
          className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
            ctx.goalId === g.id
              ? "bg-amber-500 text-white"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
          }`}
        >
          {g.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          ctx.setGoalId(CUSTOM_GOAL_ID);
          onCustom();
        }}
        className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
          ctx.goalId === CUSTOM_GOAL_ID
            ? "bg-amber-500 text-white"
            : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
        }`}
      >
        自訂
      </button>
    </div>
  );
}

function Buttons({ ctx }: { ctx: GachaCtx }) {
  const base =
    "cursor-pointer rounded border-b-2 px-3 py-1 text-xs font-black shadow-sm transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";
  if (ctx.spinning) {
    return (
      <button
        type="button"
        onClick={ctx.stopAuto}
        className={`${base} border-rose-900 bg-rose-600 text-white hover:bg-rose-500`}
      >
        停止
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => ctx.handlePull(1)}
        className={`${base} border-lime-800 bg-lime-600 text-white hover:bg-lime-500`}
      >
        抽 1 次
      </button>
      <button
        type="button"
        onClick={() => ctx.handlePull(10)}
        className={`${base} border-lime-800 bg-lime-600 text-white hover:bg-lime-500`}
      >
        抽 10 次
      </button>
      <button
        type="button"
        onClick={ctx.handleAuto}
        className={`${base} border-amber-800 bg-amber-500 text-white hover:bg-amber-400`}
      >
        連抽 {ctx.autoCount.toLocaleString()} 次
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 px-2 py-1.5 dark:bg-slate-800">
      <p className="text-[0.65rem] opacity-60">{label}</p>
      <p className="text-base font-black tabular-nums">{value}</p>
    </div>
  );
}

/** key 帶 revealSeq，每次抽卡都是新實例，所以 effect 只需要設一次計時器。 */
function FlipSlot({ prize, delay }: { prize: Prize; delay: number }) {
  const [open, setOpen] = useState(false);
  const meta = TIER_META[prize.tier];
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delay + 180);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <span
      className="grid h-11 w-11 place-items-center rounded-md transition-all duration-200"
      style={{ boxShadow: open ? meta.glow : "none" }}
    >
      {open ? (
        <PrizeTile prize={prize} size={44} tone="dark" />
      ) : (
        <span className="h-11 w-11 rounded-md bg-slate-600" />
      )}
    </span>
  );
}
