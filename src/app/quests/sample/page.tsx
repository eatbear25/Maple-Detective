"use client";

// 樣式 sample 頁（不進 nav、不接真資料）。列表卡片＝A3 左等級徽（定案），
// 系列鏈＝置頂的可收合卡片。定案後這個資料夾整個刪掉，樣式搬進 /quests。

import { useMemo, useState } from "react";
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
import { GameIcon } from "../../monsters/game-icon";
import { ItemTooltip, useItemTooltip } from "../../monsters/item-tooltip";
import {
  sampleItemInfo,
  sampleQuests,
  type SampleItem,
  type SampleQuest,
} from "./sample-data";

type Tip = ReturnType<typeof useItemTooltip>;

const PAGE_SIZE = 8; // 正式版是 50，這裡調小才看得到分頁
const itemIconSrc = (id: number) => `/icons/item/${id}.png`;

/** 搜尋：任務名 + 獎勵道具名（Q7 定案，不吃 NPC 名與需求道具） */
function matches(q: SampleQuest, kw: string) {
  if (!kw) return true;
  if (q.name.includes(kw)) return true;
  return q.rewards.some((r) => r.name.includes(kw));
}

const lvLabel = (lv: number) => (lv > 0 ? `Lv.${lv}` : "無限制");

/** 用前置關聯圖遍歷出整條任務鏈（Q19 定案：不只靠 series 名） */
function chainOf(target: SampleQuest): SampleQuest[] {
  const byId = new Map(sampleQuests.map((q) => [q.id, q]));
  const seen = new Set<string>([target.id]);
  const back: SampleQuest[] = [];
  let cur = target;
  while (cur.prereq.length) {
    const prev = byId.get(cur.prereq[0]);
    if (!prev || seen.has(prev.id)) break;
    seen.add(prev.id);
    back.unshift(prev);
    cur = prev;
  }
  const fwd: SampleQuest[] = [];
  cur = target;
  for (;;) {
    const next = sampleQuests.find((q) => q.prereq.includes(cur.id) && !seen.has(q.id));
    if (!next) break;
    seen.add(next.id);
    fwd.push(next);
    cur = next;
  }
  return [...back, target, ...fwd];
}

export default function QuestSamplePage() {
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(0);
  // 預設選「極致的試煉」第 3 步：一進來就看得到系列卡片的前後文（sample 專用）
  const [selId, setSelId] = useState<string>("6102");
  const [rewardPop, setRewardPop] = useState<SampleItem | null>(null);
  const [mapPop, setMapPop] = useState<SampleQuest | null>(null);
  const tip = useItemTooltip();

  const filtered = useMemo(
    () => sampleQuests.filter((q) => matches(q, kw)).sort((a, b) => a.lv - b.lv || +a.id - +b.id),
    [kw],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const p = Math.min(page, pageCount - 1);
  const rows = filtered.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
  const selected = sampleQuests.find((q) => q.id === selId);

  /** 分頁列上的等級區間標籤（規格裡標記的取捨補償：翻頁不用猜） */
  const pageRange = (i: number) => {
    const slice = filtered.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
    if (!slice.length) return "";
    const lo = slice[0].lv;
    const hi = slice[slice.length - 1].lv;
    return lo === hi ? lvLabel(lo) : `${lvLabel(lo)}–${hi}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/40 px-4 py-2.5 text-xs font-semibold" style={{ color: "var(--accent)" }}>
        樣式 SAMPLE ・ 假資料 19 筆 ・ 定案後這頁會刪掉
      </div>

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
              onClick={() => setKw("")}
              aria-label="清除搜尋"
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          共 {filtered.length} 個任務{kw && `符合「${kw}」`}・依需求等級排序
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
        <div>
          <div className="space-y-0.5">
            {rows.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
                沒有符合的任務。
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

        {selected && (
          <QuestDetail
            q={selected}
            tip={tip}
            onPickQuest={setSelId}
            onPickReward={setRewardPop}
            onPickMap={() => setMapPop(selected)}
          />
        )}
      </div>

      {tip.id != null && (
        <ItemTooltip
          id={tip.id}
          panelRef={tip.panelRef}
          modal={!tip.hasHover}
          onClose={tip.close}
          name={sampleItemInfo[tip.id]?.name}
          info={sampleItemInfo[tip.id]}
          searchLabel="哪些任務會給這個"
          onSearch={() => {
            const it = sampleQuests
              .flatMap((q) => q.rewards)
              .find((r) => r.id === tip.id);
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
            setSelId(id);
            setRewardPop(null);
          }}
        />
      )}
      {mapPop && <MapPopup q={mapPop} onClose={() => setMapPop(null)} />}
    </div>
  );
}

/* ---------- 列表卡片（A3 左等級徽，定案） ---------- */

function QuestCard({
  q,
  active,
  onClick,
}: {
  q: SampleQuest;
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
  onPickMap,
}: {
  q: SampleQuest;
  tip: Tip;
  onPickQuest: (id: string) => void;
  onPickReward: (i: SampleItem) => void;
  onPickMap: () => void;
}) {
  const chain = chainOf(q);
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
          <span>需求等級 {lvLabel(q.lv)}</span>
        </div>
      </div>

      {chain.length > 1 && (
        <QuestChainCard chain={chain} current={q.id} series={q.series} onPick={onPickQuest} />
      )}

      <Section title="任務 NPC">
        {q.npc ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{q.npc}</span>
            {q.npcMap ? (
              <button
                onClick={onPickMap}
                className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <MapPin size={12} />
                {q.npcMap}
              </button>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">劇情中出現</span>
            )}
          </div>
        ) : (
          <Empty>無指定 NPC</Empty>
        )}
      </Section>

      <Section title="需求道具">
        {q.need.length ? (
          <ItemRow items={q.need} tip={tip} />
        ) : (
          <Empty>不需要繳交道具</Empty>
        )}
      </Section>

      <Section title="獎勵">
        <div className="space-y-3">
          {(q.exp > 0 || q.money > 0 || q.pop > 0 || q.skill > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {q.exp > 0 && <Stat icon={<Sparkles size={13} />} label={`經驗 ${q.exp}`} />}
              {q.money > 0 && <Stat icon={<Coins size={13} />} label={`${q.money} 楓幣`} />}
              {q.pop > 0 && <Stat icon={<Sparkles size={13} />} label={`名聲 +${q.pop}`} />}
              {q.skill > 0 && <Stat icon={<Zap size={13} />} label="技能" />}
            </div>
          )}
          {q.rewards.length ? (
            <ItemRow items={q.rewards} tip={tip} onPick={onPickReward} />
          ) : (
            <Empty>沒有道具獎勵</Empty>
          )}
        </div>
      </Section>
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
 * 純 icon + 數量（Q6/Q8 定案：不放任何敘述文字）。
 * 卷軸類道具的 icon 幾乎長一樣，所以 icon 下方補一個名稱前兩字的小標籤區分；
 * 數量徽章因此改掛右上角（原本在右下會壓到標籤）。
 * hover 顯示道具彈窗（沿用怪物頁的 useItemTooltip / ItemTooltip）。
 */
function ItemRow({
  items,
  tip,
  onPick,
}: {
  items: SampleItem[];
  tip: Tip;
  onPick?: (i: SampleItem) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, idx) => (
        <button
          key={`${it.id}-${idx}`}
          {...tip.handlers(it.id, onPick ? () => onPick(it) : undefined)}
          aria-label={it.name}
          className={`relative flex h-14 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors ${
            onPick ? "cursor-pointer hover:border-[var(--accent)]" : "cursor-default"
          }`}
        >
          <GameIcon src={itemIconSrc(it.id)} alt="" fallback="📦" className="h-8 w-8" />
          <span className="w-full truncate px-0.5 text-center text-[10px] leading-none text-[var(--text-muted)]">
            {it.name.slice(0, 2)}
          </span>
          {it.n > 1 && (
            <span className="absolute -right-1 -top-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1 text-[10px] font-semibold tabular-nums shadow-sm">
              {it.n}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- 系列鏈：置頂的可收合卡片 ---------- */

/**
 * 擺在詳情最上面，因為「這條線有幾步、我在第幾步」是進來第一個要回答的問題。
 * 每個節點自己是一張小卡（不是一行字），目前這步用 accent 邊框＋底色拉出層次。
 * 長鏈（極致的試煉有 9 步）可以收起來，收起時標題列仍寫「第 3 / 9 步」。
 */
function QuestChainCard({
  chain,
  current,
  series,
  onPick,
}: {
  chain: SampleQuest[];
  current: string;
  series: string | null;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const idx = chain.findIndex((q) => q.id === current);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent-soft)]/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {series ?? "任務鏈"}
          </span>
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
        <ol className="space-y-1.5 border-t border-[var(--border)] p-3">
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

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="font-semibold">{title}</div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Q11 定案：點獎勵道具 → 彈窗反查「還有哪些任務給這個」，不離開目前任務 */
function RewardPopup({
  item,
  onClose,
  onPick,
}: {
  item: SampleItem;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const givers = sampleQuests.filter((q) => q.rewards.some((r) => r.id === item.id));
  return (
    <Modal title={`哪些任務會給「${item.name}」`} onClose={onClose}>
      <div className="space-y-1">
        {givers.map((q) => (
          <button
            key={q.id}
            onClick={() => onPick(q.id)}
            className="cursor-pointer flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/50"
          >
            <span className="min-w-0 truncate">{q.name}</span>
            <span className="shrink-0 text-xs text-[var(--text-muted)]">{lvLabel(q.lv)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function MapPopup({ q, onClose }: { q: SampleQuest; onClose: () => void }) {
  return (
    <Modal title={`${q.npc} 的位置`} onClose={onClose}>
      <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
        正式版這裡是 <code className="text-[var(--text)]">WorldMapView</code> 世界地圖，
        會在拆包底圖上標出「{q.npcMap}」。
        <div className="mt-2 text-xs">（sample 不接真地圖資料）</div>
      </div>
    </Modal>
  );
}

