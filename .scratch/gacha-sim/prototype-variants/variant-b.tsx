"use client";

/* 變體 B —「深色 HUD」
   丟掉遊戲視窗外框。整頁深色，數字用大字級當主角（這是一個關於「你花了多少」的工具）。
   結果不做格位盤，改成一條**橫向履帶**：最新的一筆從右邊推進來，舊的往左推出去，
   所以十連或自動抽都不會改變版面高度。目標做成頂部的 7 顆進度燈。 */

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { GACHA_MACHINE_ICON, TIER_META, TIER_ORDER, poolPeriod } from "@/data/gacha";
import { PrizeTile } from "../prize-tile";
import type { GachaCtx } from "../use-gacha";
import { CUSTOM_GOAL_ID } from "../use-gacha";
import { BudgetInput, CustomPicker, useCollected, useOddsSearch } from "./shared";

export const NAME = "深色 HUD";

const BELT = 24;

export function VariantB({ ctx }: { ctx: GachaCtx }) {
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState<"collected" | "odds">("collected");
  const collected = useCollected(ctx);
  const odds = useOddsSearch(ctx);
  const beltRef = useRef<HTMLDivElement>(null);

  // 履帶：state.log 的尾端 N 筆
  const belt = ctx.state.log.slice(-BELT).reverse();

  useEffect(() => {
    beltRef.current?.scrollTo({ left: 0 });
  }, [ctx.state.log.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-black">轉蛋模擬</h1>
          <p className="text-xs text-slate-400">
            {ctx.pool.title}
            <span className="mx-1.5 opacity-40">・</span>
            {poolPeriod(ctx.pool)}
          </p>
        </header>

        {/* HUD：數字當主角 */}
        <section className="grid grid-cols-3 gap-2">
          <Hud label="已抽" value={ctx.view.pulls.toLocaleString()} accent="#fbbf24" />
          <Hud
            label="花費"
            value={`NT$${ctx.view.spent.toLocaleString()}`}
            accent="#fb7185"
          />
          <Hud
            label="目標"
            value={
              ctx.goal.groups.length
                ? `${ctx.progress.cleared}/${ctx.goal.groups.length}`
                : "—"
            }
            accent="#34d399"
          />
        </section>

        {/* 目標進度燈 */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              目標
            </span>
            <div className="flex gap-1">
              {ctx.pool.goals.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => ctx.setGoalId(g.id)}
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    ctx.goalId === g.id
                      ? "bg-amber-400 text-slate-950"
                      : "bg-white/10 text-slate-300 hover:bg-white/20"
                  }`}
                >
                  {g.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  ctx.setGoalId(CUSTOM_GOAL_ID);
                  setPicking(true);
                }}
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  ctx.goalId === CUSTOM_GOAL_ID
                    ? "bg-amber-400 text-slate-950"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                自訂
              </button>
            </div>
            <span className="ml-auto">
              <BudgetInput ctx={ctx} tone="dark" />
            </span>
          </div>

          {ctx.goal.groups.length === 0 ? (
            <p className="text-xs text-slate-500">尚未選擇任何道具。</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {ctx.progress.groups.map((g, i) => {
                const p = ctx.prizeById.get(g.any[0]);
                if (!p) return null;
                const c = TIER_META[p.tier];
                return (
                  <span
                    key={i}
                    title={`${p.name} ${Math.min(g.have, g.need)}/${g.need}`}
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[0.62rem] font-black transition"
                    style={{
                      background: g.done ? c.deep : "rgba(255,255,255,0.06)",
                      color: g.done ? "#fff" : "rgba(255,255,255,0.35)",
                      boxShadow: g.done ? `0 0 12px 2px ${c.color}66` : "none",
                    }}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                );
              })}
              {ctx.goal.reward === null && ctx.goalId !== CUSTOM_GOAL_ID && (
                <span className="ml-1 text-[0.7rem] text-slate-500">獎勵未公開</span>
              )}
            </div>
          )}
          {ctx.goalId === CUSTOM_GOAL_ID && picking && (
            <CustomPicker ctx={ctx} tone="dark" onClose={() => setPicking(false)} />
          )}
        </section>

        {/* 機台 + 操作 */}
        <section className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-6 h-44 w-44 -translate-x-1/2 rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle,#f59e0b55,transparent 70%)" }}
          />
          <div className="relative flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- 像素圖 */}
            <img
              src={GACHA_MACHINE_ICON}
              alt="轉蛋機"
              className={`h-36 w-auto ${ctx.spinning ? "animate-machine-shake" : ""}`}
              style={{ imageRendering: "pixelated" }}
            />
            {ctx.spinning ? (
              <>
                <p className="text-sm font-black tabular-nums text-amber-300">
                  {ctx.playbackShown} / {ctx.playbackTotal}
                </p>
                <button
                  type="button"
                  onClick={ctx.stopAuto}
                  className="rounded-full bg-rose-600 px-6 py-2 text-sm font-black text-white hover:bg-rose-500"
                >
                  停止
                </button>
              </>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <BigBtn onClick={() => ctx.handlePull(1)}>
                  抽 1 次
                  <em className="block text-[0.65rem] font-medium not-italic opacity-70">
                    NT${ctx.pool.ticket.single}
                  </em>
                </BigBtn>
                <BigBtn onClick={() => ctx.handlePull(10)}>
                  抽 10 次
                  <em className="block text-[0.65rem] font-medium not-italic opacity-70">
                    NT${ctx.pool.ticket.bundle10}
                  </em>
                </BigBtn>
                <BigBtn onClick={ctx.handleAuto} accent>
                  自動抽
                  <em className="block text-[0.65rem] font-medium not-italic opacity-80">
                    到 NT${ctx.budget.toLocaleString()}
                  </em>
                </BigBtn>
              </div>
            )}
          </div>
        </section>

        {/* 履帶：最新在最左，往右是舊的。高度固定，永遠不跳版。 */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
          <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
            最近 {BELT} 抽
          </p>
          <div ref={beltRef} className="flex gap-1.5 overflow-x-auto pb-1">
            {belt.length === 0 ? (
              <p className="py-3 text-xs text-slate-600">還沒抽過。</p>
            ) : (
              belt.map((id, i) => {
                const p = ctx.prizeById.get(id);
                if (!p) return null;
                return (
                  <span
                    key={`${ctx.state.log.length}-${i}`}
                    className="shrink-0 rounded-md"
                    style={{ boxShadow: i === 0 ? TIER_META[p.tier].glow : "none" }}
                  >
                    <PrizeTile prize={p} size={i === 0 ? 48 : 40} tone="dark" />
                  </span>
                );
              })
            )}
          </div>
        </section>

        {/* 分頁：獲得清單 / 官方機率表 */}
        <section className="rounded-xl border border-white/10 bg-white/[0.04]">
          <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
            <TabBtn on={tab === "collected"} onClick={() => setTab("collected")}>
              獲得清單 {collected.length}
            </TabBtn>
            <TabBtn on={tab === "odds"} onClick={() => setTab("odds")}>
              官方機率表 {ctx.pool.prizes.length}
            </TabBtn>
            <button
              type="button"
              onClick={ctx.handleReset}
              className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-100"
            >
              <RotateCcw size={12} /> 重置
            </button>
          </div>

          <div className="p-3">
            {tab === "collected" ? (
              <>
                <div className="mb-2.5 flex flex-wrap gap-1.5">
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
                <div className="flex flex-wrap gap-1.5">
                  {collected.length === 0 ? (
                    <p className="text-xs text-slate-600">還沒抽到任何東西。</p>
                  ) : (
                    collected.map(({ prize, n }) => (
                      <PrizeTile
                        key={prize.name}
                        prize={prize}
                        size={42}
                        count={n}
                        tone="dark"
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <input
                  value={odds.q}
                  onChange={(e) => odds.setQ(e.target.value)}
                  placeholder="搜尋道具名稱"
                  className="mb-2 w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-xs outline-none focus:border-amber-400"
                />
                <p className="mb-2 text-[0.7rem] text-slate-500">
                  活動期間 {poolPeriod(ctx.pool)}・{ctx.pool.capturedAt} 擷取
                </p>
                <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {TIER_ORDER.filter((t) => odds.byTier.has(t)).map((t) => (
                    <div key={t}>
                      <p
                        className="mb-1 text-[0.7rem] font-bold"
                        style={{ color: TIER_META[t].color }}
                      >
                        {TIER_META[t].label}
                      </p>
                      <ul className="divide-y divide-white/5">
                        {(odds.byTier.get(t) ?? []).map((p) => {
                          const n =
                            p.itemId === null ? 0 : (ctx.view.counts.get(p.itemId) ?? 0);
                          return (
                            <li key={p.name} className="flex items-center gap-2 py-1">
                              <PrizeTile prize={p} size={26} dimmed={n === 0} tone="dark" />
                              <span className="flex-1 truncate text-xs">{p.name}</span>
                              {n > 0 && (
                                <span className="text-[0.7rem] font-bold text-emerald-400">
                                  ×{n}
                                </span>
                              )}
                              <span className="w-14 text-right text-xs tabular-nums text-slate-400">
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
          </div>
        </section>
      </div>
    </div>
  );
}

function Hud({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="truncate text-2xl font-black tabular-nums" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function BigBtn({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[6rem] rounded-lg px-4 py-2 text-sm font-black transition active:translate-y-px ${
        accent
          ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
          : "bg-white/10 text-slate-100 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function TabBtn({
  children,
  on,
  onClick,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs font-bold ${
        on ? "bg-white/15 text-slate-100" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
