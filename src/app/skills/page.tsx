"use client";

/**
 * 技能查詢。左欄依職業群分層列職業、右欄是該職業的技能總覽列。
 *
 * 幾個刻意的決定（2026-08-22 對話定案，右欄版型比過四種原型後選定）：
 * - **點職業，不點技能**：左欄選職業，右欄一次列出該職業所有技能。
 * - **右欄是「總覽列＋就地展開」**：一技能一列（圖示＋名稱＋上限＋滿級效果摘要），
 *   點列就地長出全等級表格，可以同時開多個，另有「全部展開」。全部攤開的版本
 *   一個職業會拉到十幾個螢幕高，總覽列讓「這個職業有哪些技能」一眼看得完。
 * - 左欄**依職業群分組、依轉職階段縮排**：狂戰士／見習騎士／槍騎兵是劍士底下的
 *   三條分支，平鋪成同一層會看起來像互不相干的職業。
 * - 搜尋只吃「技能名」與「職業名」，不吃敘述——敘述吃進去的話「攻擊」會命中三百個技能。
 *   搜尋時左欄仍是職業清單（沒命中的灰掉），右欄只留命中的技能。
 */

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, Telescope, Target, ChevronDown, Rows3 } from "lucide-react";
import {
  jobs,
  skills,
  jobById,
  skillById,
  isReleased,
  cleanDesc,
  LEVEL_LABELS,
  type Skill,
} from "@/data/skills";
import { SkillIcon } from "../skill-icon";
// 【原型】左欄職業清單版型比較中，選定後把贏的那版寫回這個檔案、刪掉這兩個 import
import { PrototypeSwitcher, useVariant } from "../prototype-switcher";
import {
  JobColumnVariants,
  VARIANTS,
  VARIANT_LABELS,
} from "./job-column.prototype";

type Tab = "released" | "future";

/**
 * 未來視分頁**連 1、2 轉一起列**，只是把 3/4 轉標上望遠鏡——職業線是
 * 劍士→狂戰士→十字軍→英雄，只列 3/4 轉會看不出誰接在誰後面。
 */
const jobsOf = (tab: Tab) =>
  tab === "released" ? jobs.filter((j) => isReleased(j.id)) : jobs;

/** 切分頁時預設落在哪個職業：未來視要落在第一個「還沒開放」的職業，不然會停在劍士。 */
const defaultJobOf = (tab: Tab) =>
  (tab === "released" ? jobsOf(tab)[0] : jobs.find((j) => !isReleased(j.id))!)
    .id;

export default function SkillsPage() {
  // useSearchParams（原型切換器）在靜態頁需要 Suspense 包住
  return (
    <Suspense fallback={null}>
      <SkillsInner />
    </Suspense>
  );
}

function SkillsInner() {
  const variant = useVariant([...VARIANTS]);
  const [tab, setTab] = useState<Tab>("released");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>(jobsOf("released")[0].id);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const paneRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const tabJobs = useMemo(() => jobsOf(tab), [tab]);

  /** 每個職業命中的技能；沒搜尋時為 null（代表整個職業都算命中）。 */
  const hits = useMemo(() => {
    if (!q) return null;
    const map: Record<string, Skill[]> = {};
    for (const j of tabJobs) {
      const jobHit =
        j.name.toLowerCase().includes(q) ||
        j.groupName.toLowerCase().includes(q);
      const list = skills.filter(
        (s) => s.job === j.id && (jobHit || s.name.toLowerCase().includes(q)),
      );
      if (list.length) map[j.id] = list;
    }
    return map;
  }, [q, tabJobs]);

  // 換分頁、或搜尋結果不含目前職業時，自動落到第一個有東西的職業（右欄不要開天窗）。
  // 用推導而不是 useEffect 改 state——後者會多一輪 render，而且 lint 也擋。
  const jobId = useMemo(() => {
    if (!tabJobs.some((j) => j.id === picked)) return tabJobs[0].id;
    if (hits && !hits[picked])
      return tabJobs.find((j) => hits[j.id])?.id ?? picked;
    return picked;
  }, [tabJobs, hits, picked]);

  const total = hits
    ? Object.values(hits).reduce((a, l) => a + l.length, 0)
    : null;
  const job = jobById[jobId];
  const shown = hits
    ? (hits[jobId] ?? [])
    : skills.filter((s) => s.job === jobId);
  const allOpen = shown.length > 0 && shown.every((s) => open[s.id]);

  /** 展開某個技能並捲過去；技能不在目前職業就先切過去。 */
  const goTo = (id: string) => {
    const s = skillById[id];
    if (!s) return;
    if (s.job !== jobId) {
      // 目前分頁列得到那個職業就別換分頁：3 轉技能的前置常常是 2 轉技能，
      // 在未來視裡跳過去時留在未來視才不會整份清單縮掉。
      if (!tabJobs.some((j) => j.id === s.job)) {
        setTab(isReleased(s.job) ? "released" : "future");
      }
      setQuery("");
      setPicked(s.job);
    }
    setOpen((o) => ({ ...o, [id]: true }));
    // 切職業會重繪右欄，等一幀再捲
    requestAnimationFrame(() => {
      document
        .getElementById(`skill-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const pickJob = (id: string) => {
    setPicked(id);
    setOpen({});
    paneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">技能查詢</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {tab === "released" ? "1 轉與 2 轉技能一覽" : "3 轉與 4 轉尚未開放"}
        </p>

        {/* 分頁樣式跟怪物掉落頁一致（同一組 現行/未來視 的概念，不該長得不一樣） */}
        <div className="mt-4 inline-flex rounded-full border border-[var(--border)] p-0.5 text-sm">
          {(
            [
              ["released", "現行版本", null],
              ["future", "未來視", Telescope],
            ] as [Tab, string, typeof Telescope | null][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setPicked(defaultJobOf(key));
                setOpen({});
              }}
              className={`cursor-pointer flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
                tab === key
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {Icon && <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋技能名或職業名"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="清除搜尋"
                className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <Link
            href="/skill-build"
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Target size={13} /> 配點模擬
          </Link>
        </div>

        {total !== null && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            命中 {total} 個技能
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] lg:gap-10">
        <JobColumnVariants
          variant={variant}
          jobs={tabJobs}
          hits={hits}
          selected={jobId}
          onPick={pickJob}
        />

        <div ref={paneRef} className="scroll-mt-20 space-y-3">
          {shown.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">
              這個職業沒有符合的技能。
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
                <h2 className="text-2xl font-bold">{job.name}</h2>
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                  {job.tier} 轉
                </span>
                {!isReleased(jobId) && (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Telescope size={12} /> 未來視
                  </span>
                )}
                <span className="text-sm text-[var(--text-muted)]">
                  {hits
                    ? `命中 ${shown.length} 個技能`
                    : `共 ${shown.length} 個技能`}
                </span>
                <button
                  onClick={() =>
                    setOpen(
                      allOpen
                        ? {}
                        : Object.fromEntries(shown.map((s) => [s.id, true])),
                    )
                  }
                  className="cursor-pointer ml-auto flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Rows3 size={12} /> {allOpen ? "全部收合" : "全部展開"}
                </button>
              </div>

              {shown.map((s) => (
                <SkillRow
                  key={s.id}
                  skill={s}
                  open={!!open[s.id]}
                  onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  onGoTo={goTo}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <PrototypeSwitcher keys={[...VARIANTS]} labels={VARIANT_LABELS} current={variant} />
    </div>
  );
}

/** 一技能一列：收合時是摘要，展開才長出全等級表格。 */
function SkillRow({
  skill,
  open,
  onToggle,
  onGoTo,
}: {
  skill: Skill;
  open: boolean;
  onToggle: () => void;
  onGoTo: (id: string) => void;
}) {
  const desc = cleanDesc(skill.desc);
  const reqEntries = Object.entries(skill.req ?? {});
  return (
    <section
      id={`skill-${skill.id}`}
      className="scroll-mt-20 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <button
        onClick={onToggle}
        className="cursor-pointer flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[var(--accent-soft)]/40"
      >
        <SkillIcon id={skill.id} size={32} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-bold">{skill.name}</span>
            <span className="text-[11px] text-[var(--text-muted)]">
              上限 {skill.maxLevel}
              {skill.masterLevel !== undefined && "（需精通書）"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
            {skill.levelDesc[skill.maxLevel - 1] || desc || skill.h}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-[var(--border)] p-3">
          {desc && (
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {desc}
            </p>
          )}
          {reqEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">前置</span>
              {reqEntries.map(([rid, lv]) => {
                const r = skillById[rid];
                return (
                  <button
                    key={rid}
                    onClick={() => r && onGoTo(rid)}
                    disabled={!r}
                    className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-default disabled:opacity-50"
                  >
                    <SkillIcon id={rid} size={14} />
                    {r ? r.name : `#${rid}`} {lv} 級
                  </button>
                );
              })}
            </div>
          )}
          <LevelTable skill={skill} />
        </div>
      )}
    </section>
  );
}

function LevelTable({ skill }: { skill: Skill }) {
  const cols = LEVEL_LABELS.filter((f) =>
    skill.levels.some((l) => l[f.key] !== undefined),
  );
  return (
    <div className="themed-scroll max-h-[40vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)]">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-[var(--surface)]">
          <tr className="border-b border-[var(--border)]">
            <th className="px-2.5 py-1.5 font-semibold">等級</th>
            {cols.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-2.5 py-1.5 font-semibold"
              >
                {c.label}
              </th>
            ))}
            <th className="px-2.5 py-1.5 font-semibold">效果</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: skill.maxLevel }, (_, i) => i + 1).map((lv) => {
            const st = skill.levels[lv - 1] ?? {};
            return (
              <tr
                key={lv}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--accent-soft)]/40"
              >
                <td className="px-2.5 py-1 font-semibold tabular-nums">{lv}</td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className="whitespace-nowrap px-2.5 py-1 tabular-nums"
                  >
                    {st[c.key] !== undefined
                      ? `${st[c.key]}${c.unit ?? ""}`
                      : "—"}
                  </td>
                ))}
                <td className="px-2.5 py-1 text-[var(--text-muted)]">
                  {skill.levelDesc[lv - 1] || skill.h || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
