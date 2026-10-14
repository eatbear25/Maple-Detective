"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Disc3,
  Lock,
  Puzzle,
  RotateCcw,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import { loungeRecords } from "@/data/party-quests";
import { itemIconSrc } from "@/data/drops";
import { goddessStatue, type StatueSpot } from "@/data/goddess-statue";
import { GameIcon } from "../../monsters/game-icon";
import {
  candidates,
  feasibleResponses,
  formatSolution,
  PROBES,
  RESPONSES,
  TOTAL_PEOPLE,
  type Answers,
  type ProbeKey,
  type Response,
} from "./sealed-room";
import {
  BY_ORDER,
  orderText,
  STORAGE_PLATFORMS,
  STORAGE_TOTAL,
} from "./storage";

type Tab = "lounge" | "sealed" | "storage" | "statue";

const TABS: [Tab, string, typeof Disc3][] = [
  ["lounge", "休息室", Disc3],
  ["sealed", "封印房", Lock],
  ["storage", "倉庫", Warehouse],
  ["statue", "女神像", Puzzle],
];

const DEFAULT_TAB: Tab = "lounge";
const TAB_KEYS = new Set<string>(TABS.map(([k]) => k));
const isTab = (v: string | null): v is Tab => !!v && TAB_KEYS.has(v);

const PANELS: Record<Tab, () => React.JSX.Element> = {
  lounge: LoungeTab,
  sealed: SealedRoomTab,
  storage: StorageTab,
  statue: StatueTab,
};

export default function TowerOfGoddessPage() {
  return (
    <Suspense fallback={null}>
      <TowerOfGoddessApp />
    </Suspense>
  );
}

function TowerOfGoddessApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(urlTab) ? urlTab : DEFAULT_TAB);
  // 切換方向：往右的分頁從右邊滑進來，往左的從左邊
  const [dir, setDir] = useState(1);
  const tabIndex = TABS.findIndex(([k]) => k === tab);

  // 網址上的 ?tab= 是分享連結用的來源之一：直接改網址列（含瀏覽器上一頁）
  // 也要能切分頁，所以跟著同步過來。
  useEffect(() => {
    if (isTab(urlTab) && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只跟著網址走，不要讓 tab 自己觸發它
  }, [urlTab]);

  // 滑動指示器：量出目前分頁按鈕的位置寬度，讓底色滑過去而不是直接跳
  const barRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const el = btnRefs.current[tabIndex];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [tabIndex]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    // 字型載入完 / 視窗縮放後按鈕寬度會變，指示器要跟著重量
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const select = (key: Tab, index: number) => {
    if (key === tab) return;
    setDir(index > tabIndex ? 1 : -1);
    setTab(key);
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  const Panel = PANELS[tab];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">女神之塔</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          組隊任務小工具，切換分頁使用
        </p>

        <div
          ref={barRef}
          role="tablist"
          className="relative mt-4 inline-flex rounded-full border border-[var(--border)] p-0.5 text-sm"
        >
          <span
            aria-hidden
            className={`absolute inset-y-0.5 left-0 rounded-full bg-[var(--accent-soft)] ${
              pill.ready
                ? "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
                : "opacity-0"
            }`}
            style={{
              transform: `translateX(${pill.left}px)`,
              width: `${pill.width}px`,
            }}
          />
          {/* 四個分頁在 390px 寬的手機上，px-4 會差一點點放不下、字被擠成直的，所以窄螢幕縮成 px-3 */}
          {TABS.map(([key, label, Icon], i) => (
            <button
              key={key}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={tab === key}
              onClick={() => select(key, i)}
              className={`relative z-10 cursor-pointer flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors sm:px-4 ${
                tab === key
                  ? "font-medium text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-clip">
        <div
          key={tab}
          className="tab-panel"
          style={
            { "--slide-from": `${dir * 28}px` } as React.CSSProperties
          }
        >
          <Panel />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- 休息室 ------------------------------- */

// 星期幾只有瀏覽器算得準（伺服器時區不一定一樣），所以走
// useSyncExternalStore：伺服器端快照給 null（不標今天），水合後才拿到真值。
const NO_SUBSCRIBE = () => () => {};

function LoungeTab() {
  const today = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => new Date().getDay(),
    () => null,
  );

  const todayRecord = loungeRecords.find((r) => r.day === today);

  return (
    <div className="space-y-6">
      {todayRecord && (
        <div className="flex items-center gap-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--surface)]"
            style={{ boxShadow: `inset 0 0 0 3px ${todayRecord.color}` }}
          >
            <GameIcon
              src={itemIconSrc(todayRecord.itemId)}
              alt={todayRecord.name}
              fallback="💿"
              className="h-8 w-8"
            />
          </span>
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)]">
              今天 · {todayRecord.dayLabel}
            </div>
            <div className="mt-0.5 text-2xl font-bold">
              {todayRecord.colorLabel}
              <span className="ml-2 text-base font-medium text-[var(--text-muted)]">
                {todayRecord.name}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {loungeRecords.map((r) => {
          const isToday = r.day === today;
          return (
            <div
              key={r.day}
              className={`flex flex-col items-center gap-2 rounded-xl border bg-[var(--surface)] px-2 py-4 text-center transition-colors ${
                isToday
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/25"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="text-sm font-semibold">{r.dayLabel}</div>
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${r.color}1f` }}
              >
                <GameIcon
                  src={itemIconSrc(r.itemId)}
                  alt={r.name}
                  fallback="💿"
                  className="h-8 w-8"
                />
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-base font-bold">{r.colorLabel}</span>
              </div>
              <div className="text-[11px] leading-tight text-[var(--text-muted)]">
                {r.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- 封印房 ------------------------------- */

const SLOTS = [
  ["left", "左"],
  ["mid", "中"],
  ["right", "右"],
] as const;

// 每種站法裡，那 1 個人站在第幾個平台（null = 沒人站），畫列首的小示意用
const STAND_AT: Record<ProbeKey, number | null> = {
  empty: null,
  left: 0,
  mid: 1,
  right: 2,
};

/** 三個平台的小示意：實心那格＝這次有人站的位置 */
function StandGlyph({ at }: { at: number | null }) {
  return (
    <span aria-hidden className="flex gap-[3px]">
      {SLOTS.map(([key], i) => (
        <span
          key={key}
          className={`h-2.5 w-2.5 rounded-[3px] border ${
            i === at
              ? "border-[var(--text)] bg-[var(--text)]"
              : "border-[var(--text-muted)]/50"
          }`}
        />
      ))}
    </span>
  );
}

// 玩家多半把視窗縮到遊戲旁邊看，所以整個工具鎖在一張窄卡片裡，
// 排版由上而下：答案（三個平台各站幾人）→ 四列回應 → 狀態，不用左右掃視。
function SealedRoomTab() {
  const [answers, setAnswers] = useState<Answers>({});

  const pool = candidates(answers);
  const solved = pool.length === 1 ? pool[0] : null;
  const contradiction = pool.length === 0;
  const filled = PROBES.filter((p) => answers[p.key] !== undefined).length;

  const pick = (probe: ProbeKey, value: Response) =>
    setAnswers((prev) => ({
      ...prev,
      // 再點同一顆＝取消，方便點錯時修正
      [probe]: prev[probe] === value ? undefined : value,
    }));

  return (
    <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div
        className="grid grid-cols-3 gap-2 p-4"
        aria-live="polite"
        aria-label={
          solved ? `答案 ${formatSolution(solved)}` : "答案還沒確定"
        }
      >
        {SLOTS.map(([key, label]) => (
          <div
            key={key}
            className={`rounded-xl border py-2.5 text-center transition-colors ${
              solved
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-dashed border-[var(--border)] bg-[var(--bg)]"
            }`}
          >
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span
                className={`text-4xl font-bold leading-none tabular-nums ${
                  solved
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)]/35"
                }`}
              >
                {solved ? solved[key] : "?"}
              </span>
              <span className="text-xs text-[var(--text-muted)]">人</span>
            </div>
          </div>
        ))}
        <p className="col-span-3 text-center text-xs text-[var(--text-muted)]">
          三個平台合計 {TOTAL_PEOPLE} 人
        </p>
      </div>

      <div className="border-t border-[var(--border)] px-4 pb-2.5 pt-3">
        <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
          <span>怎麼站</span>
          <span>NPC 說對幾個</span>
        </div>
        {PROBES.map((probe) => {
          const feasible = feasibleResponses(answers, probe.key);
          return (
            <div
              key={probe.key}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <StandGlyph at={STAND_AT[probe.key]} />
                {probe.label}
              </div>
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                {RESPONSES.map((v) => {
                  const active = answers[probe.key] === v;
                  const impossible = !active && !feasible.has(v);
                  return (
                    <button
                      key={v}
                      onClick={() => pick(probe.key, v)}
                      aria-pressed={active}
                      className={`h-9 w-11 cursor-pointer border-l border-[var(--border)] text-base font-bold tabular-nums transition-colors first:rounded-l-[7px] first:border-l-0 last:rounded-r-[7px] focus-visible:relative ${
                        active
                          ? "bg-[var(--accent)] text-[var(--bg)]"
                          : impossible
                            ? "text-[var(--text-muted)]/30 hover:text-[var(--text-muted)]"
                            : "hover:bg-[var(--accent-soft)]"
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-10 items-center justify-between gap-2 border-t border-[var(--border)] py-1.5 pl-4 pr-2.5 text-xs">
        {contradiction ? (
          <span className="flex items-center gap-1.5 font-medium">
            <TriangleAlert size={13} className="shrink-0 text-red-400" />
            回應兜不起來，檢查有沒有點錯
          </span>
        ) : (
          <span
            className={
              solved
                ? "font-medium text-[var(--accent)]"
                : "text-[var(--text-muted)]"
            }
          >
            {solved ? "答案確定了" : `還剩 ${pool.length} 種可能`}
          </span>
        )}
        <button
          onClick={() => setAnswers({})}
          disabled={filled === 0}
          className={TEXT_BUTTON}
        >
          <RotateCcw size={12} />
          重設
        </button>
      </div>
    </div>
  );
}

// 卡片底部的小文字鈕（重設／複製）。沒得按的時候留在原位變淡，
// 不要整顆消失——消失的話旁邊的鈕會跟著位移。
const TEXT_BUTTON =
  "flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40";

/* -------------------------------- 倉庫 -------------------------------- */

// 一樣鎖成窄卡片（玩家把視窗縮在遊戲旁邊看）。平台位置照參考圖畫成左右交錯
// 兩排，最下面那格是第 1 隻——玩家是從底下往上爬（見 storage.ts 註解）。
// 每格跨兩列、左右排差一列，疊起來像磚牆：同一排的格子上下相連，交錯關係
// 還在但中間不會留一堆空洞。擊殺順序一律靠中線放（左排靠右、右排靠左），
// 15 個數字集中在中間一條，眼睛不用左右掃。
function StorageTab() {
  const [done, setDone] = useState(0);
  const [copied, setCopied] = useState(false);

  const next = done < STORAGE_TOTAL ? BY_ORDER[done] : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orderText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 沒有剪貼簿權限就算了，順序畫面上本來就看得到 */
    }
  };

  return (
    <div className="w-full max-w-xs">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div
          className={`flex min-h-[4.25rem] items-center justify-between gap-3 rounded-t-[15px] px-4 py-3 transition-colors ${
            next ? "" : "bg-[var(--accent-soft)]"
          }`}
        >
          {next ? (
            <>
              <div>
                <div className="text-xs text-[var(--text-muted)]">下一隻</div>
                <div className="text-2xl font-bold leading-tight">
                  {next.label}
                </div>
              </div>
              <button
                onClick={() => setDone((n) => n + 1)}
                className="h-10 shrink-0 cursor-pointer rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
              >
                打掉了
              </button>
            </>
          ) : (
            <>
              <span className="text-lg font-bold">15 隻清完了</span>
              <button
                onClick={() => setDone(0)}
                className="h-10 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-medium transition-colors hover:border-[var(--accent)]"
              >
                再一輪
              </button>
            </>
          )}
        </div>

        <div
          className="grid grid-cols-2 gap-x-1.5 gap-y-1 border-y border-[var(--border)] p-3"
          style={{ gridAutoRows: "1rem" }}
        >
          {STORAGE_PLATFORMS.map((p) => {
            const killed = p.order <= done;
            const isNext = next?.order === p.order;
            const left = p.col === "left";
            return (
              <button
                key={p.index}
                style={{
                  gridColumn: left ? 1 : 2,
                  gridRow: `${p.index + 1} / span 2`,
                }}
                onClick={() =>
                  setDone(isNext ? p.order : killed ? p.order - 1 : done)
                }
                disabled={!killed && !isNext}
                aria-label={`第 ${p.order} 隻，位置 ${p.label}`}
                className={`flex items-center justify-between rounded-lg border px-2.5 transition-colors ${
                  left ? "flex-row-reverse" : ""
                } ${
                  isNext
                    ? "cursor-pointer border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                    : killed
                      ? "cursor-pointer border-transparent text-[var(--text-muted)] opacity-45 hover:opacity-80"
                      : "cursor-default border-[var(--border)] bg-[var(--bg)]"
                }`}
              >
                <span className="w-6 text-center text-lg font-bold leading-none tabular-nums">
                  {p.order}
                </span>
                <span
                  className={`text-xs leading-none ${
                    isNext ? "opacity-80" : "text-[var(--text-muted)]"
                  }`}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between py-1.5 pl-4 pr-2.5 text-xs text-[var(--text-muted)]">
          <span>
            已打{" "}
            <b className="tabular-nums text-[var(--text)]">{done}</b> /{" "}
            {STORAGE_TOTAL}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={copy} className={TEXT_BUTTON}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "已複製" : "複製順序"}
            </button>
            <button
              onClick={() => setDone(0)}
              disabled={done === 0}
              className={TEXT_BUTTON}
            >
              <RotateCcw size={12} />
              重設
            </button>
          </div>
        </div>
      </div>

      <p className="mt-2 px-1 text-xs leading-relaxed text-[var(--text-muted)]">
        從最下面那格開始往上爬。點已經打掉的格子可以退回。
      </p>
    </div>
  );
}

/* ------------------------------- 女神像 ------------------------------- */

const { image: STATUE_IMAGE, spots: STATUE_SPOTS } = goddessStatue;

// 泡泡畫在平台正上方：平台的圖從地形線往上長約 20px，泡泡底部再留 4px 空隙。
const BUBBLE_R = 21;
const BUBBLE_LIFT = 20 + 4 + BUBBLE_R;
const BUBBLE_ICON = 30;

/**
 * 一個放置點的泡泡：白底圓裡放道具圖示，右上角小圓標第幾個碎片；生命草是最後
 * 一步，改用綠框、不標數字。座標單位是底圖像素（SVG 疊在圖上、共用同一個
 * viewBox），顏色一律寫死不吃主題——它們貼在遊戲畫面上，跟著頁面明暗換色反而
 * 會看不清。
 */
function StatueBubble({ spot }: { spot: StatueSpot }) {
  const cx = spot.x + STATUE_IMAGE.originX;
  const cy = spot.y + STATUE_IMAGE.originY - BUBBLE_LIFT;
  const grass = spot.order === null;
  const badge = BUBBLE_R * Math.SQRT1_2; // 圓周上 45° 那一點
  return (
    <g>
      <title>{spot.name}</title>
      <circle
        cx={cx}
        cy={cy}
        r={BUBBLE_R}
        fill="#FFFFFF"
        stroke={grass ? "#6DBE45" : "#11131F"}
        strokeOpacity={grass ? 1 : 0.2}
        strokeWidth={grass ? 3 : 1}
        filter="url(#statue-bubble-shadow)"
      />
      <image
        href={itemIconSrc(spot.itemId)}
        x={cx - BUBBLE_ICON / 2}
        y={cy - BUBBLE_ICON / 2}
        width={BUBBLE_ICON}
        height={BUBBLE_ICON}
      />
      {!grass && (
        <>
          <circle
            cx={cx + badge}
            cy={cy - badge}
            r={8}
            fill="#1F2430"
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
          <text
            x={cx + badge}
            y={cy - badge}
            dy="0.36em"
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#FFFFFF"
          >
            {spot.order}
          </text>
        </>
      )}
    </g>
  );
}

// 底圖照原尺寸顯示（點陣美術，放大會糊），窄螢幕才等比縮小。
function StatueTab() {
  return (
    <div className="w-full" style={{ maxWidth: STATUE_IMAGE.width }}>
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--border)]"
        style={{ aspectRatio: `${STATUE_IMAGE.width} / ${STATUE_IMAGE.height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 拆包底圖，尺寸固定不需要 next/image */}
        <img
          src={STATUE_IMAGE.src}
          alt="中央塔的女神像與六個放碎片的平台"
          className="h-full w-full"
        />
        <svg
          viewBox={`0 0 ${STATUE_IMAGE.width} ${STATUE_IMAGE.height}`}
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <filter
              id="statue-bubble-shadow"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2.5"
                floodColor="#05070F"
                floodOpacity="0.55"
              />
            </filter>
          </defs>
          {STATUE_SPOTS.map((s) => (
            <StatueBubble key={s.reactorId} spot={s} />
          ))}
        </svg>
      </div>

      <p className="mt-2 px-1 text-xs leading-relaxed text-[var(--text-muted)]">
        站上平台把碎片丟下去，數字是「女神像的第幾個碎片」。
      </p>
    </div>
  );
}
