"use client";

// 任務查詢：兩排分類 chip ＋搜尋 → 列表（依需求等級排序、分頁）→ 右側詳情。
// 詳情由上到下：任務說明（遊戲任務視窗那段字）、任務流程卡片（見 quest-flow.tsx）、
// NPC、接取／完成條件、獎勵。
// 要繳的道具一列一個（全名＋誰會掉）；獎勵是 icon + 前兩字標籤 + 數量的格子，hover 才出道具彈窗。

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  MapPin,
  Search,
  Sparkles,
  Telescope,
  X,
  Zap,
} from "lucide-react";
import {
  flowOf,
  npcIconSrc,
  questById,
  questCats,
  questItemInfo,
  questItemName,
  questMobName,
  questSkillName,
  questMapInfo,
  questWorldMapSheet,
  quests,
  type Quest,
  type QuestItem,
  type QuestMob,
} from "@/data/quests";
import { itemIconSrc, mobIconSrc, monsters, worldMapSrc } from "@/data/drops";
import { Desc } from "../monsters/equip-format";
import { GameIcon } from "../monsters/game-icon";
import { ItemTooltip, useItemTooltip } from "../monsters/item-tooltip";
import { NoPrefetchLink } from "@/app/no-prefetch-link";
import { PageHeader } from "@/app/page-header";
import { WorldMapView, type WorldMapDot } from "../worldmap-view";
import { QuestFlowCard } from "./quest-flow";

const PAGE_SIZE = 50;

type Tip = ReturnType<typeof useItemTooltip>;

/**
 * 搜尋索引：每個任務可以被搜到的文字，連同「這是什麼」的標籤。
 * 2026-11-16 以前只搜任務名與獎勵道具名，打 NPC、怪物、要繳的道具都找不到（站長回報不好查）。
 * 範圍一放寬就一定要說明命中原因——不然搜「蝙蝠」跑出「伊卡路斯的滑翔翼」會看不懂為什麼，
 * 所以命中的不是任務名時，列表第二行改印這裡的「標籤：文字」。
 * 順序就是優先順序：同一個任務命中好幾項時顯示最前面的那項。
 */
const SEARCH_INDEX = new Map<string, [label: string, text: string, lower: string][]>(
  quests.map((q) => {
    const rows: [string, string][] = [];
    const amount = (n: number) => (n > 1 ? ` ×${n}` : "");
    for (const m of q.kill ?? []) rows.push(["要打", `${questMobName(m.id)} ×${m.n}`]);
    for (const it of q.need) rows.push(["要繳", `${questItemName(it.id)}${amount(it.n)}`]);
    for (const it of q.rewards) rows.push(["獎勵", `${questItemName(it.id)}${amount(it.n)}`]);
    for (const sk of q.skills ?? []) rows.push(["獎勵", questSkillName(sk.id)]);
    if (q.npc) rows.push(["NPC", q.npc]);
    const map = q.npcMap != null ? questMapInfo(q.npcMap) : undefined;
    if (map) rows.push(["地點", map.name]);
    if (q.region) rows.push(["地點", q.region]);
    if (q.series) rows.push(["系列", q.series]);
    return [q.id, rows.map(([label, text]) => [label, text, text.toLowerCase()])];
  }),
);

/** 回傳 true = 任務名（或編號）命中；字串 = 命中的是別的東西，印在列表上；null = 沒命中 */
function searchHit(q: Quest, kw: string): true | string | null {
  if (q.name.toLowerCase().includes(kw) || q.id === kw) return true;
  const hit = SEARCH_INDEX.get(q.id)?.find(([, , lower]) => lower.includes(kw));
  return hit ? `${hit[0]}：${hit[1]}` : null;
}

/** 有自己一頁的怪（/monsters/<id>）。任務專用的怪（受污染的猴子…）不在圖鑑裡，沒有頁面可連 */
const MOB_PAGES = new Set(monsters.map((m) => m.id));

/** 活動已經結束。now 由元件用 useState 取一次傳進來（render 裡不能直接讀時鐘） */
const isEnded = (q: Quest, now: number) => !!q.ev?.[1] && new Date(q.ev[1]).getTime() < now;

const lvLabel = (lv: number) => (lv > 0 ? `Lv.${lv}` : "無限制");

/** 96 個任務有等級上限（例：#1034 只有 Lv.10 以下接得到），只印下限會讓人白跑一趟 */
const lvRangeLabel = (q: Quest) => {
  if (!q.lvMax) return lvLabel(q.lv);
  return q.lv > 0 ? `Lv.${q.lv}–${q.lvMax}` : `Lv.${q.lvMax} 以下`;
};

/** 可重複任務的間隔，客戶端存的是分鐘（目前全部是 1440） */
const repeatLabel = (min: number) =>
  min % 1440 === 0 ? `${min / 1440} 天` : min % 60 === 0 ? `${min / 60} 小時` : `${min} 分鐘`;

/**
 * 活動期間。開始時間是 00:00 就只寫日期；結束時間一律帶時間——
 * 客戶端多半寫「11/12 00:00」，只寫 11/12 會被讀成那天整天還能接。
 */
const evLabel = ([s, e]: [string | null, string | null]) => {
  const day = (v: string) => `${+v.slice(5, 7)}/${+v.slice(8, 10)}`;
  const time = (v: string) => v.slice(11, 16);
  const start = s && (time(s) === "00:00" ? day(s) : `${day(s)} ${time(s)}`);
  const end = e && `${day(e)} ${time(e)}`;
  if (start && end) return `活動 ${start} ～ ${end}`;
  return end ? `活動・到 ${end}` : `活動・${start} 開始`;
};

/** 千分位：獎勵/花費動輒六七位數，不分隔根本讀不出來 */
const num = (n: number) => n.toLocaleString("en-US");

/** 活動任務的大分類名（build-quest-data.py 的 AREAS[50]），chip 上掛日曆圖示 */
const EVENT_CAT = "活動";
/**
 * 系統直接發的任務（build-quest-data.py 的 SYSTEM_AREAS）。NPC 是達利額的稱號分身、
 * 菇菇通行證的茱妮這種介面 NPC，查不到地圖是正常的，不要印「劇情中出現」。
 */
const SYSTEM_CATS = new Set(["稱號", EVENT_CAT]);

/**
 * chip 上的任務數。鍵是「大分類」或「大分類/小地區」。
 * 分類是兩層（2026-11-16 改）：第一排是遊戲內任務視窗的大分類，選了有小地區的
 * （維多利亞島、冰原雪域山脈）才出現第二排。以前第一排直接放 13 個小地區，要橫向捲。
 */
const COUNT = (() => {
  const count = new Map<string, number>();
  const add = (k: string) => count.set(k, (count.get(k) ?? 0) + 1);
  for (const q of quests) {
    add(q.cat);
    if (q.region) add(`${q.cat}/${q.region}`);
  }
  return count;
})();

function QuestPageSkeleton() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="maple-loader" />
      <p className="text-sm text-[var(--text-muted)]">載入中…</p>
    </div>
  );
}

const HEADER = (
  <PageHeader
    title="任務查詢"
    description="任務的接取條件、要打的怪與要繳的道具、獎勵，附任務流程與 NPC 所在地圖"
  />
);

export default function QuestPage() {
  // fallback 也要有標題：靜態輸出時這頁只會產出 fallback，見 PageHeader 的註解
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          {HEADER}
          <QuestPageSkeleton />
        </div>
      }
    >
      <QuestExplorer />
    </Suspense>
  );
}

function QuestExplorer() {
  // ?q= 搜尋、?id= 直接選中某個任務（分享連結用，也是未來換成 /quests/<id> 的接口）。
  // 用 useSearchParams 而不是 effect 讀 location，伺服器端第一次渲染就吃得到參數，
  // 不會先閃過未篩選的清單（怪物頁踩過這個坑）。
  const searchParams = useSearchParams();
  const q0 = searchParams.get("q") ?? "";
  const id0 = searchParams.get("id");

  const [kw, setKw] = useState(q0);
  const [cat, setCat] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selId, setSelId] = useState<string | null>(id0);
  const [rewardPop, setRewardPop] = useState<QuestItem | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const tip = useItemTooltip();

  /** hits：命中的不是任務名時，列表第二行要印的原因（見 SEARCH_INDEX） */
  const { filtered, hits } = useMemo(() => {
    const word = kw.trim().toLowerCase();
    const hits = new Map<string, string>();
    const filtered = quests.filter((q) => {
      if (cat && q.cat !== cat) return false;
      if (sub && q.region !== sub) return false;
      if (!word) return true;
      const hit = searchHit(q, word);
      if (typeof hit === "string") hits.set(q.id, hit);
      return hit !== null;
    });
    return { filtered, hits };
  }, [kw, cat, sub]);
  const subs = questCats.find((c) => c.name === cat)?.subs;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const p = Math.min(page, pageCount - 1);
  const rows = filtered.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
  const selected = selId ? quests.find((q) => q.id === selId) : undefined;

  /**
   * 從獎勵反查彈窗或任務鏈跳過去時，順便把清單翻到那個任務所在的頁，
   * 否則右邊顯示著一個左邊清單上看不到的任務，很容易迷失位置。
   * 寫成 helper 而不是 effect：effect 裡 setState 會多跑一輪 render，
   * 而且 lint 也擋（react-hooks/set-state-in-effect）。
   */
  const selectQuest = (id: string) => {
    setSelId(id);
    const idx = filtered.findIndex((q) => q.id === id);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE));
  };

  /** 分頁列的等級區間標籤：按等級排序 + 分頁，不標的話翻頁只能用猜的 */
  const pageRange = (i: number) => {
    const slice = filtered.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
    if (!slice.length) return "";
    const lo = slice[0].lv;
    const hi = slice[slice.length - 1].lv;
    return lo === hi ? lvLabel(lo) : `${lvLabel(lo)}–${hi}`;
  };

  return (
    <div className="space-y-6">
      <div>
        {HEADER}
        <div className="relative mt-4 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            value={kw}
            onChange={(e) => {
              setKw(e.target.value);
              setPage(0);
            }}
            placeholder="搜尋任務、NPC、怪物、道具…"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
          />
          {kw && (
            <button
              onClick={() => {
                setKw("");
                setPage(0);
              }}
              aria-label="清除搜尋"
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {/* 第一排：大分類。七個，用換行不用橫向捲（窄視窗也看得到全部） */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <RegionChip
            label="全部"
            active={cat === null}
            onClick={() => {
              setCat(null);
              setSub(null);
              setPage(0);
            }}
          />
          {questCats.map(({ name }) => (
            <RegionChip
              key={name}
              label={`${name} ${COUNT.get(name) ?? 0}`}
              active={cat === name}
              icon={name === EVENT_CAT ? <CalendarDays size={12} /> : undefined}
              onClick={() => {
                setCat(cat === name ? null : name);
                setSub(null);
                setPage(0);
              }}
            />
          ))}
        </div>
        {/* 第二排：選了有小地區的大分類才出現，再點一次同一顆＝取消 */}
        {cat && subs ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5 border-l-2 border-[var(--border-strong)] pl-2">
            {subs.map((name) => (
              <RegionChip
                key={name}
                small
                label={`${name} ${COUNT.get(`${cat}/${name}`) ?? 0}`}
                active={sub === name}
                onClick={() => {
                  setSub(sub === name ? null : name);
                  setPage(0);
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-2 text-xs text-[var(--text-muted)]">
          共 {filtered.length} 個任務{kw.trim() && `符合「${kw.trim()}」`}
          {cat && `・${cat}`}
          {sub && `・${sub}`}・依需求等級排序
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
        <div>
          <div className="themed-scroll max-h-[40vh] space-y-0.5 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5 lg:max-h-[70vh] lg:border-0 lg:p-0 lg:pr-2">
            {rows.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
                沒有符合的任務，試著換個關鍵字。
              </div>
            )}
            {rows.map((q) => (
              <QuestCard
                key={q.id}
                q={q}
                hit={hits.get(q.id)}
                ended={isEnded(q, now)}
                active={q.id === selId}
                onClick={() => setSelId(q.id)}
              />
            ))}
          </div>
          {pageCount > 1 && (
            <Pager page={p} pageCount={pageCount} onPage={setPage} rangeOf={pageRange} />
          )}
        </div>

        {selected ? (
          <QuestDetail
            q={selected}
            ended={isEnded(selected, now)}
            tip={tip}
            onPickQuest={selectQuest}
            onPickReward={setRewardPop}
            onOpenMap={() => setMapOpen(true)}
          />
        ) : (
          <div className="hidden text-sm text-[var(--text-muted)] lg:block">
            從左邊挑一個任務，這裡會顯示任務說明、要打的怪與要繳的道具、獎勵，還有前後的任務流程。
          </div>
        )}
      </div>

      {tip.id != null && (
        <ItemTooltip
          id={tip.id}
          panelRef={tip.panelRef}
          modal={!tip.hasHover}
          onClose={tip.close}
          searchLabel="哪些任務會給這個"
          onSearch={() => {
            const iid = tip.id;
            const it = quests.flatMap((q) => q.rewards).find((r) => r.id === iid);
            if (it) setRewardPop(it);
            tip.close();
          }}
        />
      )}

      {rewardPop && (
        <RewardPopup
          item={rewardPop}
          onClose={() => setRewardPop(null)}
          onPick={(id) => {
            selectQuest(id);
            setRewardPop(null);
          }}
        />
      )}
      {mapOpen && selected?.npcMap != null && (
        <MapModal q={selected} onClose={() => setMapOpen(false)} />
      )}
    </div>
  );
}

function RegionChip({
  label,
  active,
  icon,
  small,
  onClick,
}: {
  label: string;
  active: boolean;
  /** 「活動」掛日曆 */
  icon?: React.ReactNode;
  /** 第二排的小地區：矮一點，跟第一排分得出層級 */
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer inline-flex shrink-0 items-center gap-1 rounded-full border text-xs transition-colors ${
        small ? "px-2.5 py-0.5" : "px-3 py-1"
      } ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------- 列表卡片 ---------- */

function QuestCard({
  q,
  hit,
  ended,
  active,
  onClick,
}: {
  q: Quest;
  /** 搜尋命中的不是任務名時的原因（「要繳：蝙蝠翅膀 ×50」），取代第二行的 NPC */
  hit?: string;
  /** 活動已結束 */
  ended: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
        active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]/40"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full text-[10px] font-semibold leading-none"
        style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
      >
        {q.lv > 0 ? (
          <>
            <span className="text-[8px] opacity-70">Lv</span>
            <span className="text-xs">{q.lv}</span>
          </>
        ) : (
          <span className="text-[9px]">不限</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="truncate">{q.name}</span>
          {!q.released && <Telescope size={12} className="shrink-0 text-[var(--text-muted)]" />}
          {ended && <EndedBadge />}
        </span>
        {hit ? (
          <span className="block truncate text-xs text-[var(--accent-text)]">{hit}</span>
        ) : (
          <span className="block truncate text-xs text-[var(--text-muted)]">
            {[q.npc, q.region].filter(Boolean).join("・") || "—"}
          </span>
        )}
      </span>
    </button>
  );
}

/** 活動期間已過。客戶端到下次更新前都還留著這些任務（萬聖節那 75 個） */
function EndedBadge() {
  return (
    <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 text-[10px] font-normal text-[var(--text-muted)]">
      已結束
    </span>
  );
}

/* ---------- 分頁 ---------- */

function Pager({
  page,
  pageCount,
  onPage,
  rangeOf,
}: {
  page: number;
  pageCount: number;
  onPage: (n: number) => void;
  rangeOf: (i: number) => string;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
      <button
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="cursor-pointer flex items-center gap-0.5 rounded-full px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-default disabled:opacity-30 dark:disabled:opacity-45"
      >
        <ChevronLeft size={14} />
        上一頁
      </button>
      <div className="text-center text-xs">
        <div className="font-medium">
          第 {page + 1} / {pageCount} 頁
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">{rangeOf(page)}</div>
      </div>
      <button
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
        className="cursor-pointer flex items-center gap-0.5 rounded-full px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-default disabled:opacity-30 dark:disabled:opacity-45"
      >
        下一頁
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ---------- 詳情面板 ---------- */

function QuestDetail({
  q,
  ended,
  tip,
  onPickQuest,
  onPickReward,
  onOpenMap,
}: {
  q: Quest;
  /** 活動已結束 */
  ended: boolean;
  tip: Tip;
  onPickQuest: (id: string) => void;
  onPickReward: (i: QuestItem) => void;
  onOpenMap: () => void;
}) {
  const flow = flowOf(q);
  const mapInfo = q.npcMap != null ? questMapInfo(q.npcMap) : undefined;
  const hasReward = !!(q.rewards.length || q.exp || q.money || q.pop || q.skill);
  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold">{q.name}</h2>
          {!q.released && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
              <Telescope size={12} />
              未實裝
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
          <span>#{q.id}</span>
          <span>需求等級 {lvRangeLabel(q)}</span>
          {q.repeat ? <span>可重複（間隔 {repeatLabel(q.repeat)}）</span> : null}
          {q.ev ? (
            <span
              title={q.ev.filter(Boolean).join(" ～ ").replaceAll("T", " ")}
              className="flex items-center gap-1"
            >
              <CalendarDays size={13} />
              {evLabel(q.ev)}
              {ended && <EndedBadge />}
            </span>
          ) : null}
        </div>
      </div>

      {/* 任務說明：遊戲任務視窗裡那段字。237 個任務沒有結構化的完成條件（條件在伺服器端腳本），
          要做什麼只寫在這裡——以前沒顯示，還印成「跟 NPC 對話就完成」（2026-11-16 站長回報） */}
      {q.desc ? (
        <Section title="任務說明">
          <p className="max-w-prose text-sm leading-relaxed">
            <Desc text={q.desc} />
          </p>
        </Section>
      ) : null}

      {flow && <QuestFlowCard flow={flow} q={q} onPick={onPickQuest} />}

      <Section title="任務 NPC">
        {q.npc ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-soft)]">
              {q.npcId != null ? (
                <GameIcon
                  src={npcIconSrc(q.npcId)}
                  alt={q.npc}
                  fallback="🧑"
                  className="h-12 w-12"
                />
              ) : (
                <span className="text-xl">🧑</span>
              )}
            </span>
            <span className="font-medium">{q.npc}</span>
            {/* 隱藏地圖與活動地圖（詛咒之林、雪原的面具祭典現場…）在世界地圖上沒有點位，
                也借不到鄰居，點了開不出地圖，所以只印名字不做成按鈕 */}
            {mapInfo?.wm ? (
              <button
                onClick={onOpenMap}
                className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
              >
                <MapPin size={12} />
                {mapInfo.name}
              </button>
            ) : mapInfo ? (
              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <MapPin size={12} />
                {mapInfo.name}
              </span>
            ) : SYSTEM_CATS.has(q.cat) ? null : (
              <span className="text-xs text-[var(--text-muted)]">劇情中出現</span>
            )}
          </div>
        ) : (
          <Empty>無指定 NPC</Empty>
        )}
      </Section>

      {/* 接取條件：職業限制（227 個任務有）與互斥任務。
          客戶端的 `have`（身上要有的道具）**刻意不顯示**：20 個楓之島教學任務都寫
          「要有維澤特西裝」，那不是玩家要準備的東西；其餘的也都是前一步任務給的，
          任務鏈已經講過了。資料還留在 quests.json，要復活再說。 */}
      {q.jobs?.length || q.exclude?.length ? (
        <Section title="接取條件">
          <div className="space-y-2">
            {q.jobs?.length ? (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-[var(--text-muted)]">職業</span>
                {q.jobs.map((j) => (
                  <span
                    key={j}
                    className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"
                  >
                    {j}
                  </span>
                ))}
              </div>
            ) : null}
            {/* 互斥（Check["0"].quest 的 state 0）：五條「XX 之路」轉職任務只能挑一條 */}
            {q.exclude?.length ? (
              <QuestLinks label="接過這些就不能接" ids={q.exclude} onPick={onPickQuest} />
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* 完成條件 = 先做完的任務（母任務等子任務）＋ 打倒怪物 ＋ 繳交道具。
          三樣都沒有就整段不畫：以前印「不用打怪也不用繳道具，跟 NPC 對話就完成」，
          但那多半是條件寫在伺服器端腳本、客戶端沒有結構化資料而已（捐獻王要捐錢、
          精明的獵人要打十萬隻），是錯的。要做什麼看上面的任務說明 */}
      {q.needQ?.length || q.kill?.length || q.need.length ? (
        <Section title="完成條件">
          <div className="space-y-3">
            {q.needQ?.length ? (
              <QuestLinks label="要先完成" ids={q.needQ} onPick={onPickQuest} />
            ) : null}
            {q.kill?.length ? <MobRow mobs={q.kill} /> : null}
            {q.need.length ? <NeedList q={q} tip={tip} onPickQuest={onPickQuest} /> : null}
          </div>
        </Section>
      ) : null}

      {q.cost ? (
        <Section title="花費">
          <span className="flex w-fit items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
            <Coins size={13} />
            {num(q.cost)} 楓幣
          </span>
        </Section>
      ) : null}

      {/* 查不到獎勵就整段不畫。客戶端有 81 個任務的獎勵在伺服器端腳本裡，
          之前印過「沒有獎勵」「獎勵在伺服器端查不到」兩種說明，都是廢話——
          畫面上少一塊比多一句解釋乾淨。 */}
      {hasReward ? (
        <Section title="獎勵">
          <div className="space-y-3">
            {(q.exp || q.money || q.pop || q.skill) && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {q.exp ? <Stat icon={<Sparkles size={13} />} label={`經驗 ${num(q.exp)}`} /> : null}
                {q.money ? <Stat icon={<Coins size={13} />} label={`${num(q.money)} 楓幣`} /> : null}
                {q.pop ? <Stat icon={<Sparkles size={13} />} label={`名聲 +${q.pop}`} /> : null}
                {q.skill && !q.skills?.length ? <Stat icon={<Zap size={13} />} label="技能" /> : null}
              </div>
            )}
            {/* 技能獎勵要印名字：只寫「技能」等於沒講。m = 精通書（把上限拉到 N 級） */}
            {q.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {q.skills.map((sk, i) => (
                  <span
                    key={`${sk.id}-${i}`}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-sm"
                  >
                    <Zap size={13} className="text-[var(--accent-text)]" />
                    {questSkillName(sk.id)}
                    {sk.job?.length ? (
                      <span className="text-xs text-[var(--text-muted)]">{sk.job.join("、")}</span>
                    ) : null}
                    <span className="text-xs text-[var(--text-muted)]">
                      {sk.m && sk.m > 1 ? `上限 ${sk.m} 級（精通書）` : `學到 ${sk.lv ?? 1} 級`}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
            {q.rewards.length ? <RewardItems q={q} tip={tip} onPick={onPickReward} /> : null}

            {q.sup ? (
              <div className="text-[11px] text-[var(--text-muted)]">
                ＊部分獎勵來自玩家回報補充，非客戶端資料
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

/** 一串可點的任務名（「接過這些就不能接」「要先完成」） */
function QuestLinks({
  label,
  ids,
  onPick,
}: {
  label: string;
  ids: string[];
  onPick: (id: string) => void;
}) {
  return (
    <p className="text-xs text-[var(--text-muted)]">
      {label}：
      {ids.map((id, i) => {
        const other = questById(id);
        return (
          <span key={id}>
            {i > 0 && "、"}
            {other ? (
              <button
                onClick={() => onPick(other.id)}
                className="cursor-pointer text-[var(--accent-text)] hover:underline"
              >
                {other.name}
              </button>
            ) : (
              `#${id}`
            )}
          </span>
        );
      })}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">{title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-[var(--text-muted)]">{children}</div>;
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * 完成條件的「打倒怪物」。點下去到那隻怪自己的頁面——查任務的人下一步通常就是
 * 「這隻怪在哪打」，而那頁有出沒地圖。任務專用的怪（受污染的猴子…）不在圖鑑裡，
 * 沒有頁面可連，只印名字。
 */
function MobRow({ mobs }: { mobs: QuestMob[] }) {
  const box =
    "flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 pl-1.5 pr-2.5 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      {mobs.map((m) => {
        const inner = (
          <>
            <GameIcon src={mobIconSrc(String(m.id))} alt="" fallback="👾" className="h-8 w-8" />
            <span>{questMobName(m.id)}</span>
            <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
              ×{m.n}
            </span>
          </>
        );
        return MOB_PAGES.has(String(m.id)) ? (
          <NoPrefetchLink
            key={m.id}
            href={`/monsters/${m.id}`}
            className={`${box} transition-colors hover:border-[var(--accent)]`}
          >
            {inner}
          </NoPrefetchLink>
        ) : (
          <span key={m.id} className={box}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}

/** 道具 → 會給它的任務（獎勵，或接任務時 NPC 先塞的）。要繳的道具標來源用 */
const GIVERS = (() => {
  const out = new Map<number, Quest[]>();
  for (const q of quests) {
    for (const it of [...q.rewards, ...(q.give ?? [])]) {
      const list = out.get(it.id) ?? [];
      if (!list.includes(q)) out.set(it.id, [...list, q]);
    }
  }
  return out;
})();

/**
 * 完成條件的「要繳的道具」：一列一個，完整名稱＋數量，下面一行寫哪裡來。
 * 2026-11-16 以前是「圖示＋名稱前兩字」的格子（跟獎勵同款），站長回報不好查——
 * 要繳的東西是玩家接下來要去弄的，名字要看得到全名，更想知道「打誰會掉」。
 * 來源依序判斷：
 *   1. 這個任務接下去時 NPC 就會給（give）→ 不用找
 *   2. 同一條任務流程裡別的任務會給 → 連到那個任務（限同一條流程：
 *      紅色藥水這種到處都在送的，列出不相干的任務只是雜訊）
 *   3. 怪會掉（build 時算好的 from）→ 怪名連到怪物頁，超過 6 隻的連到道具頁看全部
 * 三種都不是（NPC 賣的、地圖上撿的、腳本給的）就不寫，客戶端查不到。
 */
function NeedList({
  q,
  tip,
  onPickQuest,
}: {
  q: Quest;
  tip: Tip;
  onPickQuest: (id: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {q.need.map((it, idx) => {
        const info = questItemInfo(it.id);
        const name = info?.name ?? `#${it.id}`;
        const given = q.give?.some((g) => g.id === it.id);
        const givers =
          q.f === undefined
            ? []
            : (GIVERS.get(it.id) ?? []).filter((o) => o.id !== q.id && o.f === q.f);
        const from = info?.from ?? [];
        return (
          <li key={`${it.id}-${idx}`} className="flex items-start gap-2.5">
            <button
              {...tip.handlers(it.id)}
              aria-label={`${name} 的道具說明`}
              className="flex h-10 w-10 shrink-0 cursor-default items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            >
              <GameIcon src={itemIconSrc(it.id)} alt="" fallback="📦" className="h-8 w-8" />
            </button>
            <div className="min-w-0 flex-1 py-0.5 text-sm">
              <div>
                {name}
                <span className="ml-1.5 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
                  ×{num(it.n)}
                </span>
              </div>
              {given ? (
                <div className="text-xs text-[var(--text-muted)]">接任務時 NPC 會給</div>
              ) : givers.length ? (
                <div className="text-xs text-[var(--text-muted)]">
                  {givers.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && "、"}
                      <button
                        onClick={() => onPickQuest(o.id)}
                        className="cursor-pointer text-[var(--accent-text)] hover:underline"
                      >
                        {o.name}
                      </button>
                    </span>
                  ))}{" "}
                  會給
                </div>
              ) : from.length ? (
                <div className="text-xs text-[var(--text-muted)]">
                  掉落：
                  {from.map((mid, i) => (
                    <span key={mid}>
                      {i > 0 && "、"}
                      <NoPrefetchLink
                        href={`/monsters/${mid}`}
                        className="text-[var(--accent-text)] hover:underline"
                      >
                        {questMobName(mid)}
                      </NoPrefetchLink>
                    </span>
                  ))}
                  {info?.fromN ? (
                    <>
                      {" "}
                      <NoPrefetchLink
                        href={`/items/${it.id}`}
                        className="whitespace-nowrap hover:underline"
                      >
                        等 {info.fromN} 隻
                      </NoPrefetchLink>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 獎勵道具。**有職業限定的要分組印**——#2001 酋長蓋房子有 16 張攻擊卷軸，
 * 但一個人只拿得到自己職業的那幾張，攤平印會看起來像全給你。
 * 只有一組（例：整個任務本來就只有初心者能接）就照舊平鋪，不用多一層標題。
 */
function RewardItems({
  q,
  tip,
  onPick,
}: {
  q: Quest;
  tip: Tip;
  onPick: (i: QuestItem) => void;
}) {
  const groups = new Map<string, QuestItem[]>();
  for (const it of q.rewards) {
    const key = it.job?.length ? it.job.join("、") : "";
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const keyed = [...groups.entries()].filter(([k]) => k);
  if (keyed.length < 2) return <ItemRow items={q.rewards} tip={tip} onPick={onPick} />;

  const common = groups.get("") ?? [];
  return (
    <div className="space-y-2">
      {common.length ? <ItemRow items={common} tip={tip} onPick={onPick} /> : null}
      <p className="text-xs text-[var(--text-muted)]">依職業給不同道具，只會拿到自己那一份：</p>
      {keyed.map(([job, items]) => (
        <div key={job} className="flex flex-wrap items-start gap-2">
          <span className="mt-1 shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
            {job}
          </span>
          <ItemRow items={items} tip={tip} onPick={onPick} />
        </div>
      ))}
    </div>
  );
}

/**
 * 道具格子（獎勵用）：icon ＋ 下方名稱前兩字 ＋ 右上角數量。
 * 前兩字標籤是因為卷軸類 icon 幾乎長一樣（同一個任務給五張不同卷軸時完全分不出來），
 * 數量徽章也因此掛右上角，不然會壓到標籤。
 */
function ItemRow({
  items,
  tip,
  onPick,
}: {
  items: QuestItem[];
  tip: Tip;
  onPick?: (i: QuestItem) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, idx) => {
        const name = questItemName(it.id);
        return (
          <button
            key={`${it.id}-${idx}`}
            {...tip.handlers(it.id, onPick ? () => onPick(it) : undefined)}
            aria-label={name}
            className={`relative flex h-14 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors ${
              onPick ? "cursor-pointer hover:border-[var(--accent)]" : "cursor-default"
            }`}
          >
            <GameIcon src={itemIconSrc(it.id)} alt="" fallback="📦" className="h-8 w-8" />
            <span className="w-full truncate px-0.5 text-center text-[10px] leading-none text-[var(--text-muted)]">
              {name.slice(0, 2)}
            </span>
            {it.n > 1 && (
              <span className="absolute -right-1 -top-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1 text-[10px] font-semibold tabular-nums shadow-sm">
                {it.n}
              </span>
            )}
            {/* 男女版本不同的獎勵（#2023 桑那服、#2046 黑飛影之服），不標會以為兩件都拿 */}
            {it.g === 0 || it.g === 1 ? (
              <span className="absolute -left-1 -top-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1 text-[10px] font-semibold shadow-sm">
                {it.g === 0 ? "♂" : "♀"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 彈窗 ---------- */

/** 點獎勵道具 → 反查「還有哪些任務給這個」，不離開目前任務 */
function RewardPopup({
  item,
  onClose,
  onPick,
}: {
  item: QuestItem;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const givers = quests.filter((q) => q.rewards.some((r) => r.id === item.id));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="themed-scroll max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="font-semibold">哪些任務會給「{questItemName(item.id)}」</div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="cursor-pointer shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1">
          {givers.map((q) => (
            <button
              key={q.id}
              onClick={() => onPick(q.id)}
              className="cursor-pointer flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/50"
            >
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate">{q.name}</span>
                {!q.released && (
                  <Telescope size={11} className="shrink-0 text-[var(--text-muted)]" />
                )}
              </span>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{lvLabel(q.lv)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** NPC 所在地的世界地圖彈窗（同怪物頁的做法，重用 WorldMapView） */
function MapModal({ q, onClose }: { q: Quest; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = q.npcMap != null ? questMapInfo(q.npcMap) : undefined;
  const wm = info?.wm;
  const sheet = wm ? questWorldMapSheet(wm.s) : undefined;
  if (!info || !wm || !sheet) return null;

  const dots: WorldMapDot[] = [
    ...sheet.spots
      .filter(([x, y]) => !(x === wm.x && y === wm.y))
      .map(([x, y]) => ({ key: `bg-${x},${y}`, x, y, dim: true })),
    { key: String(q.npcMap), x: wm.x, y: wm.y, focus: true, approx: !!wm.a, title: info.name },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <MapPin size={16} className="shrink-0" style={{ color: "var(--accent-text)" }} />
          <span className="shrink-0 text-sm font-semibold">{sheet.title}</span>
          <span className="min-w-0 truncate text-sm text-[var(--text-muted)]">
            {info.street ? `${info.street}・${info.name}` : info.name}
          </span>
          {wm.a ? (
            <span className="shrink-0 rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
              約略位置
            </span>
          ) : null}
          <button
            onClick={onClose}
            aria-label="關閉"
            className="cursor-pointer ml-auto shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>
        <WorldMapView
          src={worldMapSrc(wm.s)}
          alt={sheet.title}
          w={sheet.w}
          h={sheet.h}
          dots={dots}
        />
      </div>
    </div>
  );
}
