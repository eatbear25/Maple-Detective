"use client";

/**
 * 技能查詢。左欄列職業、右欄技能詳情。
 *
 * 幾個刻意的決定（2026-08-22 對話定案）：
 * - 搜尋只吃「技能名」與「職業名」，不吃敘述——敘述吃進去的話「攻擊」會命中三百個技能。
 * - 搜尋時左欄仍然是職業清單，只是沒命中的職業灰掉、命中的就地展開命中的技能。
 *   （改成切換兩種清單會讓畫面跳來跳去，定位成本高。）
 * - 詳情預設只顯示「目前選定等級」的敘述，等級用滑桿調；要看全部再開表格。
 *   30 行純文字一次攤開對閱讀是負擔。
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Telescope, Table2, Target } from "lucide-react";
import {
  jobs,
  skills,
  jobById,
  skillById,
  isReleased,
  skillIconSrc,
  levelText,
  cleanDesc,
  LEVEL_LABELS,
  type Job,
  type Skill,
} from "@/data/skills";

type Tab = "released" | "future";

export default function SkillsPage() {
  const [tab, setTab] = useState<Tab>("released");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [showTable, setShowTable] = useState(false);

  const q = query.trim().toLowerCase();
  const tabJobs = useMemo(
    () => jobs.filter((j) => (tab === "released" ? isReleased(j.id) : !isReleased(j.id))),
    [tab],
  );

  /** 每個職業命中的技能；沒搜尋時為 null（代表整個職業都算命中）。 */
  const hits = useMemo(() => {
    if (!q) return null;
    const map: Record<string, Skill[]> = {};
    for (const j of tabJobs) {
      const jobHit = j.name.toLowerCase().includes(q) || j.groupName.toLowerCase().includes(q);
      const list = skills.filter(
        (s) => s.job === j.id && (jobHit || s.name.toLowerCase().includes(q)),
      );
      if (list.length) map[j.id] = list;
    }
    return map;
  }, [q, tabJobs]);

  const total = hits ? Object.values(hits).reduce((a, l) => a + l.length, 0) : null;
  const skill = selected ? skillById[selected] : null;

  const pick = (id: string) => {
    setSelected(id);
    setLevel(1);
    setShowTable(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">技能查詢</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          每個職業的技能與逐級效果。資料來自遊戲用戶端。
        </p>

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

        <div className="mt-3 flex gap-1.5">
          {(["released", "future"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSelected(null);
              }}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                tab === t
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                  : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              {t === "released" ? "現行版本" : "未來視"}
            </button>
          ))}
          <span className="self-center text-xs text-[var(--text-muted)]">
            {tab === "released" ? "1 轉與 2 轉" : "3 轉與 4 轉，尚未開放"}
          </span>
        </div>

        {total !== null && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            命中 {total} 個技能
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:gap-10">
        <JobColumn
          jobs={tabJobs}
          hits={hits}
          selected={selected}
          onPick={pick}
        />
        <div>
          {skill ? (
            <SkillDetail
              skill={skill}
              level={level}
              setLevel={setLevel}
              showTable={showTable}
              setShowTable={setShowTable}
              onPick={pick}
            />
          ) : (
            <div className="hidden text-sm text-[var(--text-muted)] lg:block">
              從左邊選一個技能。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobColumn({
  jobs: list,
  hits,
  selected,
  onPick,
}: {
  jobs: Job[];
  hits: Record<string, Skill[]> | null;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // 搜尋中一律展開命中的職業；沒搜尋時只展開手動點開的那個
  return (
    <div className="themed-scroll max-h-[45vh] space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5 lg:max-h-[72vh] lg:border-0 lg:p-0 lg:pr-2">
      {list.map((job) => {
        const hit = hits ? hits[job.id] : null;
        const dimmed = hits !== null && !hit;
        const expanded = hits ? !!hit : open === job.id;
        const shown = hit ?? skills.filter((s) => s.job === job.id);
        return (
          <div key={job.id} className={dimmed ? "opacity-35" : ""}>
            <button
              disabled={dimmed}
              onClick={() => setOpen(open === job.id ? null : job.id)}
              className={`cursor-pointer flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                expanded
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                  : "hover:bg-[var(--accent-soft)]/50"
              } ${dimmed ? "cursor-default" : ""}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent)]">
                {job.tier}轉
              </span>
              <span className="min-w-0 flex-1 truncate">{job.name}</span>
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                {hit ? `${hit.length} / ${shown.length}` : shown.length}
              </span>
            </button>
            {expanded && (
              <div className="mb-1 ml-3 border-l border-[var(--border)] pl-2">
                {shown.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPick(s.id)}
                    className={`cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                      selected === s.id
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "hover:bg-[var(--accent-soft)]/50"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={skillIconSrc(s.id)} alt="" className="h-6 w-6 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {list.length === 0 && (
        <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
          沒有符合的職業。
        </div>
      )}
    </div>
  );
}

function SkillDetail({
  skill,
  level,
  setLevel,
  showTable,
  setShowTable,
  onPick,
}: {
  skill: Skill;
  level: number;
  setLevel: (n: number) => void;
  showTable: boolean;
  setShowTable: (b: boolean) => void;
  onPick: (id: string) => void;
}) {
  const job = jobById[skill.job];
  const stats = skill.levels[level - 1] ?? {};
  const shownStats = LEVEL_LABELS.filter((f) => stats[f.key] !== undefined);
  const desc = cleanDesc(skill.desc);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={skillIconSrc(skill.id)} alt="" className="h-11 w-11 shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{skill.name}</h2>
              {!isReleased(skill.job) && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                  <Telescope size={12} /> 未來視
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {job.name}（{job.tier} 轉）・等級上限 {skill.maxLevel}
              {skill.masterLevel !== undefined &&
                `（需精通書，初始 ${skill.masterLevel}）`}
            </div>
          </div>
        </div>
        {desc && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{desc}</p>}
      </div>

      {skill.req && (
        <section>
          <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">前置技能</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(skill.req).map(([rid, lv]) => {
              const r = skillById[rid];
              return (
                <button
                  key={rid}
                  onClick={() => r && onPick(rid)}
                  disabled={!r}
                  className="cursor-pointer flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-default disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={skillIconSrc(rid)} alt="" className="h-4 w-4" />
                  {r ? r.name : `#${rid}`} {lv} 級
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[var(--text-muted)]">
            等級 <span className="text-sm text-[var(--text)]">{level}</span> / {skill.maxLevel}
          </div>
          <button
            onClick={() => setShowTable(!showTable)}
            className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Table2 size={12} /> {showTable ? "收起全等級" : "看全部等級"}
          </button>
        </div>

        <input
          type="range"
          min={1}
          max={skill.maxLevel}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="技能等級"
        />

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm leading-relaxed">{levelText(skill, level) || "（無敘述）"}</p>
          {shownStats.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--border)] pt-3 text-xs">
              {shownStats.map((f) => (
                <div key={f.key} className="flex gap-1.5">
                  <dt className="text-[var(--text-muted)]">{f.label}</dt>
                  <dd className="font-semibold tabular-nums">
                    {stats[f.key]}
                    {f.unit ?? ""}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {showTable && <LevelTable skill={skill} current={level} onPickLevel={setLevel} />}
    </div>
  );
}

function LevelTable({
  skill,
  current,
  onPickLevel,
}: {
  skill: Skill;
  current: number;
  onPickLevel: (n: number) => void;
}) {
  const cols = LEVEL_LABELS.filter((f) => skill.levels.some((l) => l[f.key] !== undefined));
  return (
    <section>
      <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">全等級</div>
      <div className="themed-scroll max-h-[55vh] overflow-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-2 font-semibold">等級</th>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">效果</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skill.maxLevel }, (_, i) => i + 1).map((lv) => {
              const st = skill.levels[lv - 1] ?? {};
              return (
                <tr
                  key={lv}
                  onClick={() => onPickLevel(lv)}
                  className={`cursor-pointer border-b border-[var(--border)] last:border-0 transition-colors ${
                    lv === current ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]/40"
                  }`}
                >
                  <td className="px-3 py-1.5 font-semibold tabular-nums">{lv}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                      {st[c.key] !== undefined ? `${st[c.key]}${c.unit ?? ""}` : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">
                    {skill.levelDesc[lv - 1] || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
