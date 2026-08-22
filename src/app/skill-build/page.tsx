"use client";

/**
 * 技能配點模擬。選一個 2 轉職業 → 同時攤開 1 轉 + 2 轉技能配點。
 *
 * 規則（2026-08-22 對話定案，數字來自玩家實測與 Artale Skill Simulator 對照）：
 * - SP 是**累計共用池**，不是各轉獨立：1 轉沒點完的會留到 2 轉，2 轉後也還能回頭
 *   加 1 轉技能。所以預算用「到某等級為止累計可得的 SP」表示。
 * - 兩個階段**並排顯示、不做切換**——配 2 轉時還看得到 1 轉的餘額。
 * - 嚴格模式：超額或前置不足時按鈕點不下去，但一定附上原因。純 disabled 不說原因
 *   會讓人反覆亂點卻不知道卡在哪。
 * - 降級也會擋：把前置技能降到不足會讓已點的技能違規。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Minus,
  Plus,
  RotateCcw,
  Link2,
  Check,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  jobs,
  jobById,
  skillById,
  skillsOf,
  skillIconSrc,
  levelText,
  type Job,
  type Skill,
} from "@/data/skills";

/** 每升 1 級 +3 SP、每次轉職 +1 SP。法師 8 級轉職、其他 10 級。 */
const POOLS: { at: number; label: string; mage: number; other: number }[] = [
  { at: 30, label: "30 級前（2 轉需求）", mage: 67, other: 61 },
  { at: 70, label: "70 級前（3 轉需求）", mage: 188, other: 182 },
];

const STORAGE_KEY = "maple-detective-skill-build";

type Build = Record<string, number>;

const secondJobs = jobs.filter((j) => j.tier === 2);

function isMage(job: Job) {
  return job.group === "magician";
}

function capOf(job: Job, i: number) {
  return isMage(job) ? POOLS[i].mage : POOLS[i].other;
}

export default function SkillBuildPage() {
  const [jobId, setJobId] = useState<string>(secondJobs[0].id);
  const [build, setBuild] = useState<Build>({});
  const [why, setWhy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const job = jobById[jobId];
  const firstJob = jobById[job.from!];
  const tier1 = useMemo(() => skillsOf(firstJob.id), [firstJob.id]);
  const tier2 = useMemo(() => skillsOf(jobId), [jobId]);
  const pool = useMemo(() => [...tier1, ...tier2], [tier1, tier2]);
  const maxSp = capOf(job, POOLS.length - 1);

  // 網址帶配點時優先吃網址，否則吃 localStorage 草稿
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("b");
    const j = params.get("j");
    if (j && jobById[j]?.tier === 2) setJobId(j);
    if (fromUrl) {
      setBuild(decodeBuild(fromUrl));
      setLoaded(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.job && jobById[saved.job]?.tier === 2) {
        setJobId(saved.job);
        setBuild(saved.build ?? {});
      }
    } catch {
      /* 草稿壞掉就當沒有 */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ job: jobId, build }));
  }, [jobId, build, loaded]);

  const used = useMemo(
    () => pool.reduce((a, s) => a + (build[s.id] ?? 0), 0),
    [pool, build],
  );
  const usedTier2 = useMemo(
    () => tier2.reduce((a, s) => a + (build[s.id] ?? 0), 0),
    [tier2, build],
  );
  const left = maxSp - used;

  const blockPlus = useCallback(
    (s: Skill): string | null => {
      const cur = build[s.id] ?? 0;
      if (cur >= s.maxLevel) return `已經是上限 ${s.maxLevel} 級`;
      if (left <= 0) return "剩餘 SP 不足";
      for (const [rid, need] of Object.entries(s.req ?? {})) {
        const have = build[rid] ?? 0;
        if (have < need) {
          const rn = skillById[rid]?.name ?? `#${rid}`;
          return `需要先把〈${rn}〉點到 ${need} 級（目前 ${have}）`;
        }
      }
      return null;
    },
    [build, left],
  );

  const blockMinus = useCallback(
    (s: Skill): string | null => {
      const cur = build[s.id] ?? 0;
      if (cur <= 0) return null;
      const dep = pool.find(
        (o) => (build[o.id] ?? 0) > 0 && (o.req?.[s.id] ?? 0) > cur - 1,
      );
      return dep ? `〈${dep.name}〉還點著，這個不能降到 ${dep.req![s.id]} 級以下` : null;
    },
    [build, pool],
  );

  const act = (s: Skill, dir: 1 | -1) => {
    const reason = dir === 1 ? blockPlus(s) : blockMinus(s);
    if (reason) {
      setWhy(reason);
      return;
    }
    setWhy(null);
    setBuild((b) => ({ ...b, [s.id]: (b[s.id] ?? 0) + dir }));
  };

  const share = async () => {
    const url = `${window.location.origin}/skill-build?j=${jobId}&b=${encodeBuild(build)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">技能配點模擬</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          選一個 2 轉職業，1 轉與 2 轉技能一起配。
          <Link
            href="/skills"
            className="ml-2 inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
          >
            <Sparkles size={12} /> 技能查詢
          </Link>
        </p>
      </div>

      {/* 職業選擇：依職業群分列 */}
      <div className="space-y-2">
        {["warrior", "magician", "bowman", "thief", "pirate"].map((g) => {
          const list = secondJobs.filter((j) => j.group === g);
          return (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-14 shrink-0 text-xs text-[var(--text-muted)]">
                {list[0]?.groupName}
              </span>
              {list.map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    setJobId(j.id);
                    setBuild({});
                    setWhy(null);
                  }}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                    jobId === j.id
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  {j.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* 預算：兩階段並排 */}
      <div className="sticky top-14 z-10 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-[var(--text-muted)]">已配點 </span>
            <span className="text-lg font-bold tabular-nums">{used}</span>
            <span className="text-[var(--text-muted)]"> 點・剩餘 {left}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBuild({});
                setWhy(null);
              }}
              className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <RotateCcw size={12} /> 重置
            </button>
            <button
              onClick={share}
              className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {copied ? <Check size={12} /> : <Link2 size={12} />}
              {copied ? "已複製" : "分享"}
            </button>
          </div>
        </div>
        <div className="space-y-1.5 border-t border-[var(--border)] pt-2">
          {POOLS.map((p, i) => (
            <PoolRow
              key={p.at}
              label={p.label}
              cap={capOf(job, i)}
              used={used}
              blocked={p.at === 30 && usedTier2 > 0 ? "還沒轉職，做不到" : null}
            />
          ))}
        </div>
        {why && (
          <div className="rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs">⚠️ {why}</div>
        )}
      </div>

      <SkillGrid
        title={`1 轉・${firstJob.name}`}
        list={tier1}
        build={build}
        blockPlus={blockPlus}
        blockMinus={blockMinus}
        act={act}
      />
      <SkillGrid
        title={`2 轉・${job.name}`}
        list={tier2}
        build={build}
        blockPlus={blockPlus}
        blockMinus={blockMinus}
        act={act}
      />
    </div>
  );
}

function PoolRow({
  label,
  cap,
  used,
  blocked,
}: {
  label: string;
  cap: number;
  used: number;
  blocked: string | null;
}) {
  const over = used > cap;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
        <span
          className={`block h-full rounded-full transition-all ${
            over || blocked ? "bg-[var(--text-muted)]" : "bg-[var(--accent)]"
          }`}
          style={{ width: `${Math.min(100, (used / cap) * 100)}%` }}
        />
      </span>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums">
        <span className={over ? "text-[var(--text-muted)]" : "font-semibold"}>{used}</span>
        <span className="text-[var(--text-muted)]"> / {cap}</span>
      </span>
      <span className="hidden w-40 shrink-0 items-center gap-1 text-[10px] text-[var(--text-muted)] sm:flex">
        {blocked && <Lock size={10} />}
        {blocked ?? (over ? "這個階段點不完" : "達得到")}
      </span>
    </div>
  );
}

function SkillGrid({
  title,
  list,
  build,
  blockPlus,
  blockMinus,
  act,
}: {
  title: string;
  list: Skill[];
  build: Build;
  blockPlus: (s: Skill) => string | null;
  blockMinus: (s: Skill) => string | null;
  act: (s: Skill, dir: 1 | -1) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="border-b border-[var(--border)] pb-2 text-sm font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const lv = build[s.id] ?? 0;
          const shown = lv === 0 ? 1 : lv;
          const plusWhy = blockPlus(s);
          const minusWhy = blockMinus(s);
          const reqEntries = Object.entries(s.req ?? {});
          return (
            <div
              key={s.id}
              className={`flex flex-col rounded-xl border transition-colors ${
                lv > 0
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/30"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-start gap-2.5 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={skillIconSrc(s.id)} alt="" className="h-10 w-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  {reqEntries.length ? (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {reqEntries.map(([rid, need]) => (
                        <span
                          key={rid}
                          className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                        >
                          需 {skillById[rid]?.name ?? `#${rid}`} {need} 級
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                      無前置技能
                    </span>
                  )}
                </span>
              </div>

              <div className="mx-3 flex-1 rounded-lg bg-[var(--bg)] px-2.5 py-2">
                <div className="mb-1 text-[10px] font-semibold text-[var(--text-muted)]">
                  {lv === 0 ? "Lv.1（預覽）" : `Lv.${lv}`}
                </div>
                <p className="text-xs leading-relaxed">{levelText(s, shown) || "—"}</p>
              </div>

              <div className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${(lv / s.maxLevel) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <StepBtn
                    why={lv <= 0 ? "已經是 0 級" : minusWhy}
                    onClick={() => act(s, -1)}
                    label="減一級"
                  >
                    <Minus size={14} />
                  </StepBtn>
                  <span className="w-12 text-center text-sm font-semibold tabular-nums">
                    {lv}
                    <span className="text-[var(--text-muted)]"> / {s.maxLevel}</span>
                  </span>
                  <StepBtn why={plusWhy} onClick={() => act(s, 1)} label="加一級">
                    <Plus size={14} />
                  </StepBtn>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StepBtn({
  why,
  onClick,
  label,
  children,
}: {
  why: string | null;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={why ?? label}
      aria-label={label}
      disabled={!!why}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] transition-colors ${
        why
          ? "cursor-not-allowed opacity-30"
          : "cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}

/** 網址用的緊湊編碼：技能 id 後 4 碼 + 等級，用 . 分隔。 */
function encodeBuild(build: Build) {
  return Object.entries(build)
    .filter(([, lv]) => lv > 0)
    .map(([id, lv]) => `${id}-${lv}`)
    .join(".");
}

function decodeBuild(s: string): Build {
  const out: Build = {};
  for (const part of s.split(".")) {
    const [id, lv] = part.split("-");
    const n = Number(lv);
    if (skillById[id] && Number.isFinite(n) && n > 0) {
      out[id] = Math.min(n, skillById[id].maxLevel);
    }
  }
  return out;
}
