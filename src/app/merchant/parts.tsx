"use client";

/* /merchant 的共用元件：目標挑選器、連續刷新結算彈窗、次數輸入、目標進度、機率表搜尋。
   版面本體在 merchant-client.tsx。 */

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  prizeLabel,
  type Category,
  type MerchantPool,
  type Prize,
} from "@/data/merchant";
import { REFRESH_CAP, categoryCounts, refreshPrice } from "./engine";
import { PrizeTile } from "./prize-tile";
import type { MerchantCtx } from "./use-merchant";

/** 依類別分組、類別內由稀有到常見排序，可用名稱篩選。機率表與目標挑選器共用。 */
export function groupPrizes(pool: MerchantPool, keyword: string): Map<Category, Prize[]> {
  const kw = keyword.trim();
  const m = new Map<Category, Prize[]>();
  for (const p of pool.prizes) {
    if (kw && !p.name.includes(kw)) continue;
    const arr = m.get(p.category) ?? [];
    arr.push(p);
    m.set(p.category, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.rate - b.rate || a.key - b.key);
  return m;
}

export function SearchBox({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label
      className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 focus-within:border-[var(--accent)] ${className}`}
    >
      <Search size={12} className="shrink-0 text-[var(--text-muted)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜尋商品名稱"
        className="w-full bg-transparent py-1 text-xs outline-none"
      />
    </label>
  );
}

export function CustomPicker({ ctx, onClose }: { ctx: MerchantCtx; onClose: () => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => groupPrizes(ctx.pool, q), [ctx.pool, q]);

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">挑選想等到的商品</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="收起"
          className="cursor-pointer opacity-60 hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
      <SearchBox value={q} onChange={setQ} className="mb-1.5" />
      <div className="max-h-64 space-y-2 overflow-y-auto p-1">
        {groups.size === 0 && (
          <p className="text-xs text-[var(--text-muted)]">找不到「{q}」。</p>
        )}
        {CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => (
          <div key={c}>
            <p className="mb-1 text-[0.65rem] font-bold" style={{ color: CATEGORY_META[c].color }}>
              {CATEGORY_META[c].label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(groups.get(c) ?? []).map((p) => {
                const on = ctx.custom.has(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => ctx.toggleCustom(p.key)}
                    aria-pressed={on}
                    title={`${prizeLabel(p)}（${p.rate}%）`}
                    className={`cursor-pointer rounded-lg p-0.5 transition ${
                      on ? "bg-amber-400" : "bg-transparent hover:bg-[var(--accent-soft)]"
                    }`}
                  >
                    <PrizeTile prize={p} size={34} dimmed={!on} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultModal({ ctx, onClose }: { ctx: MerchantCtx; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const r = ctx.result;
  if (!r) return null;
  const hasGoal = ctx.goal.keys.length > 0;
  const missing = ctx.progress.items.filter((g) => g.seen === 0);
  const capped = r.refreshes < r.requested;
  const totals = categoryCounts(ctx.state.counts, ctx.pool);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <p className="text-sm font-semibold">
            {r.reached ? (
              <span className="text-emerald-600 dark:text-emerald-400">目標湊齊 ✓</span>
            ) : (
              `連續刷新 ${r.refreshes.toLocaleString()} 次結束`
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-2.5 p-4">
          <p className="text-xs text-[var(--text-muted)]">
            {hasGoal
              ? `${ctx.goal.label}　${ctx.progress.cleared}/${ctx.goal.keys.length}`
              : "未設定目標"}
            {capped &&
              `　（已達 ${REFRESH_CAP.toLocaleString()} 次上限，只刷新了 ${r.refreshes.toLocaleString()} 次）`}
          </p>

          {r.reached && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
              第 <b className="tabular-nums">{r.reached.at.toLocaleString()}</b> 次刷新時湊齊，
              花了{" "}
              <b className="tabular-nums text-rose-500 dark:text-rose-400">
                NT${r.reached.spent.toLocaleString()}
              </b>
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-center">
            <div>
              <p className="text-[0.65rem] font-bold tracking-wider text-[var(--text-muted)]">
                這輪刷新
              </p>
              <p className="text-lg font-black tabular-nums">{r.refreshes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold tracking-wider text-[var(--text-muted)]">
                這輪花了
              </p>
              <p className="text-lg font-black tabular-nums text-rose-500 dark:text-rose-400">
                NT${r.spent.toLocaleString()}
              </p>
            </div>
          </div>

          {hasGoal && missing.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
                還沒出現 {missing.length} 件
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((g) => (
                  <PrizeTile key={g.key} prize={ctx.pool.prizes[g.key]} size={36} />
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-2.5">
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
              累計上架過（格數）
            </p>
            <div className="flex flex-wrap gap-1">
              {CATEGORY_ORDER.map((c) => {
                const row = totals.find((x) => x.category === c);
                if (!row || row.seen === 0) return null;
                return (
                  <span
                    key={c}
                    className="rounded-full px-2 py-0.5 text-[0.7rem] font-bold text-white"
                    style={{ background: CATEGORY_META[c].deep }}
                  >
                    {CATEGORY_META[c].short} {row.seen}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 連續刷新次數輸入 + 快捷鈕。刷幾次就是幾次，不設預算、不追目標——單純好懂。 */
export function AutoCountInput({ ctx }: { ctx: MerchantCtx }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="opacity-70">連續刷新</span>
      <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-1.5">
        <input
          type="number"
          min={1}
          max={REFRESH_CAP}
          step={10}
          value={ctx.autoCount}
          onChange={(e) =>
            ctx.setAutoCount(Math.min(REFRESH_CAP, Math.max(1, Number(e.target.value) || 1)))
          }
          className="w-16 bg-transparent px-1 py-1 text-right font-bold tabular-nums outline-none"
        />
        <span className="pl-0.5 opacity-50">次</span>
      </span>
      {[10, 50, 100, 500].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => ctx.setAutoCount(n)}
          style={ctx.autoCount === n ? { background: "var(--accent)" } : undefined}
          className={`cursor-pointer rounded-md px-1.5 py-0.5 font-bold transition-colors ${
            ctx.autoCount === n
              ? "text-[var(--on-accent)]"
              : "bg-[var(--accent-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {n}
        </button>
      ))}
      <span className="opacity-50">
        約 NT${refreshPrice(ctx.autoCount, ctx.pool.ticket).toLocaleString()}
      </span>
    </span>
  );
}

/** 目標裡每件商品出現過幾次。 */
export function GoalDots({ ctx }: { ctx: MerchantCtx }) {
  if (ctx.goal.keys.length === 0) {
    return <p className="text-xs opacity-60">還沒挑任何商品。</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ctx.progress.items.map((g) => {
        const prize = ctx.pool.prizes[g.key];
        return (
          <div key={g.key} className="flex w-12 flex-col items-center gap-0.5">
            <span
              className="rounded-lg p-0.5"
              style={{ background: g.seen > 0 ? CATEGORY_META[prize.category].color : "transparent" }}
            >
              <PrizeTile prize={prize} size={38} dimmed={g.seen === 0} />
            </span>
            <span
              className={`text-[0.65rem] font-bold tabular-nums ${
                g.seen > 0 ? "text-emerald-600 dark:text-emerald-400" : "opacity-45"
              }`}
            >
              {g.seen > 0 ? `出現 ${g.seen}` : "未出現"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 上架過的商品清單：依類別、再由稀有到常見。 */
export function useCollected(ctx: MerchantCtx) {
  return useMemo(
    () =>
      [...ctx.view.counts]
        .map(([key, n]) => ({ prize: ctx.pool.prizes[key], n }))
        .sort(
          (a, b) =>
            CATEGORY_META[a.prize.category].order - CATEGORY_META[b.prize.category].order ||
            a.prize.rate - b.prize.rate,
        ),
    [ctx.view.counts, ctx.pool],
  );
}
