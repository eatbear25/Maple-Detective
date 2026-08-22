"use client";

/**
 * 【原型用，不是正式功能】技能查詢左欄「職業清單」的四種版型。
 *
 * 問題：未來視分頁要列 1→2→3→4 轉整條職業線，現在每一階都往右縮一格，
 * 260px 的欄位裡出現四層階梯＋三條連接線，看起來很雜。
 * 做法：同一條路由 `/skills?variant=`：
 *   now = 現況（四層縮排）
 *   A   = 兩層：1 轉當群組標題，2 轉是分支小標，3/4 轉平列在分支底下
 *   B   = 分支卡：一條分支一張小卡，卡內是 1→2→3→4 的橫排膠囊，零縮排
 *   C   = 零縮排平列：全部靠左，只用左邊的階段圓徽與分支分隔線表達層級
 *
 * 選定之後：贏的那版重寫進 page.tsx，這個檔案與 prototype-switcher 一起刪掉。
 */

import { Telescope } from "lucide-react";
import { skills, isReleased, type Job } from "@/data/skills";

export const VARIANTS = ["now", "A", "B", "C"] as const;
export const VARIANT_LABELS: Record<string, string> = {
  now: "現況：四層縮排",
  A: "A：兩層（分支小標）",
  B: "B：分支卡＋橫排膠囊",
  C: "C：零縮排平列",
};

export type ColumnProps = {
  jobs: Job[];
  hits: Record<string, Job[] | unknown[]> | null;
  selected: string;
  onPick: (id: string) => void;
};

const countOf = (jobId: string, hits: ColumnProps["hits"]) =>
  hits ? (hits[jobId]?.length ?? 0) : skills.filter((s) => s.job === jobId).length;

/** 依職業群分組，順序沿用資料本身（已經是職業線順序）。 */
function byGroup(list: Job[]) {
  const out: { group: string; groupName: string; jobs: Job[] }[] = [];
  for (const j of list) {
    let g = out.find((x) => x.group === j.group);
    if (!g) out.push((g = { group: j.group, groupName: j.groupName, jobs: [] }));
    g.jobs.push(j);
  }
  return out;
}

/** 某個 2 轉分支底下的 3/4 轉。 */
function descendants(list: Job[], branch: Job) {
  const out: Job[] = [];
  let cur = branch;
  for (;;) {
    const next = list.find((j) => j.from === cur.id);
    if (!next) break;
    out.push(next);
    cur = next;
  }
  return out;
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="themed-scroll max-h-[40vh] space-y-3 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5 lg:sticky lg:top-20 lg:max-h-[78vh] lg:self-start lg:border-0 lg:p-0 lg:pr-2">
    {children}
  </div>
);

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--text-muted)]">
      {children}
    </div>
  );
}

/** 一列職業。tone 控制字級/密度，讓深階的項目可以壓小而不必再縮排。 */
function JobRow({
  job,
  hits,
  selected,
  onPick,
  tone = "normal",
  showTier = true,
}: ColumnProps & { job: Job; tone?: "normal" | "sub"; showTier?: boolean }) {
  const dimmed = hits !== null && !hits[job.id];
  const active = selected === job.id;
  return (
    <button
      disabled={dimmed}
      onClick={() => onPick(job.id)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 text-left transition-colors ${
        tone === "sub" ? "py-1 text-[13px]" : "py-1.5 text-sm"
      } ${
        active
          ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
          : "hover:bg-[var(--accent-soft)]/50"
      } ${dimmed ? "cursor-default opacity-35" : "cursor-pointer"}`}
    >
      {showTier && (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[9px] font-semibold text-[var(--accent)] ${
            tone === "sub" ? "h-4 w-4" : "h-5 w-5"
          }`}
        >
          {job.tier}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{job.name}</span>
      {!isReleased(job.id) && (
        <Telescope size={12} aria-label="尚未開放" className="shrink-0 text-[var(--text-muted)]" />
      )}
      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
        {countOf(job.id, hits)}
      </span>
    </button>
  );
}

export function JobColumnVariants({ variant, ...p }: ColumnProps & { variant: string }) {
  if (variant === "A") return <VariantA {...p} />;
  if (variant === "B") return <VariantB {...p} />;
  if (variant === "C") return <VariantC {...p} />;
  return <VariantNow {...p} />;
}

/** 現況：每一階往右縮一格，最多四層。 */
function VariantNow(p: ColumnProps) {
  const base = Math.min(...p.jobs.map((j) => j.tier), 99);
  return (
    <Frame>
      {byGroup(p.jobs).map((g) => (
        <div key={g.group}>
          <GroupTitle>{g.groupName}系</GroupTitle>
          {g.jobs.map((job) => (
            <div
              key={job.id}
              style={{ marginLeft: (job.tier - base) * 12 }}
              className={job.tier > base ? "border-l border-[var(--border)] pl-1" : ""}
            >
              <JobRow {...p} job={job} />
            </div>
          ))}
        </div>
      ))}
    </Frame>
  );
}

/**
 * A：兩層。1 轉併進群組標題那一列，2 轉是分支小標，3/4 轉平列在分支底下（同一層）。
 * 縮排只剩一格，但「誰是誰的分支」還看得出來。
 */
function VariantA(p: ColumnProps) {
  return (
    <Frame>
      {byGroup(p.jobs).map((g) => {
        const first = g.jobs.find((j) => j.tier === 1);
        const branches = g.jobs.filter((j) => j.tier === 2);
        const orphans = g.jobs.filter((j) => j.tier > 2 && !branches.length);
        return (
          <div key={g.group} className="space-y-1">
            <GroupTitle>{g.groupName}系</GroupTitle>
            {first && <JobRow {...p} job={first} />}
            {branches.map((b) => {
              const kids = descendants(p.jobs, b);
              return (
                <div key={b.id}>
                  <JobRow {...p} job={b} />
                  {kids.length > 0 && (
                    <div className="ml-3 border-l border-[var(--border)] pl-1">
                      {kids.map((k) => (
                        <JobRow {...p} key={k.id} job={k} tone="sub" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {orphans.map((o) => (
              <JobRow {...p} key={o.id} job={o} />
            ))}
          </div>
        );
      })}
    </Frame>
  );
}

/**
 * B：一條分支一張小卡，卡內把 1→2→3→4 轉排成橫向膠囊（會自動換行）。
 * 完全沒有縮排，垂直高度也最短；代價是職業名長的時候膠囊會擠。
 */
function VariantB(p: ColumnProps) {
  return (
    <Frame>
      {byGroup(p.jobs).map((g) => {
        const first = g.jobs.find((j) => j.tier === 1);
        const branches = g.jobs.filter((j) => j.tier === 2);
        return (
          <div key={g.group} className="space-y-1.5">
            <GroupTitle>{g.groupName}系</GroupTitle>
            {first && <JobRow {...p} job={first} />}
            {branches.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-[var(--border)] p-1.5"
              >
                <div className="flex flex-wrap gap-1">
                  {[b, ...descendants(p.jobs, b)].map((j) => {
                    const dimmed = p.hits !== null && !p.hits[j.id];
                    const active = p.selected === j.id;
                    return (
                      <button
                        key={j.id}
                        disabled={dimmed}
                        onClick={() => p.onPick(j.id)}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                            : "border-[var(--border)] hover:border-[var(--accent)]"
                        } ${dimmed ? "cursor-default opacity-35" : "cursor-pointer"}`}
                      >
                        <span className="text-[9px] text-[var(--text-muted)]">{j.tier}</span>
                        {j.name}
                        {!isReleased(j.id) && <Telescope size={10} className="opacity-60" />}
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {countOf(j.id, p.hits)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </Frame>
  );
}

/**
 * C：零縮排。全部靠左對齊，層級只靠左邊的階段圓徽表示，
 * 分支與分支之間用一條細分隔線斷開。最乾淨，但層級感最弱。
 */
function VariantC(p: ColumnProps) {
  return (
    <Frame>
      {byGroup(p.jobs).map((g) => {
        const first = g.jobs.find((j) => j.tier === 1);
        const branches = g.jobs.filter((j) => j.tier === 2);
        return (
          <div key={g.group}>
            <GroupTitle>{g.groupName}系</GroupTitle>
            {first && <JobRow {...p} job={first} />}
            {branches.map((b) => (
              <div
                key={b.id}
                className="mt-1 border-t border-dashed border-[var(--border)] pt-1"
              >
                {[b, ...descendants(p.jobs, b)].map((j) => (
                  <JobRow {...p} key={j.id} job={j} tone={j.tier > 2 ? "sub" : "normal"} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </Frame>
  );
}
