// 怪物詳情的共用區塊：查詢頁 /monsters 右欄（client）與 /monsters/[id] 完整頁面（server）
// 長得一樣，差別只在掉落物點了做什麼、出沒地圖點了做什麼，那兩塊各自寫在自己的頁面。
// 刻意「不」標 "use client"：這裡全是純函式、沒有任何 hook 或事件處理，詳情頁才能
// 把內容真的印進 HTML 給爬蟲看。改動時別在這裡引入 state。
import type { ReactNode } from "react";
import { Crown, Telescope } from "lucide-react";
import {
  itemName,
  itemInfo,
  itemIconSrc,
  mobIconSrc,
  parseElemAttr,
  type DropMonster,
  type MobStats,
} from "@/data/drops";
import { GameIcon } from "./game-icon";
import { equipSubtitle } from "./equip-format";
import { WELL_BG } from "./styles";

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

/**
 * 詳情最上面：圖示、名稱、#ID＋按鈕，右邊三個大數字（等級／掉落物／出沒地圖）。
 * 手機版右邊那排收掉（掉落物、出沒地圖的數量在各區段標題上都有），等級改寫在 #ID 前面。
 */
export function MonsterHero({
  monster: m,
  dropCount,
  heading: H = "h2",
  headingId,
  big = false,
  actions,
}: {
  monster: DropMonster;
  dropCount: number;
  /** 查詢頁右欄是 h2（頁面的 h1 是「怪物掉落查詢」），完整頁面是 h1 */
  heading?: "h1" | "h2";
  /** 給外層 <article aria-labelledby> 指的 id */
  headingId?: string;
  /** 完整頁面的圖示與標題大一號 */
  big?: boolean;
  actions?: ReactNode;
}) {
  const lv = m.level != null ? `${m.level}` : "?";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
      <div
        className={`grid shrink-0 place-items-center rounded-[14px] ${WELL_BG} ${
          big ? "h-[60px] w-[60px] sm:h-20 sm:w-20" : "h-[60px] w-[60px] sm:h-[72px] sm:w-[72px]"
        }`}
      >
        <GameIcon
          src={mobIconSrc(m.id)}
          alt={m.name}
          fallback="👾"
          className={big ? "h-[52px] w-[52px] sm:h-[72px] sm:w-[72px]" : "h-[52px] w-[52px] sm:h-16 sm:w-16"}
        />
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
        <H
          id={headingId}
          className={`flex flex-wrap items-center gap-2 font-bold leading-tight ${
            big ? "text-[22px] sm:text-[30px]" : "text-[22px] sm:text-[26px]"
          }`}
        >
          <span className="break-words">{m.name}</span>
          {m.stats.boss ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-text)]">
              <Crown size={12} />
              BOSS
            </span>
          ) : null}
          {!m.released && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
              <Telescope size={12} />
              未實裝
            </span>
          )}
        </H>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[13px] tabular-nums text-[var(--text-muted)]">
            <span className="sm:hidden">Lv.{lv}・</span>#{m.id}
          </span>
          {actions}
        </div>
      </div>
      <dl className="hidden gap-[22px] text-center sm:flex">
        {(
          [
            ["等級", lv],
            ["掉落物", dropCount],
            ["出沒地圖", m.maps.length],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="flex flex-col-reverse gap-0.5">
            <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
            <dd className="text-lg font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * 數值格子。0 的格子字變淡，一眼看得出哪幾項是有值的。
 * 用 flex 不用 grid：一般的怪電腦版九格剛好排一列（手機三格一列），但未來視的 BOSS
 * HP 有到 2,090,000,000 的，格子要能跟著數字變寬，不能截斷（min-w-fit）。
 */
export function StatsPanel({ stats }: { stats: MobStats }) {
  const rows = STAT_LABELS.filter(([key]) => stats[key] !== undefined);
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-1.5">
      {rows.map(([key, label]) => {
        const v = stats[key] as number;
        return (
          <div
            key={key}
            className="flex min-w-fit grow basis-[calc((100%-12px)/3)] flex-col gap-0.5 rounded-[10px] bg-[var(--bg)] px-2.5 py-2 sm:basis-[72px] sm:px-3 sm:py-2.5"
          >
            <dt className="text-[11px] text-[var(--text-muted)] sm:text-xs">{label}</dt>
            <dd
              className={`text-[15px] tabular-nums sm:text-base ${
                v === 0 ? "font-medium text-[var(--text-muted)] opacity-70" : "font-bold"
              }`}
            >
              {v.toLocaleString()}
            </dd>
          </div>
        );
      })}
    </dl>
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
      <span className="mr-0.5 font-bold text-[var(--text-muted)]">屬性</span>
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

/** 詳情裡的一個區段（掉落物、出沒地圖…）：上面一條分隔線，標題右邊放一句說明 */
export function DetailSection({
  id,
  title,
  count,
  note,
  heading: H = "h3",
  children,
}: {
  id: string;
  title: ReactNode;
  count?: string;
  note?: ReactNode;
  heading?: "h2" | "h3";
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-5 sm:px-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <H id={id} className="flex items-center gap-1.5 text-base font-bold">
          {title}
          {count && (
            <span className="text-sm font-medium text-[var(--text-muted)]">{count}</span>
          )}
        </H>
        {note && <p className="text-xs text-[var(--text-muted)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** 掉落物卡片的內容（圖示＋名稱＋裝備的「帽子・Lv.5」）。外框是按鈕還是連結由頁面決定 */
export function DropTileBody({ id }: { id: number }) {
  const name = itemName(id);
  const sub = equipSubtitle(id, itemInfo(id)?.eq);
  return (
    <>
      <span
        className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 ${WELL_BG}`}
      >
        <GameIcon src={itemIconSrc(id)} alt="" fallback="📦" className="h-8 w-8" />
      </span>
      <span className="flex min-w-0 flex-col text-[13px] leading-snug sm:text-sm">
        <span className="break-words">{name}</span>
        {sub && <span className="text-[11px] text-[var(--text-muted)] sm:text-xs">{sub}</span>}
      </span>
    </>
  );
}
