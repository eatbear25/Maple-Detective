"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Disc3,
  Lock,
  Puzzle,
  RotateCcw,
  Undo2,
  Warehouse,
  X,
} from "lucide-react";
import { loungeRecords } from "@/data/party-quests";
import { itemIconSrc } from "@/data/drops";
import { goddessStatue, type StatueSpot } from "@/data/goddess-statue";
import { GameIcon } from "../../monsters/game-icon";
import {
  ATTEMPT_LIMIT,
  isAncestor,
  MAX_STEPS,
  PEOPLE,
  PLATFORMS,
  REPLIES,
  ROOT,
  type PlanNode,
  type Reply,
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

  // 網址上的 ?tab= 是分享連結用的來源之一：直接改網址列（含瀏覽器上一頁）
  // 也要能切分頁，所以跟著同步過來。
  useEffect(() => {
    if (isTab(urlTab) && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只跟著網址走，不要讓 tab 自己觸發它
  }, [urlTab]);

  const select = (key: Tab) => {
    if (key === tab) return;
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

        {/* 分頁樣式跟怪物掉落頁一致：選中的直接換底色，不做滑動 */}
        <div
          role="tablist"
          className="mt-4 inline-flex rounded-full border border-[var(--border)] p-0.5 text-sm"
        >
          {/* 窄螢幕（玩家常把視窗縮在遊戲旁邊）四顆帶圖示的按鈕會超出去，
              所以 sm 以下只留文字、內距縮成 px-3，300px 寬也放得下 */}
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => select(key)}
              className={`cursor-pointer flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors sm:px-4 ${
                tab === key
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={14} className="hidden sm:block" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Panel />
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

// 易克兩種回應在遊戲裡的字（客戶端原文太長，取能對得上的那一截）
const REPLY_TEXT: Record<Reply, string> = {
  0: "重量都不相同",
  1: "1 個踏板正確",
};

// 同一個畫面兩種用法：上面的卡片可以按（易克說什麼就按什麼，直接告訴你下一次
// 怎麼站），下面的解法樹不按也能整張看（給不想切回網頁點的人）。兩邊共用同一個
// 「目前站法」，有按的話樹上會亮出走過的路、淡掉已經不可能的分支。
// 寬螢幕左右並排；窄螢幕（玩家常把視窗縮在遊戲旁邊）上下疊，卡片在上。
function SealedRoomTab() {
  const [current, setCurrent] = useState<PlanNode>(ROOT);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="w-full max-w-sm md:w-80 md:shrink-0">
        <SealedStepper node={current} onMove={setCurrent} />
        <p className="mt-2 px-1 text-xs leading-relaxed text-[var(--text-muted)]">
          {PEOPLE} 人站踏板，隊長不站、負責跟易克講話。{ATTEMPT_LIMIT}{" "}
          次內沒過會被趕出去、答案也會換。
        </p>
      </div>
      <SealedTree current={current} onPick={setCurrent} />
    </div>
  );
}

function SealedStepper({
  node,
  onMove,
}: {
  node: PlanNode;
  onMove: (n: PlanNode) => void;
}) {
  const sure = node.candidates.length === 1;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div
        className="p-4"
        aria-live="polite"
        aria-label={`第 ${node.step} 次：${PLATFORMS.map((p, i) => `${p} ${node.stand[i]} 人`).join("、")}`}
      >
        <div className="mb-2 text-xs text-[var(--text-muted)]">
          <span>
            第{" "}
            <b className="text-base tabular-nums text-[var(--text)]">
              {node.step}
            </b>{" "}
            次嘗試，這樣站
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map((label, i) => (
            <div
              key={label}
              className={`rounded-xl border py-2.5 text-center transition-colors ${
                sure
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <div className="text-xs text-[var(--text-muted)]">{label}</div>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span
                  className={`text-4xl font-bold leading-none tabular-nums ${
                    sure ? "text-[var(--accent)]" : ""
                  }`}
                >
                  {node.stand[i]}
                </span>
                <span className="text-xs text-[var(--text-muted)]">人</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
        {sure ? (
          <p className="py-3 text-center text-sm font-semibold text-[var(--accent)]">
            結束
          </p>
        ) : (
          <>
            {/* <div className="mb-2 text-xs text-[var(--text-muted)]">
              易克說的是
            </div> */}
            <div className="grid grid-cols-2 gap-2">
              {REPLIES.map((r) => {
                const to = node.next[r];
                return (
                  <button
                    key={r}
                    onClick={() => to && onMove(to)}
                    disabled={!to}
                    className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span className="flex h-8 items-center text-2xl font-bold tabular-nums">
                      {r === 0 ? (
                        <X
                          size={24}
                          strokeWidth={3}
                          className="text-rose-500"
                        />
                      ) : (
                        r
                      )}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {to ? REPLY_TEXT[r] : "這步不會出現"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-10 items-center justify-between gap-2 border-t border-[var(--border)] py-1.5 pl-4 pr-2.5 text-xs">
        <span
          className={
            sure
              ? "font-medium text-[var(--accent)]"
              : "text-[var(--text-muted)]"
          }
        >
          {sure ? "答案確定了" : `還剩 ${node.candidates.length} 種可能`}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => node.parent && onMove(node.parent)}
            disabled={!node.parent}
            className={TEXT_BUTTON}
          >
            <Undo2 size={12} />
            上一步
          </button>
          <button
            onClick={() => onMove(ROOT)}
            disabled={node === ROOT}
            className={TEXT_BUTTON}
          >
            <RotateCcw size={12} />
            重設
          </button>
        </div>
      </div>
    </div>
  );
}

const childrenOf = (n: PlanNode) =>
  REPLIES.flatMap((r) => (n.next[r] ? [n.next[r]] : []));

type NodeState = "current" | "tried" | "ahead" | "gone";

function stateOf(n: PlanNode, current: PlanNode): NodeState {
  if (n === current) return "current";
  if (isAncestor(n, current)) return "tried";
  if (isAncestor(current, n)) return "ahead";
  return "gone";
}

const isLit = (s: NodeState) => s === "current" || s === "tried";

// 解法樹由上往下畫：一列＝第幾次嘗試。
// 只有「分岔」的地方要看易克回什麼，所以記號只標在分岔的橫線上——往左那條一律是
// ✕（所有踏板的重量都不相同）、往右那條一律是 1，跟上面卡片的兩顆按鈕同一個左右順序；
// 一直線的地方沒得選，不標。
// 橫向位置：每個終點佔一欄，其餘的格子放在第一個與最後一個子分支的正中間。
const TREE_NODES: PlanNode[] = [];
const COL_OF = new Map<PlanNode, number>();
const TREE_COLS = (function place(n: PlanNode, col: number): number {
  TREE_NODES.push(n);
  const kids = childrenOf(n);
  if (kids.length === 0) {
    COL_OF.set(n, col);
    return col + 1;
  }
  let next = col;
  for (const k of kids) next = place(k, next);
  COL_OF.set(
    n,
    (COL_OF.get(kids[0])! + COL_OF.get(kids[kids.length - 1])!) / 2,
  );
  return next;
})(ROOT, 0);
const TREE_EDGES = TREE_NODES.filter((n) => n.parent);

interface TreeLayout {
  /** 格子寬、相鄰兩欄的間距、上下兩次之間的距離、格子高、格子圓角、格子字級 */
  col: number;
  gap: number;
  row: number;
  chip: number;
  radius: number;
  font: number;
  /** 左邊「第 N 次」那欄的寬，0 = 不畫 */
  gutter: number;
}

// 座標是 SVG 單位，整張圖跟著卡片寬度縮放。窄視窗（玩家常把視窗縮在遊戲旁邊）
// 把間距收到最緊、也不畫「第 N 次」，320px 寬的字才不會被縮到看不清。
const NARROW: TreeLayout = {
  col: 36,
  gap: 4,
  row: 38,
  chip: 21,
  radius: 7,
  font: 12.5,
  gutter: 0,
};
const WIDE: TreeLayout = {
  col: 44,
  gap: 8,
  row: 44,
  chip: 24,
  radius: 12,
  font: 14,
  gutter: 34,
};

const CHIP_FILL: Record<NodeState, string> = {
  current: "fill-[var(--accent)]",
  tried: "fill-[var(--accent-soft)]",
  ahead: "fill-[color-mix(in_srgb,var(--text)_7%,var(--surface))]",
  gone: "fill-[color-mix(in_srgb,var(--text)_7%,var(--surface))]",
};

const CHIP_TEXT: Record<NodeState, string> = {
  current: "fill-[var(--surface)] font-bold",
  tried: "fill-[var(--accent)] font-semibold",
  ahead: "fill-[var(--text)] font-semibold",
  gone: "fill-[var(--text)] font-semibold",
};

function TreeSvg({
  layout: L,
  current,
  onPick,
  className,
}: {
  layout: TreeLayout;
  current: PlanNode;
  onPick: (n: PlanNode) => void;
  className: string;
}) {
  const width = L.gutter + TREE_COLS * L.col + (TREE_COLS - 1) * L.gap;
  const height = (MAX_STEPS - 1) * L.row + L.chip + 2;
  // 格子中心
  const cx = (n: PlanNode) =>
    L.gutter + COL_OF.get(n)! * (L.col + L.gap) + L.col / 2;
  const cy = (n: PlanNode) => 1 + L.chip / 2 + (n.step - 1) * L.row;

  // 亮的線最後畫，才不會被共用同一段起點的暗線蓋住
  const edges = TREE_EDGES.map((child) => ({
    child,
    state: stateOf(child, current),
  })).sort((a, b) => Number(isLit(a.state)) - Number(isLit(b.state)));

  return (
    <svg
      viewBox={`-2 0 ${width + 4} ${height}`}
      className={`mx-auto h-auto w-full select-none ${className}`}
      role="group"
      aria-label="封印房完整解法"
    >
      {L.gutter > 0 &&
        Array.from({ length: MAX_STEPS }, (_, i) => (
          <text
            key={i}
            x={0}
            y={1 + L.chip / 2 + i * L.row}
            dy="0.35em"
            fontSize={10}
            className={
              i + 1 === current.step
                ? "fill-[var(--accent)] font-bold"
                : "fill-[var(--text-muted)]"
            }
          >
            第{i + 1}次
          </text>
        ))}

      {edges.map(({ child, state }) => {
        const parent = child.parent!;
        const px = cx(parent);
        const qx = cx(child);
        const y0 = cy(parent) + L.chip / 2;
        const y1 = cy(child) - L.chip / 2;
        const ym = (y0 + y1) / 2;
        const fork = childrenOf(parent).length > 1;
        const lit = isLit(state);
        let d = `M${px} ${y0}V${y1}`;
        if (fork) {
          const r = 4;
          const s = Math.sign(qx - px);
          d = `M${px} ${y0}V${ym - r}Q${px} ${ym} ${px + s * r} ${ym}H${qx - s * r}Q${qx} ${ym} ${qx} ${ym + r}V${y1}`;
        }
        return (
          <g
            key={child.key}
            className={`transition-opacity ${state === "gone" ? "opacity-25" : ""}`}
          >
            <path
              d={d}
              fill="none"
              strokeWidth={lit ? 1.8 : 1.1}
              strokeLinejoin="round"
              className={
                lit
                  ? "stroke-[var(--accent)]"
                  : "stroke-[color-mix(in_srgb,var(--text-muted)_55%,var(--surface))]"
              }
            />
            {fork && (
              <ForkMark
                cx={(px + qx) / 2}
                cy={ym}
                reply={child.via!}
                lit={lit}
              />
            )}
          </g>
        );
      })}

      {TREE_NODES.map((n) => {
        const state = stateOf(n, current);
        return (
          <g
            key={n.key}
            role="button"
            tabIndex={0}
            aria-label={`第 ${n.step} 次站 ${n.key}`}
            aria-current={state === "current" ? "step" : undefined}
            onClick={() => onPick(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(n);
              }
            }}
            className={`cursor-pointer outline-none transition-opacity [&:focus-visible>rect]:stroke-[var(--accent)] [&:hover>rect]:stroke-[var(--accent)] ${
              state === "gone" ? "opacity-25 hover:opacity-70" : ""
            }`}
          >
            <rect
              x={cx(n) - L.col / 2}
              y={cy(n) - L.chip / 2}
              width={L.col}
              height={L.chip}
              rx={L.radius}
              strokeWidth={1.2}
              className={`stroke-transparent ${CHIP_FILL[state]}`}
            />
            <text
              x={cx(n)}
              y={cy(n)}
              dy="0.35em"
              textAnchor="middle"
              fontSize={L.font}
              className={`tabular-nums ${CHIP_TEXT[state]}`}
            >
              {n.key}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 分岔橫線上的記號：白底圓把線截斷，中間畫 ✕ 或 1 */
function ForkMark({
  cx,
  cy,
  reply,
  lit,
}: {
  cx: number;
  cy: number;
  reply: Reply;
  lit: boolean;
}) {
  const d = 2.7;
  return (
    <>
      <circle cx={cx} cy={cy} r={6} className="fill-[var(--surface)]" />
      {reply === 0 ? (
        <path
          d={`M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`}
          strokeWidth={lit ? 2.2 : 1.8}
          strokeLinecap="round"
          className="stroke-rose-500"
        />
      ) : (
        <text
          x={cx}
          y={cy}
          dy="0.35em"
          textAnchor="middle"
          fontSize={11}
          className={
            lit
              ? "fill-[var(--accent)] font-bold"
              : "fill-[var(--text-muted)] font-bold"
          }
        >
          1
        </text>
      )}
    </>
  );
}

// 每一格都能點，點了就跳到那一步——按錯回應時直接點正確的那格就好，不用一直按上一步。
// 有在按的話：走過的路亮起來、已經不可能的分支淡掉；完全不按就是一張完整的對照圖。
function SealedTree({
  current,
  onPick,
}: {
  current: PlanNode;
  onPick: (n: PlanNode) => void;
}) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 pb-3 pt-3 sm:max-w-md sm:px-4">
      <div className="mb-3 flex items-baseline justify-between px-1 text-xs text-[var(--text-muted)] sm:px-0">
        <span className="text-sm font-semibold text-[var(--text)]">
          完整解法
        </span>
        <span>左/中/右 各站幾人</span>
      </div>

      <TreeSvg
        layout={NARROW}
        current={current}
        onPick={onPick}
        className="block sm:hidden"
      />
      <TreeSvg
        layout={WIDE}
        current={current}
        onPick={onPick}
        className="hidden sm:block"
      />

      <div className="mx-1 mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border)] pt-2.5 text-xs sm:mx-0 text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <X size={13} strokeWidth={3} className="shrink-0 text-rose-500" />
          重量都不相同
        </span>
        <span className="flex items-center gap-1.5">
          <b className="w-[13px] text-center text-[var(--text-muted)]">1</b>
          一個踏板正確
        </span>
        <span>一直線＝沒過就往下</span>
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
            已打 <b className="tabular-nums text-[var(--text)]">{done}</b> /{" "}
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
        style={{
          aspectRatio: `${STATUE_IMAGE.width} / ${STATUE_IMAGE.height}`,
        }}
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
