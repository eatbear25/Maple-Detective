"use client";

/**
 * 技能配點模擬。選一個 2 轉職業 → 同時攤開 1 轉 + 2 轉 + 3 轉技能配點
 * （2 轉與 3 轉是一對一，選 2 轉就等於選了整條職業線）。
 *
 * 規則（2026-08-22 對話定案，數字來自玩家實測與 Artale Skill Simulator 對照；
 * 2026-10-17 開 3 轉時依客戶端轉職對白修正）：
 * - 預算用「到某等級為止累計可得的 SP」表示（每升 1 級 +3、每次轉職 +1）。
 * - **SP 只能往前補、不能往後留**：2／3／4 轉教官都會擋「SP 剩太多」，3 轉教官
 *   講得最白——「至少必須消耗完到70級為止獲得的所有SP，我才能幫你進行3轉」
 *   （ScriptString/job3.wzjson）。所以第 k 轉以後的技能，最多只能用第 k 轉之後
 *   才拿到的 SP（3 轉技能 ≤ 151 點），這是滑桿的硬上限；反過來，轉職後拿到的
 *   SP 可以回頭點前面的技能（沿用 2026-08-22 的定案）。
 * - 「轉職前要點完」是下限，滑桿不擋（逼人先點滿 1 轉才能配 2 轉太難用），
 *   改成里程碑條沒達標時提示。
 * - 各階段**並排顯示、不做切換**——配後面的轉職時還看得到前面的餘額。
 * - **配點用滑桿，不用 +/- 按鈕**（2026-08-22 改）：要點滿 20 級得按 20 次加號，
 *   或想直接跳到 15 級也只能一下一下按，成本太高。改成拖滑桿直接到位，另外給
 *   「點滿」「歸零」兩個一鍵操作；鍵盤方向鍵仍可 ±1 微調。
 * - 嚴格模式：滑桿拖過頭會被夾在合法範圍，而且**一定附上原因**。默默夾住不說話
 *   會讓人以為壞了。
 * - 降級也會擋：把前置技能降到不足會讓已點的技能違規。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronsUp,
  RotateCcw,
  Link2,
  Check,
  ArrowRight,
} from "lucide-react";
import {
  jobs,
  jobById,
  skillById,
  skillsOf,
  levelText,
  type Job,
  type Skill,
} from "@/data/skills";
import { SkillIcon } from "../skill-icon";

/**
 * 每升 1 級 +3 SP、每次轉職 +1 SP。法師 8 級轉職、其他 10 級。
 * POOLS[i] 是轉到第 i+2 轉之前累計拿到的 SP；最後一筆 = 模擬的總預算。
 * 3 轉階段（70→120 級）每個職業都是 +1 + 50×3 = 151 點。
 */
const POOLS: { at: number; label: string; mage: number; other: number }[] = [
  { at: 30, label: "30 級前（2 轉前要點完）", mage: 67, other: 61 },
  { at: 70, label: "70 級前（3 轉前要點完）", mage: 188, other: 182 },
  { at: 120, label: "120 級前（4 轉需求）", mage: 339, other: 333 },
];

const STORAGE_KEY = "maple-detective-skill-build";

type Build = Record<string, number>;

const secondJobs = jobs.filter((j) => j.tier === 2);

/**
 * 職業按鈕的「2 轉 → 3 轉」兩段文字。按鈕原本只寫 2 轉名字，玩家會以為只能配到 2 轉
 * （2026-10-17 回報）；左邊的職業群小標（劍士）接上按鈕剛好讀成整條線。
 * 兩段結尾的括號一樣時只留後面那個：「巫師 → 魔導士（火、毒）」。
 */
function lineLabel(second: Job): [string, string] {
  const third = jobs.find((j) => j.from === second.id)?.name ?? "";
  const tail = second.name.match(/（[^）]*）$/)?.[0];
  return tail && third.endsWith(tail)
    ? [second.name.slice(0, -tail.length), third]
    : [second.name, third];
}

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
  const thirdJob = jobs.find((j) => j.from === jobId)!;
  /** tiers[0] = 1 轉技能、[1] = 2 轉、[2] = 3 轉 */
  const tiers = useMemo(
    () => [skillsOf(firstJob.id), skillsOf(jobId), skillsOf(thirdJob.id)],
    [firstJob.id, jobId, thirdJob.id],
  );
  const pool = useMemo(() => tiers.flat(), [tiers]);
  const tierOf = useMemo(
    () =>
      Object.fromEntries(
        tiers.flatMap((list, i) => list.map((s) => [s.id, i + 1] as const)),
      ) as Record<string, number>,
    [tiers],
  );
  const maxSp = capOf(job, POOLS.length - 1);

  // 網址帶配點時優先吃網址，否則吃 localStorage 草稿。
  // 這兩樣只有瀏覽器有，SSR 階段讀不到，所以只能掛載後才設 state（提前讀會 hydration 不一致）。
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ job: jobId, build }));
  }, [jobId, build, loaded]);

  /** 每一轉各點了幾點，index 0 = 1 轉 */
  const usedByTier = useMemo(
    () => tiers.map((list) => list.reduce((a, s) => a + (build[s.id] ?? 0), 0)),
    [tiers, build],
  );
  const used = usedByTier.reduce((a, n) => a + n, 0);
  const left = maxSp - used;

  /**
   * 某一轉的技能還能再加幾點，以及是哪一條限制卡住（from = 1 是總預算，
   * from = k 是「第 k 轉以後的技能只能用第 k 轉之後拿到的 SP」）。
   */
  const spRoom = useCallback(
    (tier: number) => {
      let room = left;
      let from = 1;
      for (let k = 2; k <= tier; k++) {
        const budget = maxSp - capOf(job, k - 2);
        const usedFrom = usedByTier.slice(k - 1).reduce((a, n) => a + n, 0);
        if (budget - usedFrom < room) {
          room = budget - usedFrom;
          from = k;
        }
      }
      return {
        room,
        from,
        budget: from === 1 ? maxSp : maxSp - capOf(job, from - 2),
      };
    },
    [left, maxSp, job, usedByTier],
  );

  /** 最低能降到幾級：有別的技能拿它當前置、而且那個技能點著的話就降不下去。 */
  const minLevel = useCallback(
    (s: Skill) => {
      let floor = 0;
      for (const o of pool) {
        if ((build[o.id] ?? 0) > 0) floor = Math.max(floor, o.req?.[s.id] ?? 0);
      }
      return floor;
    },
    [pool, build],
  );

  /** 最高能點到幾級：受「前置技能」與「剩餘 SP」（含各轉的額度）限制。 */
  const maxLevel = useCallback(
    (s: Skill) => {
      const cur = build[s.id] ?? 0;
      for (const [rid, need] of Object.entries(s.req ?? {})) {
        if ((build[rid] ?? 0) < need) return cur; // 前置不足：只能維持現況
      }
      return Math.max(0, Math.min(s.maxLevel, cur + spRoom(tierOf[s.id]).room));
    },
    [build, spRoom, tierOf],
  );

  /** 夾住的時候要說得出原因，不然使用者只會覺得滑桿壞了。 */
  const clampReason = useCallback(
    (s: Skill, target: number, lo: number, hi: number) => {
      if (target > hi) {
        for (const [rid, need] of Object.entries(s.req ?? {})) {
          const have = build[rid] ?? 0;
          if (have < need) {
            const rn = skillById[rid]?.name ?? `#${rid}`;
            return `〈${s.name}〉要先把前置〈${rn}〉點到 ${need} 級（目前 ${have}）`;
          }
        }
        if (hi >= s.maxLevel) return `〈${s.name}〉已經是上限 ${s.maxLevel} 級`;
        const { from, budget } = spRoom(tierOf[s.id]);
        if (from > 1) {
          const tiersText = from === 3 ? "3 轉" : "2、3 轉";
          return `${tiersText}技能只能用 ${POOLS[from - 2].at} 級之後拿到的 ${budget} 點（轉職前得先把之前的 SP 點完），只夠把〈${s.name}〉點到 ${hi} 級`;
        }
        return `SP 只夠把〈${s.name}〉點到 ${hi} 級`;
      }
      if (target < lo) {
        const dep = pool.find(
          (o) => (build[o.id] ?? 0) > 0 && (o.req?.[s.id] ?? 0) >= lo,
        );
        return `〈${dep?.name ?? "後面的技能"}〉還點著，〈${s.name}〉不能低於 ${lo} 級`;
      }
      return null;
    },
    [build, pool, spRoom, tierOf],
  );

  /** 直接把技能設到某一級：滑桿、點滿、歸零共用這一條路。 */
  const setLevel = (s: Skill, target: number) => {
    const lo = minLevel(s);
    const hi = maxLevel(s);
    const next = Math.max(lo, Math.min(hi, Math.round(target)));
    setWhy(clampReason(s, target, lo, hi));
    setBuild((b) => ((b[s.id] ?? 0) === next ? b : { ...b, [s.id]: next }));
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
          分配好技能點後也可以按下分享，複製網址給朋友或自己收藏。
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
            // 小標一欄、按鈕一欄：窄螢幕按鈕換行時才會對齊在按鈕區，不會鑽到小標底下
            <div key={g} className="flex items-start gap-1.5">
              <span className="w-14 shrink-0 pt-1 text-xs text-[var(--text-muted)]">
                {list[0]?.groupName}
              </span>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {list.map((j) => {
                  const [second, third] = lineLabel(j);
                  return (
                    <button
                      key={j.id}
                      onClick={() => {
                        setJobId(j.id);
                        setBuild({});
                        setWhy(null);
                      }}
                      aria-label={`${j.name} → ${jobs.find((t) => t.from === j.id)?.name}`}
                      className={`cursor-pointer inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                        jobId === j.id
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                          : "border-[var(--border)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {second}
                      <ArrowRight size={11} className="shrink-0 opacity-60" />
                      {third}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 技能卡在左、預算面板在右側 sticky（手機版預算在最上面）。
          原本是吸頂大卡，蓋在技能卡上很吵；側欄捲到哪都看得到又不擋內容。 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_230px]">
        <aside className="order-first lg:order-last lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">已配點</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">{used}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  / {maxSp}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                剩餘 {left} SP
              </div>
            </div>

            <div className="space-y-1 border-t border-[var(--border)] pt-2 text-xs">
              {[firstJob, job, thirdJob].map((j, i) => (
                <div
                  key={j.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-[var(--text-muted)]">
                    {i + 1} 轉 {j.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {usedByTier[i]} 點
                    {/* 只有最後一轉有固定上限：前面的轉職可以用後面拿到的點數補 */}
                    {i === 2 && (
                      <span className="font-normal text-[var(--text-muted)]">
                        {" "}
                        / {maxSp - capOf(job, 1)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-[var(--border)] pt-2">
              {POOLS.map((p, i) => {
                const cap = capOf(job, i);
                // 30 級前只算 1 轉技能、70 級前算 1+2 轉、最後一條算全部
                const spent = usedByTier
                  .slice(0, i + 1)
                  .reduce((a, n) => a + n, 0);
                const later = usedByTier
                  .slice(i + 1)
                  .reduce((a, n) => a + n, 0);
                const short = i < POOLS.length - 1 && later > 0 && spent < cap;
                return (
                  <PoolMeter
                    key={p.at}
                    label={p.label}
                    cap={cap}
                    used={spent}
                    warn={
                      short
                        ? `還差 ${cap - spent} 點才能 ${i + 2} 轉`
                        : undefined
                    }
                  />
                );
              })}
              <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                轉職教官會檢查：之前拿到的 SP 要先點完才能轉職，所以 3
                轉技能只能用 70
                級之後的點數；之後拿到的點數則可以回頭補前面的技能。
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--border)] pt-2">
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

            {why && (
              <div className="rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-xs leading-relaxed">
                ⚠️ {why}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {[firstJob, job, thirdJob].map((j, i) => (
            <SkillGrid
              key={j.id}
              title={`${i + 1} 轉・${j.name}`}
              list={tiers[i]}
              build={build}
              minLevel={minLevel}
              maxLevel={maxLevel}
              setLevel={setLevel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 某個里程碑（30 級前／70 級前／120 級前）點了多少：30 級前只算 1 轉技能、
 * 70 級前算 1+2 轉——也就是「轉職前要點完的那些點數，夠不夠點在當時學得到的技能上」。
 * **顯示值夾在額度內**：1 轉技能可以用後面拿到的點數補，點了 80 點時寫「80 / 61」
 * 只會讓人以為算錯（實際意思是「30 級前的 61 點早就夠了」）。
 * 後面的轉職有點數、這條卻沒達標時給 warn（例：1 轉只點 40 點卻點了 2 轉技能）。
 */
function PoolMeter({
  label,
  cap,
  used,
  warn,
}: {
  label: string;
  cap: number;
  used: number;
  warn?: string;
}) {
  const shown = Math.min(used, cap);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] text-[var(--text-muted)]">
          {label}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums">
          <span className="font-semibold">{shown}</span>
          <span className="text-[var(--text-muted)]"> / {cap}</span>
        </span>
      </div>
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <span
          className="block h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${(shown / cap) * 100}%` }}
        />
      </span>
      {warn && (
        <span className="mt-0.5 block text-[10px] font-medium text-[var(--accent)]">
          {warn}
        </span>
      )}
    </div>
  );
}

function SkillGrid({
  title,
  list,
  build,
  minLevel,
  maxLevel,
  setLevel,
}: {
  title: string;
  list: Skill[];
  build: Build;
  minLevel: (s: Skill) => number;
  maxLevel: (s: Skill) => number;
  setLevel: (s: Skill, target: number) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="border-b border-[var(--border)] pb-2 text-sm font-semibold">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const lv = build[s.id] ?? 0;
          const shown = lv === 0 ? 1 : lv;
          const lo = minLevel(s);
          const hi = maxLevel(s);
          const canRaise = hi > lv;
          const canClear = lo < lv;
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
                <SkillIcon id={s.id} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {s.name}
                  </span>
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
                <p className="text-xs leading-relaxed">
                  {levelText(s, shown) || "—"}
                </p>
              </div>

              {/* 滑桿直接拖到要的等級；拖過頭會被夾住並在上方說明原因 */}
              <div className="space-y-2 p-3">
                <input
                  type="range"
                  min={0}
                  max={s.maxLevel}
                  value={lv}
                  onChange={(e) => setLevel(s, Number(e.target.value))}
                  aria-label={`${s.name} 等級`}
                  title={`拖動設定等級（方向鍵可 ±1）・目前可點到 ${hi} 級`}
                  className="w-full cursor-pointer accent-[var(--accent)]"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {lv}
                    <span className="text-[var(--text-muted)]">
                      {" "}
                      / {s.maxLevel}
                    </span>
                    {hi > lv && (
                      <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">
                        可到 {hi}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <QuickBtn
                      onClick={() => setLevel(s, hi)}
                      disabled={!canRaise}
                      label={`把 ${s.name} 點到可負擔的上限`}
                    >
                      <ChevronsUp size={12} /> 點滿
                    </QuickBtn>
                    <QuickBtn
                      onClick={() => setLevel(s, 0)}
                      disabled={!canClear}
                      label={`把 ${s.name} 的點數收回`}
                    >
                      歸零
                    </QuickBtn>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QuickBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center gap-0.5 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-30 dark:opacity-50"
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
