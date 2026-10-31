"use client";

/*
 * /merchant 神秘商人模擬（2026-10-29 起取代轉蛋模擬，遊戲把轉蛋活動換成了神秘商人）。
 *
 * 神秘商人：每一批貨架 6 個商品，每 6 小時自動換一批、每天 1 次免費刷新，
 * 其他時候用刷新券立刻換。這裡模擬的是「用刷新券刷新」：一次刷新＝6 格各自用官方機率表抽。
 * 商品上架後的售價、免費／打折的機率官方沒公布，所以花費只算刷新券。
 *
 * 版面沿用轉蛋模擬定案的「桌機雙欄・機率表常駐側欄」（2026-08-21 原型三選一）：
 *   左欄＝商人視窗＋目標＋統計，右欄＝官方機率表（lg 以上 sticky＋自己捲動，
 *   刷新的時候可以邊看邊對照）。手機版退回單欄堆疊。
 *
 * 顏色一律走站內主題變數（--bg/--surface/--text/--border/--accent，見 theme.ts），
 * 只有商人背後那塊夜空是固定色（兩種主題下都是深底，上面的字固定白色）。
 *
 * 邏輯在 engine.ts（純函式）與 use-merchant.ts（狀態），這裡只負責版面。
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  MERCHANT_NPC_ICON,
  isRare,
  poolPeriod,
  prizeLabel,
  type Prize,
} from "@/data/merchant";
import { PrizeTile } from "./prize-tile";
import { CUSTOM_GOAL_ID, useMerchant, type MerchantCtx } from "./use-merchant";
import { PageHeader } from "@/app/page-header";
import {
  AutoCountInput,
  CustomPicker,
  GoalDots,
  ResultModal,
  SearchBox,
  groupPrizes,
  useCollected,
} from "./parts";

/** 稀有商品（機率 < RARE_BELOW）在貨架上的光暈 */
const RARE_GLOW = "0 0 0 2px rgba(245,158,11,0.85), 0 0 10px 1px rgba(245,158,11,0.45)";

/**
 * 貨架一格的最小高度，空格／卡背／商品卡共用。三者只要差幾 px，每次刷新貨架就會
 * 變高再縮回去，底下整頁跟著上下跳（2026-10-29 回報）。卡片內容約 110px，留點餘裕。
 */
const SLOT_MIN_H = "min-h-[7.5rem]";

export default function MerchantPage() {
  const ctx = useMerchant();
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const collected = useCollected(ctx);
  const isCustom = ctx.goalId === CUSTOM_GOAL_ID;

  return (
    <>
      <div className="space-y-6">
        <Header ctx={ctx} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <MerchantWindow ctx={ctx} />

            <Card title="目標">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <GoalChips ctx={ctx} onCustom={() => setPicking(true)} />
              </div>
              <GoalDots ctx={ctx} />
              {isCustom && picking && <CustomPicker ctx={ctx} onClose={() => setPicking(false)} />}
              {isCustom && !picking && (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="mt-2 cursor-pointer text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  挑選商品…
                </button>
              )}
            </Card>

            <Card title="統計">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="已刷新" value={ctx.view.refreshes.toLocaleString()} />
                <Stat label="花費" value={`NT$${ctx.view.spent.toLocaleString()}`} />
                <Stat
                  label="目標進度"
                  value={
                    ctx.goal.keys.length
                      ? `${ctx.progress.cleared}/${ctx.goal.keys.length}`
                      : "—"
                  }
                />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CATEGORY_ORDER.map((c) => {
                  const row = ctx.categories.find((x) => x.category === c);
                  if (!row) return null;
                  return (
                    <span
                      key={c}
                      className="rounded-full px-2 py-0.5 text-[0.7rem] font-bold text-white"
                      style={{ background: CATEGORY_META[c].deep }}
                      title={`${CATEGORY_META[c].label}：上架過 ${row.seen} 格，${row.kinds} 種裡看過 ${row.collected} 種`}
                    >
                      {CATEGORY_META[c].short} {row.seen}
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
                上架過的商品（{collected.length} 種）
              </button>
              {listOpen && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collected.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">還沒刷新過。</p>
                  ) : (
                    collected.map(({ prize, n }) => (
                      <PrizeTile key={prize.key} prize={prize} size={40} count={n} />
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>

          <OddsTable ctx={ctx} />
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
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Header({ ctx }: { ctx: MerchantCtx }) {
  return (
    <PageHeader
      title="神秘商人模擬"
      description={`用官方公布的機率表模擬刷新貨架（活動期間 ${poolPeriod(ctx.pool)}）`}
    />
  );
}

function MerchantWindow({ ctx }: { ctx: MerchantCtx }) {
  const { slots, ticket } = ctx.pool;
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <header className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
          神秘商人
        </span>
        <span className="text-[0.7rem] text-[var(--text-muted)]">每次刷新上架 {slots} 個商品</span>
      </header>

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        {/* 商人：夜空底（呼應官方活動圖），兩種主題下都是深色 */}
        <div
          className="relative flex flex-col items-center justify-end gap-1.5 overflow-hidden rounded-lg py-3 sm:py-4"
          style={{
            background:
              "radial-gradient(circle at 70% 18%, #fdf6d8 0 7%, transparent 8%), radial-gradient(circle at 50% 40%, #34407a 0%, #1d2550 60%, #11173a 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 像素圖 */}
          <img
            src={MERCHANT_NPC_ICON}
            alt="神秘商人麥吉"
            className={`relative h-auto max-h-24 w-auto max-w-full drop-shadow-md sm:max-h-28 ${ctx.spinning ? "animate-machine-shake" : ""}`}
            style={{ imageRendering: "pixelated" }}
          />
          <span className="rounded bg-black/60 px-1.5 py-px text-[0.65rem] font-bold text-white">
            麥吉
          </span>
        </div>

        {/* 貨架：固定 3×2，不會因為換行跳版 */}
        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
          <p className="mb-2 text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)]">
            {ctx.spinning
              ? `連續刷新 ${ctx.playbackShown} / ${ctx.playbackTotal}`
              : ctx.shelf.length > 0
                ? `第 ${ctx.view.refreshes} 批貨`
                : "還沒刷新"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: slots }).map((_, i) => {
              const p: Prize | undefined = ctx.shelf[i];
              if (!p) return <EmptyCard key={`e-${i}`} />;
              const isGoal = ctx.goalKeys.has(p.key);
              return ctx.spinning ? (
                <ShelfCard key={`s-${i}`} prize={p} isGoal={isGoal} />
              ) : (
                <FlipCard key={`${ctx.revealSeq}-${i}`} prize={p} isGoal={isGoal} delay={i * 70} />
              );
            })}
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold">
            已刷新 <span style={{ color: "var(--accent-text)" }}>{ctx.view.refreshes}</span> 次
            <span className="mx-1.5 opacity-30">・</span>
            <span className="text-rose-500 dark:text-rose-400">
              NT${ctx.view.spent.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={ctx.handleReset}
              disabled={ctx.view.refreshes === 0 && !ctx.spinning}
              className="ml-2 inline-flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40 dark:disabled:opacity-50"
            >
              <RotateCcw size={11} /> 重置
            </button>
          </p>
          <Buttons ctx={ctx} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          <AutoCountInput ctx={ctx} />
        </div>
        <p className="text-[0.7rem] leading-relaxed text-[var(--text-muted)]">
          遊戲裡每 6 小時會自動換一批、每天可免費刷新 1 次；這裡模擬的是用刷新券（{ticket.single}{" "}
          點／張，10 張 {ticket.bundle10} 點）立刻刷新。花費只算刷新券——商品上架後的售價與免費／打折的機率官方沒有公布。
        </p>
      </footer>
    </section>
  );
}

function GoalChips({ ctx, onCustom }: { ctx: MerchantCtx; onCustom: () => void }) {
  const chipClass = (active: boolean) =>
    `cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
      active
        ? "text-[var(--on-accent)]"
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

function Buttons({ ctx }: { ctx: MerchantCtx }) {
  const base =
    "cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";
  if (ctx.spinning) {
    return (
      <button
        type="button"
        onClick={ctx.stopAuto}
        title="次數已經算完了，這顆鈕只是跳過播放動畫、直接看結果"
        style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
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
        onClick={ctx.handleRefresh}
        style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
        className={base}
      >
        刷新 1 次
      </button>
      <button
        type="button"
        onClick={ctx.handleAuto}
        style={{ background: "var(--accent)" }}
        className={`${base} text-[var(--on-accent)]`}
      >
        連續刷新 {ctx.autoCount.toLocaleString()} 次
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

/** 貨架上的一格：圖示、名稱、機率。目標商品掛「目標」標籤，稀有商品發光。 */
function ShelfCard({ prize, isGoal }: { prize: Prize; isGoal: boolean }) {
  const rare = isRare(prize);
  return (
    <div
      className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border bg-[var(--surface)] px-1 pb-1.5 pt-2 ${SLOT_MIN_H}`}
      style={{
        borderColor: isGoal ? "var(--accent)" : "var(--border)",
        boxShadow: rare ? RARE_GLOW : undefined,
      }}
    >
      {isGoal && (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[0.6rem] font-bold leading-4 text-[var(--on-accent)]"
          style={{ background: "var(--accent)" }}
        >
          目標
        </span>
      )}
      <PrizeTile prize={prize} size={44} showQty={false} />
      <span className="line-clamp-2 min-h-[2.5em] w-full break-all text-center text-[0.68rem] leading-tight">
        {prizeLabel(prize)}
      </span>
      <span
        className={`text-[0.6rem] tabular-nums ${
          rare ? "font-bold text-amber-600 dark:text-amber-400" : "text-[var(--text-muted)]"
        }`}
      >
        {prize.rate.toFixed(2)}%
      </span>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className={`rounded-lg border border-dashed border-[var(--border)] ${SLOT_MIN_H}`} />
  );
}

/**
 * key 帶 revealSeq，每次刷新都是新實例，所以 effect 只需要設一次計時器。
 *
 * 卡背是「蓋在」商品卡上面，不是換掉它：商品卡從一開始就排好版（只是隱藏），
 * 格子高度從頭到尾由它決定，翻開前後完全一樣。
 */
function FlipCard({ prize, isGoal, delay }: { prize: Prize; isGoal: boolean; delay: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delay + 180);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="relative min-w-0">
      <div className={open ? "" : "invisible"}>
        <ShelfCard prize={prize} isGoal={isGoal} />
      </div>
      {!open && <div className="absolute inset-0 rounded-lg bg-[var(--border)]" />}
    </div>
  );
}

/** 官方機率表：常駐右欄，lg 以上 sticky＋自己捲動，刷新的時候可以邊看 */
function OddsTable({ ctx }: { ctx: MerchantCtx }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => groupPrizes(ctx.pool, q), [ctx.pool, q]);
  return (
    <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
      <div className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <span className="text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
          官方機率表
          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
            {ctx.pool.prizes.length} 筆
          </span>
        </span>
        <p className="mt-0.5 text-[0.7rem] text-[var(--text-muted)]">
          每一格各自抽・活動期間 {poolPeriod(ctx.pool)}
        </p>
        <SearchBox value={q} onChange={setQ} className="mt-2" />
        <div className="mt-2 max-h-[70vh] min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 lg:max-h-none">
          {groups.size === 0 && (
            <p className="text-xs text-[var(--text-muted)]">找不到「{q}」。</p>
          )}
          {CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => (
            <div key={c}>
              <p className="mb-1 text-[0.7rem] font-bold" style={{ color: CATEGORY_META[c].color }}>
                {CATEGORY_META[c].label}
              </p>
              <ul className="divide-y divide-[var(--border)]">
                {(groups.get(c) ?? []).map((p) => {
                  const n = ctx.view.counts.get(p.key) ?? 0;
                  return (
                    <li key={p.key} className="flex items-center gap-2 py-1">
                      <PrizeTile prize={p} size={28} dimmed={n === 0} showQty={false} />
                      <span className="flex-1 truncate text-xs">{prizeLabel(p)}</span>
                      {n > 0 && (
                        <span className="text-[0.7rem] font-bold text-emerald-600 dark:text-emerald-400">
                          ×{n}
                        </span>
                      )}
                      <span
                        className={`w-12 text-right text-xs tabular-nums ${
                          isRare(p)
                            ? "font-bold text-amber-600 dark:text-amber-400"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
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
  );
}
