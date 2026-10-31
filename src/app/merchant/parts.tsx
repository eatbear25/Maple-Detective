"use client";

/* /merchant 的各區塊：貨架、操作按鈕、前面幾批、目標、官方機率表、刷到集滿的結果卡。
   版面怎麼擺在 merchant-client.tsx，狀態在 use-merchant.ts。 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, FastForward, RotateCcw, Search, Star, Undo2, X } from "lucide-react";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  MERCHANT_NPC_ICON,
  prizeLabel,
  type Category,
  type MerchantPool,
  type Prize,
} from "@/data/merchant";
import { AUTO_MAX, RECORD_CAP, UNTIL_MAX, batchAt, refreshPrice } from "./engine";
import { PrizeIcon } from "./prize-tile";
import { UNDO_MS, type MerchantCtx, type UntilResult } from "./use-merchant";

/** 目標格的底色：淡淡的琥珀，兩種主題都從變數混出來 */
const GOAL_BG = "bg-[color-mix(in_srgb,var(--accent-soft)_55%,var(--surface))]";
/** 小圖示格的底色（前面幾批、目標進度） */
const CELL_BG = "bg-[color-mix(in_srgb,var(--border)_40%,var(--surface))]";
/** 目標格的框：粗框＋文字標籤，不只靠顏色 */
const GOAL_RING = "shadow-[inset_0_0_0_2px_var(--accent)]";

/** 「前面幾批」捲到底一次多載幾批 */
const HISTORY_PAGE = 50;

const nt = (n: number) => `NT$${n.toLocaleString()}`;
const rate = (p: Prize) => `${p.rate.toFixed(2)}%`;

// --- 貨架 ---------------------------------------------------------------

/** 最新一批（6 格大圖）＋操作列（桌機）＋目標列（手機）＋前面幾批 */
export function Shelf({ ctx, onOpenGoal }: { ctx: MerchantCtx; onOpenGoal: () => void }) {
  const { pool, state, shelf, flip, flash } = ctx;
  return (
    <section
      aria-labelledby="merchant-shelf-h"
      className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <MerchantAvatar />
        <h2 id="merchant-shelf-h" className="text-[15px] font-bold sm:text-[17px]">
          麥吉的貨架{" "}
          <span className="text-[13px] font-medium text-[var(--text-muted)] sm:text-sm">
            {state.refreshes > 0 ? `第 ${state.refreshes.toLocaleString()} 批` : "還沒刷新"}
          </span>
        </h2>
        {flash ? (
          <span
            key={flash.id}
            className="merchant-flash ml-auto text-right text-xs font-medium text-[var(--accent-text)] sm:text-[13px]"
          >
            {flash.text}
          </span>
        ) : (
          ctx.full && (
            <span className="ml-auto text-right text-xs text-[var(--text-muted)]">
              紀錄滿 {RECORD_CAP.toLocaleString()} 批了，重置後才能再刷
            </span>
          )
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {ctx.live}
      </p>

      <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-3.5 sm:gap-3 sm:px-6 sm:pb-5 sm:pt-[22px]">
        {Array.from({ length: pool.slots }).map((_, i) => {
          const p = shelf[i];
          if (!p) return <EmptyCell key={`e-${i}`} />;
          const animate = flip === state.refreshes;
          return (
            <ShelfCell
              key={`${state.refreshes}-${i}`}
              prize={p}
              isGoal={ctx.goalKeys.has(p.key)}
              delay={animate ? i * 70 : undefined}
            />
          );
        })}
      </div>

      <GoalRow ctx={ctx} onClick={onOpenGoal} />

      <div className="hidden flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--border)] bg-[var(--bg)] px-6 py-4 lg:flex">
        <RefreshButtons ctx={ctx} />
        <div className="ml-auto">
          <Totals ctx={ctx} />
        </div>
      </div>

      <History ctx={ctx} />
    </section>
  );
}

/** 麥吉的頭像：夜空底（呼應官方活動圖），兩種主題下都是深色 */
function MerchantAvatar() {
  return (
    <div className="grid size-9 shrink-0 place-items-start justify-center overflow-hidden rounded-full bg-[#2B2F55] sm:size-11">
      {/* eslint-disable-next-line @next/next/no-img-element -- 像素圖 */}
      <img
        src={MERCHANT_NPC_ICON}
        alt=""
        className="-mt-5 h-auto w-[78px] max-w-none sm:-mt-4"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

/**
 * 格子高度寫死：空格、翻牌中、翻開後三者只要差幾 px，每刷一次貨架就會變高再縮回去，
 * 底下的按鈕跟著跳（2026-10-29 回報過一次）。手機是直式卡、sm 以上是橫式卡。
 */
const CELL_H = "h-[8.25rem] sm:h-[6.25rem]";

function EmptyCell() {
  return <div className={`rounded-xl border border-dashed border-[var(--border-strong)] ${CELL_H}`} />;
}

/** delay 給了就播翻牌動畫（只有刷 1 次）。卡背墊在底下，翻開前格子大小就已經定了 */
function ShelfCell({ prize, isGoal, delay }: { prize: Prize; isGoal: boolean; delay?: number }) {
  return (
    <div className="relative min-w-0">
      {delay !== undefined && (
        <div aria-hidden className="absolute inset-0 rounded-xl bg-[var(--border)]" />
      )}
      <div
        className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-center sm:flex-row sm:justify-start sm:gap-3 sm:px-3.5 sm:text-left ${CELL_H} ${
          isGoal
            ? `border-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)] ${GOAL_BG}`
            : "border-[var(--border)] bg-[var(--surface)]"
        } ${delay !== undefined ? "merchant-flip" : ""}`}
        style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
      >
        {isGoal && (
          <span className="absolute -top-2.5 left-2 rounded-full bg-[var(--accent-text)] px-1.5 text-[10px] font-bold leading-[18px] text-[var(--on-accent)] sm:left-3 sm:px-2 sm:text-[11px]">
            目標
          </span>
        )}
        <span className="grid h-[68px] w-full shrink-0 place-items-center sm:size-[72px]">
          <PrizeIcon prize={prize} fit={68} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 sm:gap-1">
          <span
            className={`line-clamp-2 text-[13px] leading-tight sm:text-sm ${isGoal ? "font-bold" : "font-medium"}`}
          >
            {prizeLabel(prize)}
          </span>
          <span
            className={`text-[11px] tabular-nums sm:text-xs ${
              isGoal ? "font-bold text-[var(--accent-text)]" : "text-[var(--text-muted)]"
            }`}
          >
            {rate(prize)}
          </span>
        </span>
      </div>
    </div>
  );
}

// --- 操作 ---------------------------------------------------------------

/**
 * 刷 1 次／刷 N 次（主按鈕，次數輸入框嵌在左邊）／刷到集滿為止。
 * compact＝手機底部那一排。刷的時候按鈕一直可以按、位置不動。
 */
export function RefreshButtons({ ctx, compact = false }: { ctx: MerchantCtx; compact?: boolean }) {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const typed = draft === null ? NaN : Number.parseInt(draft, 10);
  const count = typed >= 1 ? Math.min(AUTO_MAX, typed) : ctx.autoCount;
  const { ticket } = ctx.pool;

  const untilDisabled = ctx.full || ctx.goal.length === 0 || ctx.goalDone;
  const untilHint = ctx.goal.length === 0 ? "先挑目標" : ctx.goalDone ? "已經集滿了" : "直接看結果";

  const secondary = `flex cursor-pointer flex-col justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--surface)] ${
    compact ? "h-[52px] min-w-0 items-center px-1" : "h-14 items-start px-4"
  }`;
  const big = compact ? "text-sm font-bold" : "text-[15px] font-bold";
  const small = compact ? "text-[11px]" : "text-xs";

  return (
    <div className={compact ? "flex gap-2" : "flex flex-wrap gap-2.5"}>
      <button
        type="button"
        onClick={ctx.refreshOne}
        disabled={ctx.full}
        className={`${secondary} ${compact ? "flex-[0.9]" : "min-w-28"}`}
      >
        <span className={big}>刷 1 次</span>
        <span className={`${small} tabular-nums text-[var(--text-muted)]`}>{nt(ticket.single)}</span>
      </button>

      <div
        className={`flex rounded-xl bg-[var(--accent-text)] ${
          compact ? "h-[52px] min-w-0 flex-[1.6]" : "h-14"
        } ${ctx.full ? "opacity-50" : ""}`}
      >
        <div
          className={`my-1 ml-1 flex items-center rounded-[9px] bg-[var(--surface)] ${
            compact ? "px-1" : "gap-1 pl-1 pr-2.5"
          }`}
        >
          <label htmlFor={inputId} className="sr-only">
            連刷次數
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={AUTO_MAX}
            step={10}
            value={draft ?? String(ctx.autoCount)}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number.parseInt(e.target.value, 10);
              if (n >= 1) ctx.setAutoCount(Math.min(AUTO_MAX, n));
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              setDraft(null);
              ctx.refreshMany();
            }}
            className={`h-10 bg-transparent font-bold tabular-nums text-[var(--text)] outline-none [appearance:textfield] focus-visible:shadow-none! [&::-webkit-inner-spin-button]:appearance-none ${
              compact ? "w-11 text-center text-base" : "w-[60px] text-right text-[17px]"
            }`}
          />
          {!compact && <span className="text-[13px] text-[var(--text-muted)]">次</span>}
        </div>
        <button
          type="button"
          onClick={ctx.refreshMany}
          disabled={ctx.full}
          className={`flex cursor-pointer flex-col justify-center rounded-r-xl text-[var(--on-accent)] transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
            compact ? "min-w-0 flex-1 items-center px-1" : "min-w-28 items-start pl-3.5 pr-[18px]"
          }`}
        >
          {/* 手機最窄的時候塞不下「刷 1,000 次」，次數看左邊的輸入框就好 */}
          <span className={`${big} whitespace-nowrap ${compact ? "max-[379px]:hidden" : ""}`}>
            刷 {count.toLocaleString()} 次
          </span>
          {compact && <span className={`${big} min-[380px]:hidden`}>連刷</span>}
          <span className={`${small} tabular-nums opacity-80`}>
            {nt(refreshPrice(count, ticket))}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={ctx.refreshUntilDone}
        disabled={untilDisabled}
        title={`接著目前的紀錄一直刷到目標每件都出現過，最多 ${UNTIL_MAX.toLocaleString()} 次`}
        className={`${secondary} ${compact ? "flex-[1.1]" : "min-w-[148px]"}`}
      >
        <span className={`flex items-center gap-1 ${big} sm:gap-1.5`}>
          <FastForward size={compact ? 14 : 16} className="shrink-0 text-[var(--accent)]" />
          <span className="whitespace-nowrap">{compact ? "刷到集滿" : "刷到集滿為止"}</span>
        </span>
        <span className={`${small} text-[var(--text-muted)]`}>{untilHint}</span>
      </button>
    </div>
  );
}

/** 「已刷 213 次・NT$5,760」＋重置 */
export function Totals({ ctx, compact = false }: { ctx: MerchantCtx; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "text-[13px]" : "text-sm"}`}>
      <span className="tabular-nums">
        已刷 <strong>{ctx.state.refreshes.toLocaleString()}</strong> 次・
        <strong>{nt(ctx.spent)}</strong>
      </span>
      <button
        type="button"
        onClick={ctx.reset}
        disabled={ctx.state.refreshes === 0}
        aria-label="重置紀錄"
        title="重置紀錄"
        className={`grid cursor-pointer place-items-center rounded-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:opacity-50 ${
          compact ? "-my-1.5 size-9" : "size-10"
        }`}
      >
        <RotateCcw size={compact ? 17 : 18} />
      </button>
    </div>
  );
}

/**
 * 清空目標後的復原提示。樣式跟 BOSS 計時器的復原提示一樣（白底膠囊、按鈕上倒數秒數），
 * 全站同一種東西長同一個樣子。key 帶 undo.id，每次清空都是新的實例、倒數從頭算。
 */
export function UndoToast({ ctx }: { ctx: MerchantCtx }) {
  if (!ctx.undo) return null;
  return <UndoToastInner key={ctx.undo.id} ctx={ctx} count={ctx.undo.keys.length} />;
}

function UndoToastInner({ ctx, count }: { ctx: MerchantCtx; count: number }) {
  const [left, setLeft] = useState(UNDO_MS / 1000);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => Math.max(1, n - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      role="status"
      className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-4 pr-2 text-sm shadow-xl lg:bottom-4"
    >
      <span className="min-w-0 truncate">已清空目標・{count} 件</span>
      <button
        type="button"
        onClick={ctx.undoClear}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition-colors"
        style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
      >
        <Undo2 size={13} />
        復原（{left}）
      </button>
    </div>
  );
}

// --- 前面幾批 -----------------------------------------------------------

function History({ ctx }: { ctx: MerchantCtx }) {
  const { pool, state, goalKeys } = ctx;
  const [onlyGoal, setOnlyGoal] = useState(false);
  const [shown, setShown] = useState(HISTORY_PAGE);
  const past = state.refreshes - 1;

  /** 有出現目標的批數（由新到舊）。只有切到「只看有目標的」才算 */
  const goalBatches = useMemo(() => {
    if (!onlyGoal) return [];
    const out: number[] = [];
    for (let b = past; b >= 1; b--) {
      for (let i = (b - 1) * pool.slots; i < b * pool.slots; i++) {
        if (goalKeys.has(state.log[i])) {
          out.push(b);
          break;
        }
      }
    }
    return out;
  }, [onlyGoal, past, pool.slots, goalKeys, state.log]);

  const total = onlyGoal ? goalBatches.length : Math.max(0, past);
  const visible = onlyGoal
    ? goalBatches.slice(0, shown)
    : Array.from({ length: Math.min(shown, total) }, (_, i) => past - i);
  const more = visible.length < total;
  // 批數的欄寬跟著位數走，五位數也不會擠到圖示
  const digits = String(Math.max(1, past)).length;

  /*
   * 列表在框裡自己捲（2026-10-31 站長回報：整頁跟著拉長太長），捲到底自動多載 50 批。
   * shown 放進依賴：載完一批要重新觀察，框還沒塞滿（底部標記還看得到）就會接著載。
   */
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    const end = endRef.current;
    if (!box || !end || !more) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setShown((n) => n + HISTORY_PAGE);
      },
      { root: box, rootMargin: "0px 0px 240px 0px" },
    );
    io.observe(end);
    return () => io.disconnect();
  }, [more, shown]);

  // 刷出新的一批就回到最上面，最新的那批才看得到
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 0 });
  }, [state.refreshes]);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] px-3 pb-5 pt-4 sm:px-6 sm:pb-[22px] sm:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[15px] font-bold">前面幾批</h3>
          {ctx.goal.length > 0 && state.refreshes > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-muted)] sm:text-[13px]">
              目標出現 {ctx.goalAppearances.toLocaleString()} 次
            </span>
          )}
        </div>
        {past > 0 && (
          <div
            role="group"
            aria-label="篩選批次"
            className="inline-flex rounded-full border border-[var(--border)] p-0.5 text-[13px]"
          >
            {(
              [
                [false, "全部"],
                [true, "只看有目標的"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={onlyGoal === value}
                onClick={() => {
                  setOnlyGoal(value);
                  setShown(HISTORY_PAGE);
                  boxRef.current?.scrollTo({ top: 0 });
                }}
                className={`cursor-pointer rounded-full px-3 py-1 transition-colors ${
                  onlyGoal === value
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {past <= 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">刷過的每一批會依序列在這裡，最新的在上面。</p>
      ) : visible.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">前面幾批還沒有出現目標。</p>
      ) : (
        <div
          ref={boxRef}
          className="-mr-2 max-h-[min(26rem,60vh)] overflow-y-auto pr-2 sm:-mr-3 sm:pr-3"
        >
          <ol
            className="flex flex-col gap-1.5"
            style={
              {
                "--lw": `calc(${digits}ch + 0.9em)`,
                "--lw-sm": `calc(${digits}ch + 2.8em)`,
              } as React.CSSProperties
            }
          >
            {visible.map((b) => (
              <HistoryRow key={b} ctx={ctx} batch={b} />
            ))}
          </ol>
          {more ? (
            <div ref={endRef} className="py-3 text-center text-xs text-[var(--text-muted)]">
              載入中…
            </div>
          ) : (
            total > HISTORY_PAGE && (
              <p className="py-3 text-center text-xs text-[var(--text-muted)]">已經到最前面了</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ ctx, batch }: { ctx: MerchantCtx; batch: number }) {
  const prizes = batchAt(ctx.state, ctx.pool, batch);
  return (
    <li className="grid grid-cols-[var(--lw)_repeat(6,minmax(0,1fr))] items-center gap-[5px] sm:grid-cols-[var(--lw-sm)_repeat(6,minmax(0,1fr))] sm:gap-2">
      <span className="text-[11px] tabular-nums text-[var(--text-muted)] sm:text-[13px]">
        <span className="sm:hidden">#{batch}</span>
        <span className="hidden sm:inline">第 {batch} 批</span>
      </span>
      {prizes.map((p, i) => {
        const isGoal = ctx.goalKeys.has(p.key);
        return (
          <span
            key={i}
            title={`${prizeLabel(p)}・${rate(p)}${isGoal ? "・目標" : ""}`}
            className={`grid h-11 min-w-0 place-items-center overflow-hidden rounded-lg sm:h-12 ${
              isGoal ? `${GOAL_BG} ${GOAL_RING}` : CELL_BG
            }`}
          >
            <PrizeIcon key={p.key} prize={p} />
          </span>
        );
      })}
    </li>
  );
}

// --- 目標 ---------------------------------------------------------------

/** 目標每件的進度。桌機是右欄的卡片內容，手機是底部面板的內容 */
function GoalItems({ ctx }: { ctx: MerchantCtx }) {
  if (ctx.goal.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
        還沒挑目標。在官方機率表點星星，把想等的商品加進來。
      </p>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ctx.progress.map(({ key, batch }) => {
        const p = ctx.pool.prizes[key];
        return (
          <span
            key={key}
            title={`${prizeLabel(p)}・${rate(p)}・${batch === null ? "還沒出現" : `第 ${batch.toLocaleString()} 批出現`}`}
            className={`relative grid h-12 place-items-center rounded-[10px] ${
              batch === null ? CELL_BG : `${GOAL_BG} ${GOAL_RING}`
            }`}
          >
            <PrizeIcon prize={p} dimmed={batch === null} />
            {batch !== null && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-[var(--accent-text)] text-[var(--on-accent)]"
              >
                <Check size={11} strokeWidth={3.5} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** 「目標　1 / 5 已出現　清空」 */
function GoalHeader({ ctx, headingId }: { ctx: MerchantCtx; headingId: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 id={headingId} className="text-base font-bold">
        目標
      </h2>
      {ctx.goal.length > 0 && (
        <>
          <span className="text-[13px] font-bold tabular-nums">
            {ctx.cleared} / {ctx.goal.length} 已出現
          </span>
          <button
            type="button"
            onClick={ctx.clearGoal}
            className="ml-auto cursor-pointer rounded-lg px-2 py-1 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
          >
            清空目標
          </button>
        </>
      )}
    </div>
  );
}

export function GoalCard({ ctx }: { ctx: MerchantCtx }) {
  return (
    <section
      aria-labelledby="merchant-goal-h"
      className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4"
    >
      <GoalHeader ctx={ctx} headingId="merchant-goal-h" />
      <GoalItems ctx={ctx} />
    </section>
  );
}

/** 手機：貨架底下一列。還沒挑目標就直接去機率表，挑過了開底部面板 */
function GoalRow({ ctx, onClick }: { ctx: MerchantCtx; onClick: () => void }) {
  const empty = ctx.goal.length === 0;
  return (
    <button
      type="button"
      aria-haspopup={empty ? undefined : "dialog"}
      onClick={onClick}
      className="mx-3 mb-3 flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-left lg:hidden"
    >
      <span className="shrink-0 text-xs text-[var(--text-muted)]">目標</span>
      {!empty && (
        <span className="flex shrink-0 gap-0.5">
          {ctx.progress.slice(0, 5).map(({ key, batch }) => (
            <span key={key} className="grid size-[22px] place-items-center">
              <PrizeIcon prize={ctx.pool.prizes[key]} dimmed={batch === null} />
            </span>
          ))}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold tabular-nums">
        {empty ? "還沒挑目標" : `${ctx.cleared}/${ctx.goal.length}`}
      </span>
      <span className="shrink-0 text-xs font-medium text-[var(--accent-text)]">
        {empty ? "去挑" : "查看"}
      </span>
      <ChevronRight size={16} className="-ml-1.5 shrink-0 text-[var(--text-muted)]" />
    </button>
  );
}

/** 手機的底部面板：看目標進度、清空，或去機率表加商品 */
export function GoalSheet({
  ctx,
  onClose,
  onPick,
}: {
  ctx: MerchantCtx;
  onClose: () => void;
  onPick: () => void;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-sheet-h"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-[var(--surface)] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <GoalHeader ctx={ctx} headingId="merchant-sheet-h" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1 grid size-10 shrink-0 cursor-pointer place-items-center rounded-[10px] text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"
          >
            <X size={18} />
          </button>
        </div>
        <GoalItems ctx={ctx} />
        <button
          type="button"
          onClick={onPick}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] py-3 text-sm font-medium hover:bg-[var(--accent-soft)]"
        >
          <Star size={15} className="text-[var(--accent)]" />
          到機率表加商品
        </button>
      </div>
    </div>
  );
}

// --- 官方機率表 ---------------------------------------------------------

/** 依類別分組、類別內由稀有到常見排序，可用名稱與類別篩選。 */
function groupPrizes(pool: MerchantPool, keyword: string, cat: Category | null) {
  const kw = keyword.trim();
  const m = new Map<Category, Prize[]>();
  for (const p of pool.prizes) {
    if (cat && p.category !== cat) continue;
    if (kw && !p.name.includes(kw)) continue;
    const arr = m.get(p.category) ?? [];
    arr.push(p);
    m.set(p.category, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.rate - b.rate || a.key - b.key);
  return m;
}

/** 桌機在右欄（跟目標卡一起 sticky、清單自己捲），手機是「機率表」分頁 */
export function OddsTable({ ctx, className = "" }: { ctx: MerchantCtx; className?: string }) {
  const { pool } = ctx;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const groups = useMemo(() => groupPrizes(pool, q, cat), [pool, q, cat]);
  const perCat = useMemo(() => {
    const m = new Map<Category, number>();
    for (const p of pool.prizes) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [pool]);

  const chip = (on: boolean) =>
    `h-[30px] cursor-pointer rounded-full border px-2.5 text-xs transition-colors ${
      on
        ? "border-[var(--accent)] bg-[var(--accent-soft)] font-bold text-[var(--accent-text)]"
        : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--accent-soft)]"
    }`;

  return (
    <section
      aria-labelledby="merchant-odds-h"
      className={`flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 pb-3 pt-4 sm:px-[18px] sm:pt-[18px]">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="merchant-odds-h" className="text-base font-bold">
            官方機率表
          </h2>
          <span className="text-xs text-[var(--text-muted)]">{pool.prizes.length} 筆</span>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 focus-within:border-[var(--accent)]">
          <span className="sr-only">搜尋商品名稱</span>
          <Search size={16} className="shrink-0 text-[var(--text-muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋商品名稱"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-muted)] focus-visible:shadow-none! sm:text-sm"
          />
        </label>
        <div role="group" aria-label="分類" className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={cat === null} onClick={() => setCat(null)} className={chip(cat === null)}>
            全部
          </button>
          {CATEGORY_ORDER.filter((c) => perCat.has(c)).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(cat === c ? null : c)}
              className={chip(cat === c)}
            >
              {CATEGORY_META[c].short} {perCat.get(c)}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">點星星把商品加進目標</p>
      </div>

      <div className="px-2 pb-3 pt-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {groups.size === 0 && (
          <p className="px-2.5 py-3 text-[13px] text-[var(--text-muted)]">找不到「{q}」。</p>
        )}
        {CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => (
          <div key={c}>
            <p className="mx-2.5 mb-1.5 mt-2 text-xs font-bold tracking-wide text-[var(--text-muted)]">
              {CATEGORY_META[c].label}
            </p>
            <ul className="flex flex-col">
              {(groups.get(c) ?? []).map((p) => (
                <OddsRow key={p.key} ctx={ctx} prize={p} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function OddsRow({ ctx, prize }: { ctx: MerchantCtx; prize: Prize }) {
  const on = ctx.goalKeys.has(prize.key);
  const label = prizeLabel(prize);
  return (
    <li
      className={`flex min-h-12 items-center gap-2.5 rounded-lg pl-2.5 pr-1.5 ${
        on ? GOAL_BG : "hover:bg-[color-mix(in_srgb,var(--accent-soft)_45%,var(--surface))]"
      }`}
    >
      <span className="grid size-10 shrink-0 place-items-center">
        <PrizeIcon prize={prize} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${on ? "font-medium" : ""}`}>{label}</span>
      <span className="text-[13px] tabular-nums text-[var(--text-muted)]">{rate(prize)}</span>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `把${label}移出目標` : `把${label}加入目標`}
        onClick={() => ctx.toggleStar(prize.key)}
        className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-[var(--accent-soft)] ${
          on
            ? "text-[var(--accent)]"
            : "text-[var(--text-muted)] opacity-60 hover:opacity-100 dark:opacity-75"
        }`}
      >
        <Star size={18} fill={on ? "currentColor" : "none"} />
      </button>
    </li>
  );
}

// --- 刷到集滿為止的結果 -------------------------------------------------

/**
 * 刷到集滿為止的結果彈窗（桌機置中、手機從底部出來）。
 * 只放這次模擬實際發生的事，不放期望值、分布圖或運氣評語。
 *
 * 2026-10-31 站長看過後改：原本照設計稿是「取代主欄的貨架區塊」＋一條時間軸，
 * 換掉整塊貨架太多餘、時間軸那條線擠在一起也難讀，改成彈窗＋照出現順序排的清單。
 */
export function ResultModal({ ctx, result }: { ctx: MerchantCtx; result: UntilResult }) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscape(ctx.closeResult);
  useEffect(() => panelRef.current?.focus(), []);

  const seen = result.firsts
    .filter((f): f is { key: number; batch: number } => f.batch !== null)
    .sort((a, b) => a.batch - b.batch);
  const missing = result.firsts.filter((f) => f.batch === null);
  const lastKey = result.done ? seen.at(-1)?.key : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={ctx.closeResult}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] outline-none sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[var(--text-muted)]">
              <FastForward size={15} className="shrink-0 text-[var(--accent)]" />
              <span className="truncate">刷到集滿為止・目標 {result.keys.length} 件</span>
            </span>
            <button
              type="button"
              onClick={ctx.closeResult}
              aria-label="關閉"
              className="-mr-2 grid size-10 shrink-0 cursor-pointer place-items-center rounded-[10px] text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
            >
              <X size={18} />
            </button>
          </div>
          <h2 id={headingId} className="text-2xl font-bold leading-tight sm:text-[28px]">
            {result.done
              ? `第 ${result.at.toLocaleString()} 次集滿了`
              : `刷到第 ${result.at.toLocaleString()} 次還沒集滿`}
          </h2>
          <p className="text-[15px] tabular-nums text-[var(--text-muted)]">
            花費約{" "}
            <strong className="text-[var(--text)]">{nt(refreshPrice(result.at, ctx.pool.ticket))}</strong>
          </p>
          {!result.done && (
            <p className="text-[13px] text-[var(--text-muted)]">
              {result.at >= RECORD_CAP
                ? `紀錄到上限 ${RECORD_CAP.toLocaleString()} 批了。`
                : `一次最多刷 ${UNTIL_MAX.toLocaleString()} 次，再按一次「刷到集滿為止」會接著刷。`}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] px-3 py-3 sm:px-4">
          <h3 className="mx-2 mb-1.5 text-xs font-bold text-[var(--text-muted)]">每件在第幾批出現</h3>
          <ol className="flex flex-col gap-1">
            {seen.map(({ key, batch }) => {
              const p = ctx.pool.prizes[key];
              const last = key === lastKey;
              return (
                <li
                  key={key}
                  className={`flex min-h-12 items-center gap-2.5 rounded-[10px] px-2 ${last ? `${GOAL_BG} ${GOAL_RING}` : ""}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${last ? "" : CELL_BG}`}>
                    <PrizeIcon prize={p} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{prizeLabel(p)}</span>
                  {last && (
                    <span className="shrink-0 rounded-full bg-[var(--accent-text)] px-2 text-[11px] font-bold leading-[18px] text-[var(--on-accent)]">
                      最後一件
                    </span>
                  )}
                  <span className={`shrink-0 text-sm tabular-nums ${last ? "font-bold" : "text-[var(--text-muted)]"}`}>
                    第 {batch.toLocaleString()} 批
                  </span>
                </li>
              );
            })}
            {missing.map(({ key }) => {
              const p = ctx.pool.prizes[key];
              return (
                <li key={key} className="flex min-h-12 items-center gap-2.5 px-2">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${CELL_BG}`}>
                    <PrizeIcon prize={p} dimmed />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-muted)]">{prizeLabel(p)}</span>
                  <span className="shrink-0 text-sm text-[var(--text-muted)]">還沒出現</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex gap-2.5 border-t border-[var(--border)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">
          <button
            type="button"
            onClick={ctx.rerun}
            className="h-12 flex-1 cursor-pointer rounded-xl bg-[var(--accent-text)] px-[22px] text-[15px] font-bold text-[var(--on-accent)] transition-[filter] hover:brightness-110"
          >
            再模擬一次
          </button>
          <button
            type="button"
            onClick={ctx.closeResult}
            className="h-12 flex-1 cursor-pointer rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[15px] font-medium transition-colors hover:bg-[var(--accent-soft)]"
          >
            回到貨架
          </button>
        </div>
      </div>
    </div>
  );
}

function useEscape(onEscape: () => void) {
  const ref = useRef(onEscape);
  useEffect(() => {
    ref.current = onEscape;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
