"use client";

import {
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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
import { CARD, WELL_BG } from "../../monsters/styles";
import { PageHeader } from "@/app/page-header";
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

const TABS: [Tab, string][] = [
  ["lounge", "休息室"],
  ["sealed", "封印房"],
  ["storage", "倉庫"],
  ["statue", "女神像"],
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

const HEADER = (
  <PageHeader
    title="女神之塔速查"
    description="女神之塔各關的解答，打到哪一關就切到哪一頁"
  />
);

export default function TowerOfGoddessPage() {
  // fallback 也要有標題：靜態輸出時這頁只會產出 fallback，見 PageHeader 的註解
  return (
    <Suspense fallback={HEADER}>
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
        {HEADER}

        {/* 分頁樣式跟怪物掉落頁同一套。關卡圖示放在下面面板的標題上，分頁只放字，
            320px 寬（玩家常把視窗縮在遊戲旁邊）四顆也放得下 */}
        <div
          role="tablist"
          className="mt-3.5 inline-flex gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-[3px] text-[13px]"
        >
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => select(key)}
              className={`cursor-pointer flex h-8 items-center whitespace-nowrap rounded-full px-3.5 transition-colors ${
                tab === key
                  ? "bg-[var(--accent-soft)] font-bold text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Panel />
    </div>
  );
}

/* ------------------------------ 關卡面板 ------------------------------ */

/**
 * 四個分頁共用的外框：頭（關卡圖示＋關卡名＋一句規則）→ 分隔線 → 內容。
 * 規則寫在頭上，不要再放到卡片外面當小灰字。
 */
function StagePanel({
  icon: Icon,
  title,
  rule,
  className = "",
  children,
}: {
  icon: typeof Disc3;
  title: string;
  rule: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={`${CARD} ${className}`}>
      <header className="flex items-center gap-3.5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">
            {rule}
          </p>
        </div>
      </header>
      <div className="border-t border-[var(--border)] px-5 py-6">
        {children}
      </div>
    </section>
  );
}

// 面板內容的左右兩欄：左邊是打到這關時要看的答案，右邊是對照用的。
// 不用斷點而用 flex-wrap：兩欄放不下（視窗縮在遊戲旁邊）就自動上下疊、答案在上面。
// 左欄不吃剩下的寬度（grow 0），多出來的都給右欄。
const TWO_COLS = "flex flex-wrap items-start gap-8";
const ANSWER_COL = "min-w-0 flex-[0_1_380px]";
const REFERENCE_COL = "min-w-0 flex-[999_1_420px]";

/** 欄位標題，跟怪物詳情的區段標題同一套（標題＋旁邊一句灰字） */
function ColTitle({
  children,
  note,
}: {
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <h3 className="mb-3 flex items-center gap-1.5 text-base font-bold">
      {children}
      {note && (
        <span className="text-sm font-medium text-[var(--text-muted)]">
          {note}
        </span>
      )}
    </h3>
  );
}

// 狀態列右邊的小文字鈕（上一步／重設／複製）。沒得按的時候留在原位變淡，
// 不要整顆消失——消失的話旁邊的鈕會跟著位移。
const TEXT_BUTTON =
  "flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40";

/* ------------------------------- 休息室 ------------------------------- */

// 星期幾只有瀏覽器算得準（伺服器時區不一定一樣），所以走
// useSyncExternalStore：伺服器端快照給 null（不標今天），水合後才拿到真值。
const NO_SUBSCRIBE = () => () => {};

function ColorDot({ color, className }: { color: string; className: string }) {
  return (
    <span
      className={`shrink-0 rounded-full ring-1 ring-black/15 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

function LoungeTab() {
  const today = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => new Date().getDay(),
    () => null,
  );

  const todayRecord = loungeRecords.find((r) => r.day === today);

  return (
    <StagePanel
      icon={Disc3}
      title="休息室"
      rule="唱盤每天換一張，照今天星期幾找"
    >
      <div className={TWO_COLS}>
        <div className={ANSWER_COL}>
          <ColTitle note={todayRecord?.dayLabel}>今天</ColTitle>
          {/* 伺服器端還不知道今天星期幾：先留同樣高度的空框，水合後才填內容，版面不會跳 */}
          <div className="flex min-h-[124px] items-center gap-[18px] rounded-[14px] bg-[var(--accent-soft)] p-5">
            {todayRecord && (
              <>
                {/* 唱盤圖是 30×28 的像素圖，只能整數倍放大，不然會糊、會變形 */}
                <span className="grid size-[84px] shrink-0 place-items-center rounded-2xl bg-[var(--surface)]">
                  <GameIcon
                    src={itemIconSrc(todayRecord.itemId)}
                    alt={todayRecord.name}
                    fallback="💿"
                    className="pixel-art h-14 w-[60px] [&_img]:size-full"
                  />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 text-[40px] font-bold leading-[44px]">
                    <ColorDot color={todayRecord.color} className="size-3.5" />
                    {todayRecord.colorLabel}
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    {todayRecord.name}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={REFERENCE_COL}>
          <ColTitle>一週對照</ColTitle>
          <ul className="flex max-w-[520px] flex-col gap-1.5">
            {loungeRecords.map((r) => {
              const isToday = r.day === today;
              return (
                <li
                  key={r.day}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    isToday ? "bg-[var(--accent-soft)]" : WELL_BG
                  }`}
                >
                  <span className="w-[52px] shrink-0 text-sm font-medium">
                    {r.dayLabel}
                  </span>
                  <GameIcon
                    src={itemIconSrc(r.itemId)}
                    alt=""
                    fallback="💿"
                    className="h-7 w-[30px] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <ColorDot color={r.color} className="size-2.5" />
                      <b className="text-[15px] font-bold">{r.colorLabel}</b>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {r.name}
                    </div>
                  </div>
                  {isToday && (
                    <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--on-accent)]">
                      今天
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </StagePanel>
  );
}

/* ------------------------------- 封印房 ------------------------------- */

// 易克兩種回應在遊戲裡的字（客戶端原文太長，取能對得上的那一截）
const REPLY_TEXT: Record<Reply, string> = {
  0: "重量都不相同",
  1: "1 個踏板正確",
};

// 同一個畫面兩種用法：左欄可以按（易克說什麼就按什麼，直接告訴你下一次怎麼站），
// 右欄的解法樹不按也能整張看（給不想切回網頁點的人）。兩邊共用同一個「目前站法」，
// 有按的話樹上會亮出走過的路、淡掉已經不可能的分支。
function SealedRoomTab() {
  const [current, setCurrent] = useState<PlanNode>(ROOT);

  return (
    <StagePanel
      icon={Lock}
      title="封印房"
      rule={`${PEOPLE} 人站上左、中、右三個踏板，隊長不站、負責跟易克講話。${ATTEMPT_LIMIT} 次內沒過會被趕出去，答案也會換。`}
    >
      <div className={TWO_COLS}>
        <div className={ANSWER_COL}>
          <SealedStepper node={current} onMove={setCurrent} />
        </div>
        <div className={REFERENCE_COL}>
          <SealedTree current={current} onPick={setCurrent} />
        </div>
      </div>
    </StagePanel>
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
    <div aria-live="polite">
      <ColTitle>{sure ? "答案確定" : `第 ${node.step} 次，這樣站`}</ColTitle>
      <div
        role="group"
        aria-label={`第 ${node.step} 次：${PLATFORMS.map((p, i) => `${p} ${node.stand[i]} 人`).join("、")}`}
        className="grid grid-cols-3 gap-2"
      >
        {PLATFORMS.map((label, i) => (
          <div
            key={label}
            className={`rounded-xl pb-3 pt-2.5 text-center transition-colors ${
              sure ? "bg-[var(--accent-soft)]" : WELL_BG
            }`}
          >
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
            <div className="mt-1 flex items-baseline justify-center gap-[3px]">
              <span
                className={`text-[40px] font-bold leading-[44px] tabular-nums ${
                  sure ? "text-[var(--accent-text)]" : ""
                }`}
              >
                {node.stand[i]}
              </span>
              <span className="text-xs text-[var(--text-muted)]">人</span>
            </div>
          </div>
        ))}
      </div>

      {sure ? (
        <p className="mt-3 rounded-xl bg-[var(--accent-soft)] py-3.5 text-center text-[15px] font-bold text-[var(--accent-text)]">
          結束
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {REPLIES.map((r) => {
            const to = node.next[r];
            return (
              <button
                key={r}
                onClick={() => to && onMove(to)}
                disabled={!to}
                className="flex min-h-[68px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] py-2.5 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="flex h-[30px] items-center text-[26px] font-bold tabular-nums">
                  {r === 0 ? (
                    <X
                      size={24}
                      strokeWidth={3}
                      className="text-rose-600 dark:text-rose-400"
                    />
                  ) : (
                    r
                  )}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {to ? REPLY_TEXT[r] : "這步不會出現"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[13px] text-[var(--text-muted)]">
          {sure
            ? `第 ${node.step} 次嘗試`
            : `還剩 ${node.candidates.length} 種可能`}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => node.parent && onMove(node.parent)}
            disabled={!node.parent}
            className={TEXT_BUTTON}
          >
            <Undo2 size={14} />
            上一步
          </button>
          <button
            onClick={() => onMove(ROOT)}
            disabled={node === ROOT}
            className={TEXT_BUTTON}
          >
            <RotateCcw size={14} />
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
// ✕（所有踏板的重量都不相同）、往右那條一律是 1，跟左欄的兩顆按鈕同一個左右順序；
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

// 座標是 SVG 單位，整張圖跟著欄寬縮放。窄視窗（玩家常把視窗縮在遊戲旁邊）
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
      className={`h-auto w-full select-none ${className}`}
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
            className={`transition-opacity ${state === "gone" ? "opacity-25 dark:opacity-40" : ""}`}
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
              state === "gone"
                ? "opacity-25 hover:opacity-70 dark:opacity-40"
                : ""
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
          className="stroke-rose-600 dark:stroke-rose-400"
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
// 寬度鎖在 440px：右欄很寬，整張圖跟著撐開的話格子會大到不像同一頁的字級。
function SealedTree({
  current,
  onPick,
}: {
  current: PlanNode;
  onPick: (n: PlanNode) => void;
}) {
  return (
    <div>
      <ColTitle note="左/中/右 各站幾人">完整解法</ColTitle>

      <div className="max-w-[440px]">
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
      </div>

      <div className="mt-4 flex flex-wrap gap-x-[18px] gap-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <X
            size={13}
            strokeWidth={3}
            className="shrink-0 text-rose-600 dark:text-rose-400"
          />
          重量都不相同
        </span>
        <span className="flex items-center gap-1.5">
          <b className="w-[13px] text-center text-[var(--text)]">1</b>
          一個踏板正確
        </span>
        <span>一直線＝沒過就往下</span>
      </div>
    </div>
  );
}

/* -------------------------------- 倉庫 -------------------------------- */

// 只有一張平台圖、沒有對照欄，所以面板跟著平台圖收窄（482px），不撐滿整頁留一大片白。
// 平台位置照參考圖畫成左右交錯兩排，最下面那格是第 1 隻——玩家是從底下往上爬
// （見 storage.ts 註解）。每格跨兩列、左右排差一列，疊起來像磚牆：同一排的格子
// 上下相連，交錯關係還在但中間不會留一堆空洞。擊殺順序一律靠中線放（左排靠右、
// 右排靠左），15 個數字集中在中間一條，眼睛不用左右掃。
// 2026-11-08 拿掉「下一隻：左1」的大字與「接下來 右5 左5」（站長嫌「左1」這種寫法
// 難看），下一隻改成直接在平台圖上用實心底標出來。
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
    <StagePanel
      icon={Warehouse}
      title="倉庫"
      rule={`照順序打倒 ${STORAGE_TOTAL} 隻獨角獅，從最下面那格開始往上爬`}
      className="max-w-[482px]"
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1" aria-live="polite">
          {next ? (
            <div className="text-[13px] text-[var(--text-muted)]">
              已打{" "}
              <b className="text-xl tabular-nums text-[var(--text)]">{done}</b>{" "}
              / {STORAGE_TOTAL}
            </div>
          ) : (
            <div className="text-[15px] font-bold leading-7 text-[var(--accent-text)]">
              {STORAGE_TOTAL} 隻清完了
            </div>
          )}
          <div aria-hidden className="mt-1.5 flex gap-[3px]">
            {BY_ORDER.map((p, i) => (
              <span
                key={p.order}
                className={`h-1.5 flex-1 rounded-full ${
                  i < done
                    ? "bg-[var(--accent)]"
                    : i === done
                      ? "bg-[color-mix(in_srgb,var(--accent)_40%,var(--surface))]"
                      : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>
        </div>
        {next ? (
          <button
            onClick={() => setDone((n) => n + 1)}
            className="h-11 shrink-0 cursor-pointer rounded-xl bg-[var(--accent)] px-[22px] text-[15px] font-bold text-[var(--on-accent)] transition-opacity hover:opacity-90"
          >
            打掉了
          </button>
        ) : (
          <button
            onClick={() => setDone(0)}
            className="h-11 shrink-0 cursor-pointer rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-[22px] text-[15px] font-bold transition-colors hover:border-[var(--accent)]"
          >
            再一輪
          </button>
        )}
      </div>

      <div
        className="mt-4 grid grid-cols-2 gap-x-2 gap-y-1.5"
        style={{ gridAutoRows: "1.25rem" }}
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
              className={`flex items-center justify-between rounded-[10px] px-3 transition-colors ${
                left ? "flex-row-reverse" : ""
              } ${
                isNext
                  ? "cursor-pointer bg-[var(--accent)] text-[var(--on-accent)]"
                  : killed
                    ? "cursor-pointer text-[var(--text-muted)] opacity-45 hover:opacity-80 dark:opacity-60"
                    : `cursor-default ${WELL_BG}`
              }`}
            >
              <span className="w-7 text-center text-xl font-bold leading-none tabular-nums">
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-xs text-[var(--text-muted)]">
          數字＝第幾隻・點打掉的格子可以退回
        </span>
        {/* ml-auto：窄視窗換行時兩顆鈕留在右邊，跟封印房的狀態列同一側 */}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={copy} className={TEXT_BUTTON}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "已複製" : "複製順序"}
          </button>
          <button
            onClick={() => setDone(0)}
            disabled={done === 0}
            className={TEXT_BUTTON}
          >
            <RotateCcw size={14} />
            重設
          </button>
        </div>
      </div>
    </StagePanel>
  );
}

/* ------------------------------- 女神像 ------------------------------- */

const { image: STATUE_IMAGE, spots: STATUE_SPOTS } = goddessStatue;

// 右欄清單的位置說明，照 goddess-statue.json 裡各平台在底圖上的座標寫的
const SPOT_WHERE: Record<number, string> = {
  1: "左下的平台",
  2: "左邊中間的平台",
  3: "左上的平台",
  4: "右下的平台",
  5: "正中間的平台",
  6: "右邊中間的平台",
};

// 泡泡畫在平台正上方：平台的圖從地形線往上長約 20px，泡泡底部再留 4px 空隙。
const BUBBLE_R = 21;
const BUBBLE_LIFT = 20 + 4 + BUBBLE_R;
const BUBBLE_ICON = 30;

/**
 * 一個放置點的泡泡：白底圓裡放道具圖示，右上角小圓標第幾個碎片；生命草是最後
 * 一步，改用綠框、不標數字。座標單位是底圖像素（SVG 疊在圖上、共用同一個
 * viewBox），顏色一律寫死不吃主題——它們貼在遊戲畫面上，跟著頁面明暗換色反而
 * 會看不清。lit = 右欄清單正指著這一片，放大加一圈亮框。
 */
function StatueBubble({ spot, lit }: { spot: StatueSpot; lit: boolean }) {
  const cx = spot.x + STATUE_IMAGE.originX;
  const cy = spot.y + STATUE_IMAGE.originY - BUBBLE_LIFT;
  const grass = spot.order === null;
  const badge = BUBBLE_R * Math.SQRT1_2; // 圓周上 45° 那一點
  return (
    <g
      transform={
        lit
          ? `translate(${cx} ${cy}) scale(1.18) translate(${-cx} ${-cy})`
          : undefined
      }
    >
      <title>{spot.name}</title>
      <circle
        cx={cx}
        cy={cy}
        r={BUBBLE_R}
        fill="#FFFFFF"
        stroke={lit ? "#EDB86A" : grass ? "#6DBE45" : "#11131F"}
        strokeOpacity={lit || grass ? 1 : 0.2}
        strokeWidth={lit || grass ? 3 : 1}
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
// 右欄清單把碎片道具名對上編號（背包裡的碎片長得都差不多），滑過或點一列，
// 圖上那一片就放大標出來。
function StatueTab() {
  const [lit, setLit] = useState<number | null>(null);

  // 亮的泡泡最後畫，才不會被旁邊的蓋住
  const spots = [...STATUE_SPOTS].sort(
    (a, b) => Number(a.order === lit) - Number(b.order === lit),
  );
  const pieces = STATUE_SPOTS.filter((s) => s.order !== null);

  return (
    <StagePanel
      icon={Puzzle}
      title="女神像"
      rule="站上平台把碎片丟下去，數字是第幾個碎片"
    >
      <div className={TWO_COLS}>
        <div
          className="min-w-0"
          style={{ flex: `0 1 ${STATUE_IMAGE.width}px` }}
        >
          <div
            className="relative overflow-hidden rounded-xl"
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
              {spots.map((s) => (
                <StatueBubble
                  key={s.reactorId}
                  spot={s}
                  lit={s.order !== null && s.order === lit}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className={REFERENCE_COL}>
          <ColTitle>碎片對照</ColTitle>
          <ul className="flex max-w-[520px] flex-col gap-1.5">
            {pieces.map((s) => (
              <li key={s.reactorId}>
                <button
                  type="button"
                  onMouseEnter={() => setLit(s.order)}
                  onMouseLeave={() => setLit(null)}
                  onFocus={() => setLit(s.order)}
                  onBlur={() => setLit(null)}
                  onClick={() => setLit(s.order)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                    lit === s.order ? "bg-[var(--accent-soft)]" : WELL_BG
                  }`}
                >
                  <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[var(--text)] text-xs font-bold text-[var(--surface)]">
                    {s.order}
                  </span>
                  <GameIcon
                    src={itemIconSrc(s.itemId)}
                    alt=""
                    fallback=""
                    className="h-7 w-8 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {SPOT_WHERE[s.order!]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </StagePanel>
  );
}
