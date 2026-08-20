"use client";

/* 變體 C —「圖鑑優先」
   反過來想：這頁真正在回答的問題是「我要抽到什麼時候」，
   所以主體不是機台而是**101 格的收集表**——一開始整片是暗的，抽到就亮起來。
   機台縮成黏性工具列裡的縮圖，操作永遠在手邊、不用捲回頂端。
   沒有翻卡動畫；新抽到的格子直接在表上閃一下，結果與進度是同一個畫面。 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { GACHA_MACHINE_ICON, TIER_META, TIER_ORDER, poolPeriod } from "@/data/gacha";
import { PrizeTile } from "../prize-tile";
import type { GachaCtx } from "../use-gacha";
import { CUSTOM_GOAL_ID } from "../use-gacha";
import { BudgetInput, CustomPicker, useOddsSearch } from "./shared";

export const NAME = "圖鑑優先";

export function VariantC({ ctx }: { ctx: GachaCtx }) {
  const [picking, setPicking] = useState(false);
  const [onlyGot, setOnlyGot] = useState(false);
  const odds = useOddsSearch(ctx);

  // 剛抽到的那幾格閃一下
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const lastLen = useRef(0);
  useEffect(() => {
    const added = ctx.state.log.slice(lastLen.current);
    lastLen.current = ctx.state.log.length;
    if (added.length === 0) return;
    setFlash(new Set(added));
    const t = setTimeout(() => setFlash(new Set()), 900);
    return () => clearTimeout(t);
  }, [ctx.state.log]);

  const goalIds = useMemo(
    () => new Set(ctx.goal.groups.flatMap((g) => g.any)),
    [ctx.goal],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 pb-8 pt-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-black">轉蛋模擬</h1>
        <p className="text-xs opacity-60">
          {ctx.pool.title}
          <span className="mx-1.5 opacity-40">・</span>
          活動期間 {poolPeriod(ctx.pool)}・{ctx.pool.capturedAt} 擷取
        </p>
      </header>

      {/* 黏性工具列：機台縮圖 + 數字 + 操作，永遠在手邊 */}
      <div className="sticky top-0 z-30 -mx-3 border-y border-slate-300 bg-white/95 px-3 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- 像素圖 */}
          <img
            src={GACHA_MACHINE_ICON}
            alt="轉蛋機"
            className={`h-12 w-auto shrink-0 ${ctx.spinning ? "animate-machine-shake" : ""}`}
            style={{ imageRendering: "pixelated" }}
          />
          <div className="min-w-[7rem]">
            <p className="text-[0.65rem] opacity-60">已抽・花費</p>
            <p className="text-sm font-black tabular-nums">
              <span className="text-amber-600 dark:text-amber-400">{ctx.view.pulls}</span>
              <span className="mx-1 opacity-30">・</span>
              <span className="text-rose-600 dark:text-rose-400">
                NT${ctx.view.spent.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {ctx.spinning ? (
              <>
                <span className="text-xs font-bold tabular-nums opacity-70">
                  {ctx.playbackShown}/{ctx.playbackTotal}
                </span>
                <Btn onClick={ctx.stopAuto} kind="stop">
                  停止
                </Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => ctx.handlePull(1)}>×1</Btn>
                <Btn onClick={() => ctx.handlePull(10)}>×10</Btn>
                <Btn onClick={ctx.handleAuto} kind="accent">
                  自動
                </Btn>
              </>
            )}
          </div>
        </div>

        {/* 目標條：橫的一條，不佔高度 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.7rem] font-bold opacity-60">目標</span>
          {ctx.pool.goals.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => ctx.setGoalId(g.id)}
              className={`rounded px-2 py-0.5 text-[0.7rem] font-bold ${
                ctx.goalId === g.id
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              {g.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              ctx.setGoalId(CUSTOM_GOAL_ID);
              setPicking((v) => !v);
            }}
            className={`rounded px-2 py-0.5 text-[0.7rem] font-bold ${
              ctx.goalId === CUSTOM_GOAL_ID
                ? "bg-amber-500 text-white"
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          >
            自訂
          </button>

          <span className="flex items-center gap-1">
            {ctx.progress.groups.map((g, i) => (
              <span
                key={i}
                title={`${ctx.prizeById.get(g.any[0])?.name ?? ""} ${Math.min(g.have, g.need)}/${g.need}`}
                className={`h-2.5 w-2.5 rounded-full ${
                  g.done ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              />
            ))}
            {ctx.goal.groups.length > 0 && (
              <span className="ml-0.5 text-[0.7rem] font-bold tabular-nums opacity-70">
                {ctx.progress.cleared}/{ctx.goal.groups.length}
              </span>
            )}
          </span>

          <span className="ml-auto">
            <BudgetInput ctx={ctx} tone="light" />
          </span>
        </div>
      </div>

      {ctx.goalId === CUSTOM_GOAL_ID && picking && (
        <CustomPicker ctx={ctx} tone="light" onClose={() => setPicking(false)} />
      )}

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40"
          />
          <input
            value={odds.q}
            onChange={(e) => odds.setQ(e.target.value)}
            placeholder="搜尋道具"
            className="w-44 rounded-full border border-slate-300 bg-white py-1 pl-7 pr-2 text-xs outline-none focus:border-amber-500 dark:border-slate-600 dark:bg-slate-800"
          />
        </span>
        <button
          type="button"
          onClick={() => setOnlyGot((v) => !v)}
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            onlyGot ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"
          }`}
        >
          只看抽到的
        </button>
        <span className="text-xs opacity-60">
          收集 {ctx.tiers.reduce((s, t) => s + t.collected, 0)}/{ctx.pool.prizes.length} 種
        </span>
        <button
          type="button"
          onClick={ctx.handleReset}
          className="ml-auto inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100"
        >
          <RotateCcw size={12} /> 重置
        </button>
      </div>

      {/* 主體：101 格收集表 */}
      {TIER_ORDER.filter((t) => odds.byTier.has(t)).map((t) => {
        const meta = TIER_META[t];
        const list = (odds.byTier.get(t) ?? []).filter((p) => {
          if (!onlyGot) return true;
          return p.itemId !== null && (ctx.view.counts.get(p.itemId) ?? 0) > 0;
        });
        if (list.length === 0) return null;
        const row = ctx.tiers.find((x) => x.tier === t);
        return (
          <section key={t}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[0.7rem] font-black text-white"
                style={{ background: meta.deep }}
              >
                {meta.label}
              </span>
              <span className="text-[0.7rem] opacity-55">
                各 {list[0].rate.toFixed(2)}%
                {row && ` ・ ${row.collected}/${row.kinds} 種 ・ 共 ${row.got} 個`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((p) => {
                const n = p.itemId === null ? 0 : (ctx.view.counts.get(p.itemId) ?? 0);
                const isGoal = p.itemId !== null && goalIds.has(p.itemId);
                const isFlash = p.itemId !== null && flash.has(p.itemId);
                return (
                  <span
                    key={p.name}
                    className="relative rounded-md transition-all duration-300"
                    style={{
                      boxShadow: isFlash
                        ? meta.glow === "none"
                          ? `0 0 0 3px ${meta.color}`
                          : meta.glow
                        : isGoal
                          ? `0 0 0 2px ${n > 0 ? "#10b981" : meta.color}`
                          : "none",
                    }}
                  >
                    <PrizeTile prize={p} size={44} count={n} dimmed={n === 0} />
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Btn({
  children,
  onClick,
  kind,
}: {
  children: React.ReactNode;
  onClick: () => void;
  kind?: "accent" | "stop";
}) {
  const cls =
    kind === "accent"
      ? "bg-amber-500 text-white hover:bg-amber-400"
      : kind === "stop"
        ? "bg-rose-600 text-white hover:bg-rose-500"
        : "bg-lime-600 text-white hover:bg-lime-500";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-black transition active:translate-y-px ${cls}`}
    >
      {children}
    </button>
  );
}
