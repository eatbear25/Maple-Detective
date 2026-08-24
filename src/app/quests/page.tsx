"use client";

// 任務查詢：搜尋（任務名 / 獎勵道具名）→ 列表（依需求等級排序、分頁）→ 右側詳情。
// 詳情最上面是系列鏈卡片（可收合），接著 NPC、接任務時拿到的道具、需求道具、獎勵。
// 道具只放 icon + 前兩字標籤 + 數量，沒有敘述文字；hover 才出道具彈窗。

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
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
  chainOf,
  npcIconSrc,
  questById,
  questItemName,
  questMobName,
  questRegion,
  questSkillName,
  questMapInfo,
  questWorldMapSheet,
  questRegions,
  quests,
  type Quest,
  type QuestItem,
  type QuestMob,
} from "@/data/quests";
import { itemIconSrc, mobIconSrc, worldMapSrc } from "@/data/drops";
import { GameIcon } from "../monsters/game-icon";
import { ItemTooltip, useItemTooltip } from "../monsters/item-tooltip";
import { WorldMapView, type WorldMapDot } from "../worldmap-view";

const PAGE_SIZE = 50;

type Tip = ReturnType<typeof useItemTooltip>;

/** 搜尋維度：任務名 + 獎勵道具名（不吃 NPC 名與需求道具，定案如此） */
function matches(q: Quest, kw: string) {
  if (q.name.includes(kw) || q.id === kw) return true;
  return q.rewards.some((r) => questItemName(r.id).includes(kw));
}

const lvLabel = (lv: number) => (lv > 0 ? `Lv.${lv}` : "無限制");

/** 96 個任務有等級上限（例：#1034 只有 Lv.10 以下接得到），只印下限會讓人白跑一趟 */
const lvRangeLabel = (q: Quest) => {
  if (!q.lvMax) return lvLabel(q.lv);
  return q.lv > 0 ? `Lv.${q.lv}–${q.lvMax}` : `Lv.${q.lvMax} 以下`;
};

/** 可重複任務的間隔，客戶端存的是分鐘（目前全部是 1440） */
const repeatLabel = (min: number) =>
  min % 1440 === 0 ? `${min / 1440} 天` : min % 60 === 0 ? `${min / 60} 小時` : `${min} 分鐘`;

/** 千分位：獎勵/花費動輒六七位數，不分隔根本讀不出來 */
const num = (n: number) => n.toLocaleString("en-US");

/**
 * 地區判不出來的任務歸這一類。判不出來 ⇔ 這個任務的 NPC 全都不在已實裝地圖上，
 * 所以這一類就等於未實裝任務（166 個），標題直接講白，不要留一個看不懂的「未知」。
 */
const UNKNOWN_REGION = "未實裝";

/** 地區 chips：順序由 build-quest-data.py 給（大致依遊戲地理動線），「未實裝」擺最後 */
const REGIONS: [string, number][] = (() => {
  const count = new Map<string, number>();
  for (const q of quests) {
    const r = questRegion(q) ?? UNKNOWN_REGION;
    count.set(r, (count.get(r) ?? 0) + 1);
  }
  return [...questRegions, UNKNOWN_REGION]
    .filter((r) => count.has(r))
    .map((r): [string, number] => [r, count.get(r)!]);
})();

function QuestPageSkeleton() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="maple-loader" />
      <p className="text-sm text-[var(--text-muted)]">載入中…</p>
    </div>
  );
}

export default function QuestPage() {
  return (
    <Suspense fallback={<QuestPageSkeleton />}>
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
  const [region, setRegion] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selId, setSelId] = useState<string | null>(id0);
  const [rewardPop, setRewardPop] = useState<QuestItem | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const tip = useItemTooltip();

  const filtered = useMemo(() => {
    let out = kw ? quests.filter((q) => matches(q, kw)) : quests;
    if (region) out = out.filter((q) => (questRegion(q) ?? UNKNOWN_REGION) === region);
    return out;
  }, [kw, region]);
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
        <h1 className="text-xl font-semibold">任務查詢</h1>
        <div className="relative mt-3 max-w-md">
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
            placeholder="搜尋任務名稱或獎勵道具…"
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
        <div className="themed-scroll mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <RegionChip label="全部" active={region === null} onClick={() => setRegion(null)} />
          {REGIONS.map(([name, n]) => (
            <RegionChip
              key={name}
              label={`${name} ${n}`}
              active={region === name}
              icon={name === UNKNOWN_REGION}
              onClick={() => {
                setRegion(region === name ? null : name);
                setPage(0);
              }}
            />
          ))}
        </div>

        <div className="mt-2 text-xs text-[var(--text-muted)]">
          共 {filtered.length} 個任務{kw && `符合「${kw}」`}
          {region && `・${region}`}・依需求等級排序
          {region === UNKNOWN_REGION && "（這些任務的 NPC 目前都不在遊戲裡，查不到地點）"}
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
            tip={tip}
            onPickQuest={selectQuest}
            onPickReward={setRewardPop}
            onOpenMap={() => setMapOpen(true)}
          />
        ) : (
          <div className="hidden text-sm text-[var(--text-muted)] lg:block">
            從左邊挑一個任務，這裡會顯示 NPC、需求道具、獎勵與所屬任務鏈。
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
  onClick,
}: {
  label: string;
  active: boolean;
  /** 「未實裝」那顆掛望遠鏡，跟任務卡片上的未實裝徽章同一個符號 */
  icon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
      }`}
    >
      {icon && <Telescope size={12} />}
      {label}
    </button>
  );
}

/* ---------- 列表卡片 ---------- */

function QuestCard({
  q,
  active,
  onClick,
}: {
  q: Quest;
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
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
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
        </span>
        <span className="block truncate text-xs text-[var(--text-muted)]">{q.npc ?? "—"}</span>
      </span>
    </button>
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
        className="cursor-pointer flex items-center gap-0.5 rounded-full px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-default disabled:opacity-30"
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
        className="cursor-pointer flex items-center gap-0.5 rounded-full px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-default disabled:opacity-30"
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
  tip,
  onPickQuest,
  onPickReward,
  onOpenMap,
}: {
  q: Quest;
  tip: Tip;
  onPickQuest: (id: string) => void;
  onPickReward: (i: QuestItem) => void;
  onOpenMap: () => void;
}) {
  const chain = chainOf(q);
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
        </div>
      </div>

      {chain.length > 1 && (
        <QuestChainCard chain={chain} current={q.id} series={q.series} onPick={onPickQuest} />
      )}

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
            {mapInfo ? (
              <button
                onClick={onOpenMap}
                className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <MapPin size={12} />
                {mapInfo.name}
              </button>
            ) : (
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
              <p className="text-xs text-[var(--text-muted)]">
                接過這些就不能接：
                {q.exclude.map((id, i) => {
                  const other = questById(id);
                  return (
                    <span key={id}>
                      {i > 0 && "、"}
                      {other ? (
                        <button
                          onClick={() => onPickQuest(other.id)}
                          className="cursor-pointer text-[var(--accent)] hover:underline"
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
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* 完成條件 = 打倒怪物（79 個任務，以前完全沒顯示）＋ 繳交道具 */}
      <Section title="完成條件">
        {q.kill?.length || q.need.length ? (
          <div className="space-y-3">
            {q.kill?.length ? <MobRow mobs={q.kill} /> : null}
            {q.need.length ? <ItemRow items={q.need} tip={tip} /> : null}
          </div>
        ) : (
          <Empty>不用打怪也不用繳道具，跟 NPC 對話就完成</Empty>
        )}
      </Section>

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
                    <Zap size={13} className="text-[var(--accent)]" />
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
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * 道具格子：icon ＋ 下方名稱前兩字 ＋ 右上角數量。
 * 前兩字標籤是因為卷軸類 icon 幾乎長一樣（同一個任務要五張不同卷軸時完全分不出來），
 * 數量徽章也因此掛右上角，不然會壓到標籤。
 */
/**
 * 完成條件的「打倒怪物」。點下去跳怪物掉落查詢——查任務的人下一步通常就是
 * 「這隻怪在哪打」，而那頁已經有出沒地圖了。
 */
function MobRow({ mobs }: { mobs: QuestMob[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {mobs.map((m) => {
        const name = questMobName(m.id);
        return (
          <a
            key={m.id}
            href={`/monsters?q=${encodeURIComponent(name)}`}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 pl-1.5 pr-2.5 text-sm transition-colors hover:border-[var(--accent)]"
          >
            <GameIcon src={mobIconSrc(String(m.id))} alt="" fallback="👾" className="h-8 w-8" />
            <span>{name}</span>
            <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
              ×{m.n}
            </span>
          </a>
        );
      })}
    </div>
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

/* ---------- 系列鏈：置頂的可收合卡片 ---------- */

/**
 * 擺在詳情最上面，因為「這條線有幾步、我在第幾步」是進來第一個要回答的問題。
 * 每個節點自己是一張小卡，目前這步用 accent 邊框＋底色拉出層次。
 * 長鏈（最長 21 步）可以收起來，收起時標題列仍寫「第 N / M 步」。
 */
function QuestChainCard({
  chain,
  current,
  series,
  onPick,
}: {
  chain: Quest[];
  current: string;
  series?: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const idx = chain.findIndex((q) => q.id === current);
  /* 互斥的分支（五條「XX 之路」）會落在同一條鏈上，編號印成 1→6 會被讀成先後順序。
     標出跟目前這步互斥的那幾步，至少講清楚「只能挑一條」。 */
  const alt = new Set(chain.find((q) => q.id === current)?.exclude ?? []);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent-soft)]/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{series ?? "任務鏈"}</span>
          <span className="text-xs text-[var(--text-muted)]">
            第 {idx + 1} / {chain.length} 步
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <ol className="themed-scroll max-h-[45vh] space-y-1.5 overflow-y-auto border-t border-[var(--border)] p-3">
          {chain.map((q, i) => {
            const isCur = q.id === current;
            return (
              <li key={q.id} className="relative">
                {i > 0 && (
                  <span className="absolute -top-1.5 left-[22px] h-1.5 w-px bg-[var(--border)]" />
                )}
                <button
                  onClick={() => onPick(q.id)}
                  className={`cursor-pointer flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isCur
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)]"
                  }`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={
                      isCur
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--accent-soft)", color: "var(--accent)" }
                    }
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`flex items-center gap-1 truncate text-sm ${isCur ? "font-semibold" : ""}`}
                    >
                      <span className="truncate">{q.name}</span>
                      {alt.has(q.id) && (
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 text-[10px] font-normal text-[var(--text-muted)]">
                          擇一
                        </span>
                      )}
                      {!q.released && (
                        <Telescope size={11} className="shrink-0 text-[var(--text-muted)]" />
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">{lvLabel(q.lv)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
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
          <MapPin size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
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
