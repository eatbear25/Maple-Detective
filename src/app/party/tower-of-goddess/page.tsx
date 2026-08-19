"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Copy, Disc3, Lock, RotateCcw, Warehouse } from "lucide-react";
import { loungeRecords } from "@/data/party-quests";
import { itemIconSrc } from "@/data/drops";
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

type Tab = "lounge" | "sealed" | "storage";

const TABS: [Tab, string, typeof Disc3][] = [
  ["lounge", "休息室", Disc3],
  ["sealed", "封印房", Lock],
  ["storage", "倉庫", Warehouse],
];

const PANELS: Record<Tab, () => React.JSX.Element> = {
  lounge: LoungeTab,
  sealed: SealedRoomTab,
  storage: StorageTab,
};

export default function TowerOfGoddessPage() {
  const [tab, setTab] = useState<Tab>("lounge");
  // 切換方向：往右的分頁從右邊滑進來，往左的從左邊
  const [dir, setDir] = useState(1);
  const tabIndex = TABS.findIndex(([k]) => k === tab);

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
          {TABS.map(([key, label, Icon], i) => (
            <button
              key={key}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={tab === key}
              onClick={() => select(key, i)}
              className={`relative z-10 cursor-pointer flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
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

// 玩家多半把視窗縮到遊戲旁邊看，所以整個工具鎖在一張窄卡片裡，
// 排版由上而下：答案 → 圖例 → 四列回應 → 狀態，不用左右掃視。
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
    <div className="max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div
        className={`border-b border-[var(--border)] px-4 py-3 text-center transition-colors ${
          solved ? "bg-[var(--accent-soft)]" : ""
        }`}
      >
        <div
          className={`text-4xl font-bold tabular-nums leading-none ${
            solved ? "text-[var(--accent)]" : "text-[var(--text-muted)]/40"
          }`}
        >
          {solved ? formatSolution(solved) : "?-?-?"}
        </div>
        <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
          左 - 中 - 右　共 {TOTAL_PEOPLE} 人
        </div>
      </div>

      <div className="flex items-baseline gap-2 px-4 pt-3 text-[11px] text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">NPC 回應</span>
        <span>0 沒對 · 1 對一個 · 2 對兩個</span>
      </div>

      <div className="divide-y divide-[var(--border)] px-4">
        {PROBES.map((probe) => {
          const feasible = feasibleResponses(answers, probe.key);
          return (
            <div
              key={probe.key}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="text-sm font-medium">{probe.label}</div>
              <div className="flex gap-1.5">
                {RESPONSES.map((v) => {
                  const active = answers[probe.key] === v;
                  const impossible = !active && !feasible.has(v);
                  return (
                    <button
                      key={v}
                      onClick={() => pick(probe.key, v)}
                      aria-pressed={active}
                      className={`h-9 w-9 cursor-pointer rounded-md border text-base font-bold tabular-nums transition-colors ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : impossible
                            ? "border-[var(--border)] text-[var(--text-muted)] opacity-25 hover:opacity-60"
                            : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
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

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2 text-[11px]">
        <span
          className={contradiction ? "font-medium" : "text-[var(--text-muted)]"}
        >
          {contradiction
            ? "回應兜不起來，請檢查有沒有點錯"
            : solved
              ? filled < PROBES.length
                ? `已確定`
                : "已確定"
              : `還剩 ${pool.length} 種可能`}
        </span>
        <button
          onClick={() => setAnswers({})}
          disabled={filled === 0}
          className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-0"
        >
          <RotateCcw size={12} />
          重設
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- 倉庫 -------------------------------- */

// 一樣鎖成窄卡片（玩家把視窗縮在遊戲旁邊看）。平台位置照參考圖畫成左右交錯
// 兩排，最下面那格是第 1 隻——玩家是從底下往上爬（見 storage.ts 註解）。
// 選中狀態一律用「內描邊 ring-inset」，往外長的 ring 會被外層裁掉。
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
    <div className="max-w-[280px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div
        className={`flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2 transition-colors ${
          next ? "" : "bg-[var(--accent-soft)]"
        }`}
      >
        {next ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">
                下一隻
              </span>
              <span className="text-xl font-bold leading-none tabular-nums text-[var(--accent)]">
                {next.order}
              </span>
              <span className="text-sm font-medium">{next.label}</span>
            </div>
            <button
              onClick={() => setDone((n) => n + 1)}
              className="shrink-0 cursor-pointer rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            >
              打掉了
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">15 隻清完了 🎉</span>
            <button
              onClick={() => setDone(0)}
              className="shrink-0 cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] transition-colors hover:border-[var(--accent)]"
            >
              再一輪
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
        <span>
          <b className="tabular-nums text-[var(--text)]">{done}</b> /{" "}
          {STORAGE_TOTAL} 隻獨角獅
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={copy}
            className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "已複製" : "複製"}
          </button>
          <button
            onClick={() => setDone(0)}
            disabled={done === 0}
            className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-0"
          >
            <RotateCcw size={11} />
            重設
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-1.5 px-2.5 py-2">
        {STORAGE_PLATFORMS.map((p) => {
          const killed = p.order <= done;
          const isNext = next?.order === p.order;
          return (
            <button
              key={p.index}
              style={{
                gridColumn: p.col === "left" ? 1 : 2,
                gridRow: p.index + 1,
              }}
              onClick={() =>
                setDone(isNext ? p.order : killed ? p.order - 1 : done)
              }
              disabled={!killed && !isNext}
              aria-label={`第 ${p.order} 隻，位置 ${p.label}`}
              className={`my-[2px] flex items-center justify-center gap-1.5 rounded-md border py-0.5 transition-colors ${
                isNext
                  ? "cursor-pointer border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-inset ring-[var(--accent)]/45"
                  : killed
                    ? "cursor-pointer border-transparent opacity-30 hover:opacity-60"
                    : "cursor-default border-[var(--border)]"
              }`}
            >
              <span
                className={`text-sm font-bold leading-none tabular-nums ${
                  isNext
                    ? "text-[var(--accent)]"
                    : killed
                      ? "text-[var(--text-muted)] line-through"
                      : ""
                }`}
              >
                {p.order}
              </span>
              <span className="text-[10px] leading-none text-[var(--text-muted)]">
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="border-t border-[var(--border)] px-3 py-1.5 text-[10px] leading-snug text-[var(--text-muted)]">
        最下面是第 1 隻，由下往上爬。點劃掉的可退回。
      </p>
    </div>
  );
}
