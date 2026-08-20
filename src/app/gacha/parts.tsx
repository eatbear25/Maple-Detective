"use client";

/* /gacha 的共用元件：道具挑選器、自動模式結算彈窗、預算輸入、目標進度。
   版面本體在 page.tsx。 */

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { TIER_META, TIER_ORDER, type Prize } from "@/data/gacha";
import { PULL_CAP, tierCounts } from "./engine";
import { PrizeTile } from "./prize-tile";
import type { GachaCtx } from "./use-gacha";

export function CustomPicker({
  ctx,
  tone,
  onClose,
}: {
  ctx: GachaCtx;
  tone: "light" | "dark";
  onClose: () => void;
}) {
  const byTier = useMemo(() => {
    const m = new Map<string, Prize[]>();
    for (const p of ctx.pool.prizes) {
      const arr = m.get(p.tier) ?? [];
      arr.push(p);
      m.set(p.tier, arr);
    }
    return m;
  }, [ctx.pool]);

  function setCount(itemId: number, n: number) {
    const next = new Map(ctx.custom);
    if (n <= 0) next.delete(itemId);
    else next.set(itemId, n);
    ctx.setCustom(next);
  }

  return (
    <div
      className={`mt-3 rounded-md border p-2 ${
        tone === "dark"
          ? "border-white/10 bg-black/30"
          : "border-[var(--border)] bg-[var(--bg)]"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold">挑選要蒐集的道具</span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer opacity-60 hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto p-1">
        {TIER_ORDER.filter((t) => byTier.has(t)).map((t) => (
          <div key={t}>
            <p
              className="mb-1 text-[0.65rem] font-bold"
              style={{ color: TIER_META[t].color }}
            >
              {TIER_META[t].label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(byTier.get(t) ?? []).map((p) => {
                const n =
                  p.itemId === null ? 0 : (ctx.custom.get(p.itemId) ?? 0);
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() =>
                      p.itemId !== null && setCount(p.itemId, n > 0 ? 0 : 1)
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (p.itemId !== null) setCount(p.itemId, n + 1);
                    }}
                    title={`${p.name}｜左鍵選取／取消，右鍵 +1`}
                    className={`cursor-pointer rounded-lg p-0.5 transition ${
                      n > 0
                        ? "bg-amber-400"
                        : "bg-transparent hover:bg-black/10"
                    }`}
                  >
                    <PrizeTile
                      prize={p}
                      size={34}
                      count={n}
                      dimmed={n === 0}
                      tone={tone}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[0.65rem] opacity-60">
        左鍵選取／取消，右鍵可增加需要數量。
      </p>
    </div>
  );
}

export function ResultModal({
  ctx,
  onClose,
}: {
  ctx: GachaCtx;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const r = ctx.result;
  if (!r) return null;
  const achieved = ctx.progress.done && ctx.goal.groups.length > 0;
  const missing = ctx.progress.groups.filter((g) => !g.done);
  const capped = r.pulls < r.requested;
  const totals = tierCounts(
    { pulls: 0, spent: 0, counts: ctx.state.counts, log: [] },
    ctx.pool,
  );

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
            {achieved ? (
              <span className="text-emerald-500">目標達成 ✓</span>
            ) : (
              `連抽 ${r.pulls.toLocaleString()} 次結束`
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
            {ctx.goal.groups.length
              ? `${ctx.goal.label}　${ctx.progress.cleared}/${ctx.goal.groups.length}`
              : "未設定目標"}
            {capped &&
              `　（已達 ${r.requested.toLocaleString()} 次上限，只抽了 ${r.pulls.toLocaleString()} 次）`}
          </p>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-center">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                這輪抽了
              </p>
              <p className="text-lg font-black tabular-nums">
                {r.pulls.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                這輪花了
              </p>
              <p className="text-lg font-black tabular-nums text-rose-500">
                NT${r.spent.toLocaleString()}
              </p>
            </div>
          </div>

          {!achieved && missing.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
                還差 {missing.length} 項
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((g, i) => {
                  const p = ctx.prizeById.get(g.any[0]);
                  return p ? (
                    <PrizeTile key={i} prize={p} size={36} tone="light" />
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-2.5">
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
              獲得總覽
            </p>
            <div className="flex flex-wrap gap-1">
              {TIER_ORDER.map((t) => {
                const row = totals.find((x) => x.tier === t);
                if (!row || row.got === 0) return null;
                return (
                  <span
                    key={t}
                    className="rounded-full px-2 py-0.5 text-[0.7rem] font-bold text-white"
                    style={{ background: TIER_META[t].deep }}
                  >
                    {TIER_META[t].short} {row.got}
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

/** 連抽次數輸入 + 快捷鈕。抽幾次就是幾次，不設預算、不追目標——單純好懂。 */
export function AutoCountInput({
  ctx,
  tone,
}: {
  ctx: GachaCtx;
  tone: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="opacity-70">連抽</span>
      <span
        className={`inline-flex items-center rounded-md border px-1.5 ${
          dark
            ? "border-white/20 bg-black/30"
            : "border-[var(--border)] bg-[var(--bg)]"
        }`}
      >
        <input
          type="number"
          min={1}
          max={PULL_CAP}
          step={10}
          value={ctx.autoCount}
          onChange={(e) =>
            ctx.setAutoCount(
              Math.min(PULL_CAP, Math.max(1, Number(e.target.value) || 1)),
            )
          }
          className="w-16 bg-transparent px-1 py-1 text-right font-bold tabular-nums outline-none"
        />
        <span className="pl-0.5 opacity-50">次</span>
      </span>
      {[50, 100, 500].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => ctx.setAutoCount(n)}
          style={
            ctx.autoCount === n ? { background: "var(--accent)" } : undefined
          }
          className={`cursor-pointer rounded-md px-1.5 py-0.5 font-bold transition-colors ${
            ctx.autoCount === n
              ? "text-white"
              : dark
                ? "bg-white/10 hover:bg-white/20"
                : "bg-[var(--accent-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {n}
        </button>
      ))}
      <span className="opacity-50">
        約 NT$
        {(
          Math.floor(ctx.autoCount / 10) * ctx.pool.ticket.bundle10 +
          (ctx.autoCount % 10) * ctx.pool.ticket.single
        ).toLocaleString()}
      </span>
    </span>
  );
}

/** 目標的 7 個條件進度。變體 A/B/C 用不同的排法包它。 */
export function GoalDots({
  ctx,
  tone,
}: {
  ctx: GachaCtx;
  tone: "light" | "dark";
}) {
  if (ctx.goal.groups.length === 0) {
    return <p className="text-xs opacity-60">尚未選擇任何道具。</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ctx.progress.groups.map((g, i) => {
        const prize = ctx.prizeById.get(g.any[0]);
        if (!prize) return null;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span
              className="rounded-lg p-0.5"
              style={{
                background: g.done
                  ? TIER_META[prize.tier].color
                  : "transparent",
              }}
            >
              <PrizeTile prize={prize} size={38} dimmed={!g.done} tone={tone} />
            </span>
            <span
              className={`text-[0.65rem] font-bold tabular-nums ${
                g.done ? "text-emerald-500" : "opacity-45"
              }`}
            >
              {g.have}/{g.need}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function useCollected(ctx: GachaCtx) {
  return useMemo(
    () =>
      [...ctx.view.counts]
        .map(([id, n]) => ({ prize: ctx.prizeById.get(id), n }))
        .filter((x): x is { prize: Prize; n: number } => !!x.prize)
        .sort(
          (a, b) =>
            TIER_META[a.prize.tier].order - TIER_META[b.prize.tier].order ||
            b.n - a.n,
        ),
    [ctx.view.counts, ctx.prizeById],
  );
}

export function useOddsSearch(ctx: GachaCtx) {
  const [q, setQ] = useState("");
  const byTier = useMemo(() => {
    const kw = q.trim();
    const m = new Map<string, Prize[]>();
    for (const p of ctx.pool.prizes) {
      if (kw && !p.name.includes(kw)) continue;
      const arr = m.get(p.tier) ?? [];
      arr.push(p);
      m.set(p.tier, arr);
    }
    return m;
  }, [ctx.pool, q]);
  return { q, setQ, byTier };
}
