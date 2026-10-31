"use client";

/*
 * /merchant 神秘商人模擬（2026-10-29 起取代轉蛋模擬，遊戲把轉蛋活動換成了神秘商人）。
 *
 * 神秘商人：每一批貨架 6 個商品，每 6 小時自動換一批、每天 1 次免費刷新，
 * 其他時候用刷新券立刻換。這裡模擬的是「用刷新券刷新」：一次刷新＝6 格各自用官方機率表抽。
 * 商品上架後的售價、免費／打折的機率官方沒公布，所以花費只算刷新券。
 *
 * 版面（2026-10-31 照站長的設計稿改版）：主角是「抽到的內容」。
 *   lg 以上：左欄＝最新一批 → 操作列 → 前面幾批；右欄＝目標小卡＋官方機率表（一起 sticky）。
 *   lg 以下：「模擬／機率表」兩個分頁，目標縮成貨架下方一列（點了開底部面板），
 *   操作列黏在畫面底部。目標只有一份，在機率表點星星挑；「刷到集滿為止」的結果是彈窗。設計稿寫 768px 以下才換，但桌機版面在 768–1023px 右欄會掉到
 *   整串紀錄底下，目標就看不到了，所以跟首頁一樣到 lg 才換。
 * 頁面上的日期、價錢、組合都從資料算，不寫死某一期才成立的文字。
 *
 * 邏輯在 engine.ts（純函式）與 use-merchant.ts（狀態），各區塊在 parts.tsx。
 */

import { useState, useSyncExternalStore } from "react";
import { poolPeriod, type MerchantPool } from "@/data/merchant";
import { PageHeader } from "@/app/page-header";
import { useMerchant } from "./use-merchant";
import {
  GoalCard,
  GoalSheet,
  OddsTable,
  RefreshButtons,
  ResultModal,
  Shelf,
  Totals,
  UndoToast,
} from "./parts";

type Tab = "sim" | "odds";

export default function MerchantPage() {
  const ctx = useMerchant();
  const [tab, setTab] = useState<Tab>("sim");
  const [sheet, setSheet] = useState(false);
  const { result } = ctx;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <PageHeader
          title="神秘商人模擬"
          description="用官方公布的機率表模擬刷新貨架。花費只算刷新券。"
        />
        <PeriodPill pool={ctx.pool} />
      </div>

      {/* 手機的分頁：照全站的 pill 樣式（怪物掉落頁那種），不另做一套 */}
      <div className="mt-4 flex rounded-full border border-[var(--border)] p-0.5 text-sm lg:hidden">
        {(
          [
            ["sim", "模擬"],
            ["odds", `機率表 ${ctx.pool.prizes.length}`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 cursor-pointer rounded-full py-2 transition-colors ${
              tab === key
                ? "bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <div className={`min-w-0 flex-col gap-4 ${tab === "sim" ? "flex" : "hidden lg:flex"}`}>
          <Shelf
            ctx={ctx}
            onOpenGoal={() => (ctx.goal.length > 0 ? setSheet(true) : setTab("odds"))}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
          <div className="hidden shrink-0 lg:block">
            <GoalCard ctx={ctx} />
          </div>
          <OddsTable ctx={ctx} className={`lg:min-h-0 lg:flex-1 ${tab === "odds" ? "" : "max-lg:hidden"}`} />
        </div>
      </div>

      {/*
        手機：操作列固定在畫面底部。原本用 sticky，捲到最底會停在內容後面、露出頁尾，
        看起來像沒固定（2026-10-31 回報）。改 fixed 之後頁尾會被蓋住，所以 globals.css 的
        .merchant-bar 規則讓頁尾多留一塊這麼高的空間
      */}
      {tab === "sim" && (
        <div className="merchant-bar fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] shadow-[0_-8px_24px_-16px_rgba(33,31,27,0.25)] lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2.5 sm:px-6">
            <div className="flex items-center justify-between">
              <Totals ctx={ctx} compact />
            </div>
            <RefreshButtons ctx={ctx} compact />
          </div>
        </div>
      )}

      {result && <ResultModal ctx={ctx} result={result} />}
      {sheet && (
        <GoalSheet
          ctx={ctx}
          onClose={() => setSheet(false)}
          onPick={() => {
            setSheet(false);
            setTab("odds");
          }}
        />
      )}
      <UndoToast ctx={ctx} />
    </div>
  );
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const subscribeHour = (onChange: () => void) => {
  const t = setInterval(onChange, 60_000);
  return () => clearInterval(t);
};
/** 現在是第幾個小時。伺服器端回 null：靜態頁產生時的時間對訪客沒有意義 */
const useHour = () =>
  useSyncExternalStore(
    subscribeHour,
    () => Math.floor(Date.now() / HOUR),
    () => null,
  );

/** 「● 活動期間 10/29 – 11/12　還剩 12 天」 */
function PeriodPill({ pool }: { pool: MerchantPool }) {
  const hour = useHour();
  let left: string | null = null;
  let live = true;
  if (hour !== null) {
    const now = hour * HOUR;
    const start = new Date(pool.startDate).getTime();
    const end = new Date(pool.endDate).getTime();
    if (now < start) left = "還沒開始";
    else if (now >= end) {
      left = "已結束";
      live = false;
    } else {
      const days = Math.ceil((end - now) / DAY);
      left = days <= 1 ? "今天結束" : `還剩 ${days} 天`;
    }
  }
  return (
    <span className="inline-flex h-[34px] items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-[13px]">
      <span
        aria-hidden
        className={`size-2 rounded-full ${live ? "bg-emerald-600 dark:bg-emerald-400" : "bg-[var(--text-muted)]"}`}
      />
      活動期間 {poolPeriod(pool)}
      {left && <span className="text-[var(--text-muted)]">{left}</span>}
    </span>
  );
}
