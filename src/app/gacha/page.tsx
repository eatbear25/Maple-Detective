"use client";

/*
 * /gacha 轉蛋模擬。
 *
 * 版面（2026-08-21 由 ?variant= 原型三選一定案，選中「桌機雙欄・機率表常駐側欄」，
 * 決策脈絡見 .claude/skills/prototype/UI.md 那輪 A/B/C 比較）：
 *   左欄＝機台＋目標＋統計，右欄＝官方機率表（101 筆，lg 以上 sticky＋自己捲動，
 *   抽的時候可以邊看邊對照，不用像整段收合那樣多一次點擊）。手機版退回單欄堆疊。
 *
 * 機台視窗與整頁其餘部分同一套站內主題（--bg/--surface/--text/--border/--accent，
 * 見 theme.ts）——不再用固定深色機殼；也不用 Tailwind dark: class，那個只認
 * 瀏覽器 prefers-color-scheme，跟站內自己的深色開關 (useDarkMode) 不連動，
 * 兩者不同步時文字會直接消失（2026-08-21 修過一次）。
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
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const collected = useCollected(ctx);
  const odds = useOddsSearch(ctx);
  const isCustom = ctx.goalId === CUSTOM_GOAL_ID;

  return (
    <>
      <div className="space-y-6">
        <Header ctx={ctx} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <MachineWindow ctx={ctx} />

            <Card title="目標">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <GoalChips ctx={ctx} onCustom={() => setPicking(true)} />
              </div>
              <GoalDots ctx={ctx} tone="light" />
              {isCustom && picking && (
                <CustomPicker ctx={ctx} tone="light" onClose={() => setPicking(false)} />
              )}
            </Card>

            <Card title="統計">
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
                className="mt-2.5 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <ChevronDown size={13} className={listOpen ? "rotate-180" : ""} />
                完整獲得清單（{collected.length} 種）
              </button>
              {listOpen && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collected.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">還沒抽到任何東西。</p>
                  ) : (
                    collected.map(({ prize, n }) => (
                      <PrizeTile key={prize.name} prize={prize} size={40} count={n} />
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* 官方機率表：常駐右欄，lg 以上 sticky＋自己捲動，抽的時候可以邊看 */}
          <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            <div className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                官方機率表
                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                  {ctx.pool.prizes.length} 筆
                </span>
              </span>
              <p className="mt-0.5 text-[0.7rem] text-[var(--text-muted)]">
                活動期間 {poolPeriod(ctx.pool)}
              </p>
              <input
                value={odds.q}
                onChange={(e) => odds.setQ(e.target.value)}
                placeholder="搜尋道具名稱"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
              />
              <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {TIER_ORDER.filter((t) => odds.byTier.has(t)).map((t) => (
                  <div key={t}>
                    <p
                      className="mb-1 text-[0.7rem] font-bold"
                      style={{ color: TIER_META[t].color }}
                    >
                      {TIER_META[t].label}
                    </p>
                    <ul className="divide-y divide-[var(--border)]">
                      {(odds.byTier.get(t) ?? []).map((p) => {
                        const n =
                          p.itemId === null ? 0 : (ctx.view.counts.get(p.itemId) ?? 0);
                        return (
                          <li key={p.name} className="flex items-center gap-2 py-1">
                            <PrizeTile prize={p} size={28} dimmed={n === 0} />
                            <span className="flex-1 truncate text-xs">{p.name}</span>
                            {n > 0 && (
                              <span className="text-[0.7rem] font-bold text-emerald-600">
                                ×{n}
                              </span>
                            )}
                            <span className="w-14 text-right text-xs tabular-nums text-[var(--text-muted)]">
                              {p.rate.toFixed(2)}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {ctx.result && <ResultModal ctx={ctx} onClose={() => ctx.setResult(null)} />}
    </>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      {title && (
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--accent)" }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Header({ ctx }: { ctx: GachaCtx }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-3xl font-bold tracking-tight">轉蛋模擬</h1>
      <p className="text-xs text-[var(--text-muted)]">
        {ctx.pool.title}
        <span className="mx-1.5 opacity-40">・</span>
        活動期間 {poolPeriod(ctx.pool)}
      </p>
    </header>
  );
}

function MachineWindow({ ctx }: { ctx: GachaCtx }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <header className="flex items-center border-b border-[var(--border)] px-3 py-2">
        <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          轉蛋機
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
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
            className={`relative h-auto w-24 max-w-full drop-shadow-md sm:w-28 ${ctx.spinning ? "animate-machine-shake" : ""}`}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* 結果盤：固定 5×2，不會因為換行跳版。欄寬寫死的格子在極窄視窗下可能比
            這個 grid 欄位本身還寬，overflow-x-auto 保底讓它自己橫向捲動，
            不會把整頁一起撐寬（頁面本身不能橫向捲動）。 */}
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {ctx.spinning
              ? `自動抽 ${ctx.playbackShown} / ${ctx.playbackTotal}`
              : ctx.reveal.length > 0
                ? "本次結果"
                : "結果"}
          </p>
          <div className="mx-auto grid w-fit grid-cols-[repeat(5,2.75rem)] gap-2">
            {Array.from({ length: SLOTS }).map((_, i) => {
              const p: Prize | undefined = ctx.reveal[i];
              return p ? (
                <FlipSlot key={`${ctx.revealSeq}-${i}`} prize={p} delay={i * 70} />
              ) : (
                <EmptySlot key={`e-${i}`} size={44} tone="light" />
              );
            })}
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold">
            已抽 <span style={{ color: "var(--accent)" }}>{ctx.view.pulls}</span> 次
            <span className="mx-1.5 opacity-30">・</span>
            <span className="text-rose-500">NT${ctx.view.spent.toLocaleString()}</span>
            <button
              type="button"
              onClick={ctx.handleReset}
              disabled={ctx.spinning || ctx.view.pulls === 0}
              className="ml-2 inline-flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={11} /> 重置
            </button>
          </p>
          <Buttons ctx={ctx} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          <AutoCountInput ctx={ctx} tone="light" />
        </div>
      </footer>
    </section>
  );
}

function GoalChips({ ctx, onCustom }: { ctx: GachaCtx; onCustom: () => void }) {
  const chipClass = (active: boolean) =>
    `cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
      active
        ? "text-white"
        : "bg-[var(--accent-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;
  return (
    <div className="flex flex-wrap gap-1">
      {ctx.pool.goals.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => ctx.setGoalId(g.id)}
          style={ctx.goalId === g.id ? { background: "var(--accent)" } : undefined}
          className={chipClass(ctx.goalId === g.id)}
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
        style={ctx.goalId === CUSTOM_GOAL_ID ? { background: "var(--accent)" } : undefined}
        className={chipClass(ctx.goalId === CUSTOM_GOAL_ID)}
      >
        自訂
      </button>
    </div>
  );
}

function Buttons({ ctx }: { ctx: GachaCtx }) {
  const base =
    "cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";
  if (ctx.spinning) {
    return (
      <button
        type="button"
        onClick={ctx.stopAuto}
        title="抽數已經算完了，這顆鈕只是跳過播放動畫、直接看結果"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        className={base}
      >
        跳過動畫
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => ctx.handlePull(1)}
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        className={base}
      >
        抽 1 次
      </button>
      <button
        type="button"
        onClick={() => ctx.handlePull(10)}
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        className={base}
      >
        抽 10 次
      </button>
      <button
        type="button"
        onClick={ctx.handleAuto}
        style={{ background: "var(--accent)" }}
        className={`${base} text-white`}
      >
        連抽 {ctx.autoCount.toLocaleString()} 次
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5">
      <p className="text-[0.65rem] text-[var(--text-muted)]">{label}</p>
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
        <PrizeTile prize={prize} size={44} tone="light" />
      ) : (
        <span className="h-11 w-11 rounded-md bg-[var(--border)]" />
      )}
    </span>
  );
}
