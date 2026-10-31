// 怪物數值／屬性抗性的兩塊面板。刻意「不」標 "use client"：兩者都是純函式、沒有
// 任何 hook 或事件處理，所以查詢頁（client）與 /monsters/[id] 詳情頁（server，
// 要把內容真的印進 HTML 給爬蟲看）可以共用同一份。改動時別在這裡引入 state。
import { parseElemAttr, type MobStats } from "@/data/drops";

export const STAT_LABELS: [keyof MobStats, string][] = [
  ["maxHP", "HP"],
  ["maxMP", "MP"],
  ["exp", "經驗值"],
  ["PADamage", "物理攻擊"],
  ["MADamage", "魔法攻擊"],
  ["PDDamage", "物理防禦"],
  ["MDDamage", "魔法防禦"],
  ["acc", "命中率"],
  ["eva", "迴避率"],
];

export function StatsPanel({ stats }: { stats: MobStats }) {
  const rows = STAT_LABELS.filter(([key]) => stats[key] !== undefined);
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {rows.map(([key, label]) => (
        <div
          key={key}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-center"
        >
          <div className="text-sm font-semibold tabular-nums">
            {(stats[key] as number).toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function ElemPanel({ stats }: { stats: MobStats }) {
  const elem = parseElemAttr(stats.elemAttr);
  const groups: [string, string[]][] = [
    ["弱點", elem.weak],
    ["抗性", elem.resist],
    ["免疫", elem.immune],
  ];
  if (groups.every(([, list]) => list.length === 0)) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold" style={{ color: "var(--accent-text)" }}>
        屬性
      </span>
      {groups.map(([label, list]) =>
        list.map((e) => (
          <span
            key={label + e}
            className={`rounded-full border px-2.5 py-1 ${
              label === "弱點"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {label === "弱點"
              ? `弱${e}`
              : label === "抗性"
                ? `抗${e}`
                : `免疫${e}`}
          </span>
        )),
      )}
    </div>
  );
}
