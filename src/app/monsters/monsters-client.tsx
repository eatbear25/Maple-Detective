"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { HoverPrefetchLink as Link } from "@/app/hover-prefetch-link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Search, Filter, MapPin, Telescope, X } from "lucide-react";
import {
  monsters,
  itemName,
  hasItemName,
  mapInfo,
  futureMapInfo,
  mobIconSrc,
  parseElemAttr,
  worldMapSheet,
  worldMapSrc,
  type DropMonster,
  type MapInfo,
} from "@/data/drops";
import { GameIcon } from "./game-icon";
import { PageHeader } from "@/app/page-header";
import { EmptyState } from "@/app/empty-state";
import { ItemTooltip, useItemTooltip } from "./item-tooltip";
import { MonsterHero, StatsPanel, ElemPanel, DetailSection, DropTileBody } from "./panels";
import { CARD, DROP_GRID, MAP_CHIP, PILL } from "./styles";
import { ShareButton } from "./share-button";
import { ShowMore } from "./show-more";
import { WorldMapView, type WorldMapDot } from "../worldmap-view";

type Tab = "current" | "future";
type Tooltip = ReturnType<typeof useItemTooltip>;

const ELEM_OPTIONS = ["火", "冰", "雷", "毒", "聖", "暗"];

function matches(m: DropMonster, q: string) {
  if (m.name.includes(q) || m.id === q) return true;
  if (m.drops.some((iid) => itemName(iid).includes(q))) return true;
  if (m.futureDrops.some((iid) => itemName(iid).includes(q))) return true;
  return m.maps.some((mp) => {
    const info = mapInfo(mp) ?? futureMapInfo(mp);
    return !!info && (info.name.includes(q) || info.street.includes(q));
  });
}

/** 清單列的出沒地小字：實裝怪用第一張具名地圖，未實裝怪用補充街道名 */
function placeLabel(m: DropMonster) {
  for (const mp of m.maps) {
    const info = mapInfo(mp);
    if (info) return info.name;
  }
  for (const mp of m.maps) {
    const info = futureMapInfo(mp);
    if (info) return info.street || info.name;
  }
  return "出沒地不明";
}

/** 進站瞬間的骨架畫面：避免帶 ?q= 進來時先閃過未篩選的全部清單 */
function MonsterPageSkeleton() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="maple-loader" />
      <p className="text-sm text-[var(--text-muted)]">載入中…</p>
    </div>
  );
}

const TITLE = "怪物掉落查詢";
const TAB_DESC: Record<Tab, string> = {
  current:
    "從遊戲用戶端圖鑑整理的掉落資訊，與實際情況可能存在出入，僅供參考",
  future:
    "資料裡存在，但目前版本尚未開放的怪物與掉落（不確定未來是否實裝，僅供參考）",
};

export default function MonsterPage() {
  // fallback 也要有標題：靜態輸出時這頁只會產出 fallback，見 PageHeader 的註解
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <PageHeader title={TITLE} description={TAB_DESC.current} />
          <MonsterPageSkeleton />
        </div>
      }
    >
      <MonsterExplorer />
    </Suspense>
  );
}

function MonsterExplorer() {
  // 地圖導覽頁的「查看怪物」連結會帶 ?q=怪物名 進來。用 useSearchParams 而不是
  // window.location.search + useEffect，是因為這個 hook 在動態渲染時，
  // 伺服器端第一次渲染就讀得到網址參數——結果會直接是篩選好的清單，
  // 不會像 effect 那樣先出全部結果、下一拍才收斂成篩選結果（那個閃爍就是使用者回報的問題）。
  const searchParams = useSearchParams();
  const q0 = searchParams.get("q");
  // 帶 ?id=怪物ID 進來（完整頁面的「在查詢工具中開啟」、在清單點過的怪）：直接選到
  // 那隻怪、分頁也跟著牠是否實裝切換，不吃搜尋字串（避免打開連結時篩選清單反而找不到牠）。
  const id0 = searchParams.get("id");
  const idMonster = id0 ? monsters.find((m) => m.id === id0) : undefined;

  const [tab, setTab] = useState<Tab>(() => {
    if (idMonster) return idMonster.released ? "current" : "future";
    return q0 && !monsters.some((m) => m.released && matches(m, q0))
      ? "future"
      : "current";
  });
  const [query, setQuery] = useState(idMonster ? "" : (q0 ?? ""));
  const [filterOpen, setFilterOpen] = useState(false);
  const [weakSel, setWeakSel] = useState<string[]>([]);
  const [lvMin, setLvMin] = useState("");
  const [lvMax, setLvMax] = useState("");
  const [selectedId, setSelectedId] = useState(
    idMonster ? idMonster.id : monsters[0].id,
  );
  const tooltip = useItemTooltip();
  const listRef = useRef<HTMLElement>(null);

  // 選中的怪寫進網址（?id=），重新整理或複製網址都會停在同一隻。
  // replaceState 不會向伺服器要任何東西，也不會多一筆上一頁
  const selectMonster = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    url.searchParams.set("id", id);
    window.history.replaceState(null, "", url);
  };

  // 點掉落物＝篩「還有哪些怪會掉」。左邊清單換了內容要看得出來：清單捲回最上面；
  // 手機版清單在詳情上面、不在畫面裡，整頁捲回清單那裡
  const searchItem = (name: string) => {
    setQuery(name);
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: 0 });
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  // 現行版本＝目前客戶端地圖上真的遇得到的怪；未來視＝未實裝怪 + 帶未實裝掉落的怪
  const baseList = useMemo(
    () =>
      tab === "current"
        ? monsters.filter((m) => m.released)
        : monsters.filter((m) => !m.released || m.futureDrops.length > 0),
    [tab],
  );

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const min = parseInt(lvMin, 10);
  const max = parseInt(lvMax, 10);
  const filterCount =
    weakSel.length + (Number.isNaN(min) ? 0 : 1) + (Number.isNaN(max) ? 0 : 1);

  const q = query.trim();
  const filtered = useMemo(() => {
    return baseList.filter((m) => {
      if (q && !matches(m, q)) return false;
      if (weakSel.length > 0) {
        const weak = parseElemAttr(m.stats.elemAttr).weak;
        if (!weakSel.some((e) => weak.includes(e))) return false;
      }
      if (!Number.isNaN(min) && (m.level == null || m.level < min))
        return false;
      if (!Number.isNaN(max) && (m.level == null || m.level > max))
        return false;
      return true;
    });
  }, [baseList, q, weakSel, min, max]);
  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0];

  const clearFilters = () => {
    setWeakSel([]);
    setLvMin("");
    setLvMax("");
  };

  return (
    <div className="space-y-5">
      <div>
        <PageHeader title={TITLE} description={TAB_DESC[tab]} />

        <div
          role="group"
          aria-label="版本"
          className="mt-3.5 inline-flex gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-[3px] text-[13px]"
        >
          {(
            [
              ["current", "現行版本", null],
              ["future", "未來視", Telescope],
            ] as [Tab, string, typeof Telescope | null][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={`cursor-pointer flex h-8 items-center gap-1.5 rounded-full px-3.5 transition-colors ${
                tab === key
                  ? "bg-[var(--accent-soft)] font-bold text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {Icon && <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex max-w-[476px] items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋怪物 / 道具 / 地圖"
              aria-label="搜尋怪物、道具或地圖"
              className="h-11 w-full rounded-full border border-[var(--border-strong)] bg-[var(--surface)] pl-11 pr-10 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="清除搜尋"
                className="cursor-pointer absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            aria-label="進階篩選"
            aria-expanded={filterOpen}
            className={`cursor-pointer relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
              filterOpen || filterCount > 0
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            <Filter size={17} />
            {filterCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-[var(--on-accent)]"
                style={{ background: "var(--accent)" }}
              >
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {filterOpen && (
          <div className={`mt-3 max-w-2xl space-y-4 p-4 ${CARD}`}>
            <div>
              <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                屬性弱點
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ELEM_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => toggle(weakSel, setWeakSel, e)}
                    className={`cursor-pointer text-xs rounded-full px-3 py-1 border transition-colors ${
                      weakSel.includes(e)
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                    }`}
                  >
                    弱{e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                  等級範圍
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    value={lvMin}
                    onChange={(e) => setLvMin(e.target.value)}
                    placeholder="最低"
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
                  />
                  <span className="text-[var(--text-muted)]">〜</span>
                  <input
                    type="number"
                    value={lvMax}
                    onChange={(e) => setLvMax(e.target.value)}
                    placeholder="最高"
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>
              {filterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="cursor-pointer flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <X size={13} />
                  清除篩選
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 text-xs text-[var(--text-muted)]">
          共 {filtered.length} 隻符合{q && `「${q}」`}
          {weakSel.length > 0 && `・弱${weakSel.join("弱")}`}
          {(!Number.isNaN(min) || !Number.isNaN(max)) &&
            `・Lv.${Number.isNaN(min) ? "?" : min}〜${Number.isNaN(max) ? "?" : max}`}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={CARD}>
          <EmptyState hint="試著換個關鍵字，或放寬篩選條件。" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5">
          <nav
            ref={listRef}
            aria-label="怪物列表"
            className={`themed-scroll max-h-[40vh] scroll-mt-4 overflow-y-auto p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] ${CARD}`}
          >
            <ul className="flex flex-col gap-0.5">
              {filtered.map((m) => {
                const active = selected && m.id === selected.id;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => selectMonster(m.id)}
                      aria-current={active || undefined}
                      className={`cursor-pointer flex min-h-[54px] w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left transition-colors ${
                        active
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[var(--accent-soft)]/50"
                      }`}
                    >
                      <GameIcon
                        src={mobIconSrc(m.id)}
                        alt=""
                        fallback="🐌"
                        className="h-[42px] w-[42px] shrink-0"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span
                          className={`flex items-center gap-1 text-sm ${active ? "font-bold" : "font-medium"}`}
                        >
                          <span className="truncate">{m.name}</span>
                          {!m.released && (
                            <Telescope
                              size={13}
                              className="shrink-0 text-[var(--text-muted)]"
                            />
                          )}
                        </span>
                        <span className="truncate text-xs text-[var(--text-muted)]">
                          {placeLabel(m)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                        {m.level != null ? `Lv.${m.level}` : "Lv.?"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {selected && (
            <MonsterDetail
              key={selected.id}
              monster={selected}
              tab={tab}
              query={q}
              tooltip={tooltip}
              onSearchItem={searchItem}
            />
          )}
        </div>
      )}

      {tooltip.id != null && (
        <ItemTooltip
          id={tooltip.id}
          panelRef={tooltip.panelRef}
          modal={!tooltip.hasHover}
          onClose={tooltip.close}
          onSearch={() => {
            if (tooltip.id != null) searchItem(itemName(tooltip.id));
            tooltip.close();
          }}
          pageHref={hasItemName(tooltip.id) ? `/items/${tooltip.id}` : undefined}
        />
      )}
    </div>
  );
}

/** 右欄：頭 → 數值 → 掉落物 →（未來視）未實裝掉落 → 出沒地圖 */
function MonsterDetail({
  monster: m,
  tab,
  query,
  tooltip,
  onSearchItem,
}: {
  monster: DropMonster;
  tab: Tab;
  query: string;
  tooltip: Tooltip;
  onSearchItem: (name: string) => void;
}) {
  const showFuture = tab === "future" && m.futureDrops.length > 0;
  return (
    <article aria-labelledby="monster-name" className={`min-w-0 ${CARD}`}>
      <MonsterHero
        monster={m}
        headingId="monster-name"
        dropCount={m.drops.length + (tab === "future" ? m.futureDrops.length : 0)}
        actions={
          <>
            <ShareButton id={m.id} />
            {/* 通往 /monsters/[id] 完整頁面。查詢工具是「選取式」互動（點列表只換右欄、
                不導頁），所以導頁的出口獨立成這一顆，不去動列表。 */}
            <Link
              href={`/monsters/${m.id}`}
              title={`查看 ${m.name} 的完整頁面`}
              className={PILL}
            >
              <ArrowUpRight size={13} />
              完整頁面
            </Link>
          </>
        }
      />

      <div className="px-4 pb-5 sm:px-6">
        <StatsPanel stats={m.stats} />
        <ElemPanel stats={m.stats} />
      </div>

      <DetailSection
        id="drop-h"
        title="掉落物"
        count={`${m.drops.length} 種`}
      >
        {m.drops.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {m.futureDrops.length > 0
              ? "圖鑑記錄的掉落物目前版本都還沒開放，可以到「未來視」查看。"
              : "圖鑑內沒有這隻怪物的掉落記錄。"}
          </p>
        ) : (
          <div className={DROP_GRID}>
            {m.drops.map((iid) => (
              <DropCard
                key={iid}
                id={iid}
                hit={query !== "" && itemName(iid).includes(query)}
                tooltip={tooltip}
                onSearchItem={onSearchItem}
              />
            ))}
          </div>
        )}
      </DetailSection>

      {showFuture && (
        <DetailSection
          id="future-drop-h"
          title={
            <>
              <Telescope size={15} className="text-[var(--text-muted)]" />
              未實裝掉落
            </>
          }
          count={`${m.futureDrops.length} 種`}
          note="存在於客戶端資料，但目前版本拿不到的道具。"
        >
          <div className={DROP_GRID}>
            {m.futureDrops.map((iid) => (
              <DropCard
                key={iid}
                id={iid}
                future
                tooltip={tooltip}
                onSearchItem={onSearchItem}
              />
            ))}
          </div>
        </DetailSection>
      )}

      <MapChips monster={m} />
    </article>
  );
}

/**
 * 掉落物卡片：點卡片＝道具彈窗／篩「還有哪些怪會掉」（現在的行為），右邊的 ↗ 才是
 * 開道具頁。兩個是兄弟元素，彈窗的 hover 綁在外層，滑到 ↗ 上時彈窗才不會關掉。
 * ↗ 的顯示規則（觸控一直顯示、滑鼠滑過才出現）在 globals.css 的 .drop-go。
 */
function DropCard({
  id,
  hit = false,
  future = false,
  tooltip,
  onSearchItem,
}: {
  id: number;
  hit?: boolean;
  future?: boolean;
  tooltip: Tooltip;
  onSearchItem: (name: string) => void;
}) {
  const name = itemName(id);
  const { onMouseEnter, onMouseLeave, onClick } = tooltip.handlers(id, () =>
    onSearchItem(name),
  );
  const href = hasItemName(id) ? `/items/${id}` : null;
  return (
    <div
      className="drop-card group relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        onClick={onClick}
        title={`搜尋掉落「${name}」的怪物`}
        className={`cursor-pointer flex h-full min-h-12 w-full items-center gap-2 rounded-[10px] border py-1.5 pl-1.5 text-left transition-colors sm:gap-2.5 sm:pl-2 ${
          href ? "pr-12" : "pr-2"
        } ${future ? "border-dashed opacity-80" : ""} ${
          hit
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border)] bg-[var(--surface)] group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-soft)]/50"
        }`}
      >
        <DropTileBody id={id} />
      </button>
      {href && (
        <Link href={href} aria-label={`${name}的道具頁`} className="drop-go">
          <ArrowUpRight size={18} strokeWidth={2.25} />
          <span className="drop-go-tip" aria-hidden="true">
            開道具頁
          </span>
        </Link>
      )}
    </div>
  );
}

interface MapRef {
  id: number;
  info: MapInfo;
  future: boolean;
}

function MapChips({ monster }: { monster: DropMonster }) {
  const [focusId, setFocusId] = useState<number | null>(null);
  const named: MapRef[] = monster.maps
    .map((id) => ({ id, info: mapInfo(id), future: false }))
    .filter((x): x is MapRef => !!x.info);
  // 未實裝怪：客戶端沒有牠的地圖名，改用 maplestory.io 補充名稱（虛線樣式）
  const future: MapRef[] = monster.released
    ? []
    : monster.maps
        .map((id) => ({ id, info: futureMapInfo(id), future: true }))
        .filter((x): x is MapRef => !!x.info);
  const all = [...named, ...future];
  if (all.length === 0) return null;
  const focus = all.find((x) => x.id === focusId);
  return (
    <DetailSection
      id="map-h"
      title="出沒地圖"
      count={`${all.length} 張`}
    >
      <ShowMore
        unit="張"
        items={all.map(({ id, info, future: isFuture }) => {
          const label = info.street ? `${info.street}・${info.name}` : info.name;
          if (!info.wm) {
            return (
              <span key={id} className={isFuture ? MAP_CHIP.future : MAP_CHIP.plain}>
                {label}
              </span>
            );
          }
          return (
            <button
              key={id}
              onClick={() => setFocusId(id)}
              title="在世界地圖上顯示位置"
              className={`cursor-pointer text-left ${isFuture ? MAP_CHIP.future : MAP_CHIP.link}`}
            >
              {label}
            </button>
          );
        })}
      />
      {focus?.info.wm && (
        <WorldMapModal
          focus={focus}
          all={all}
          onFocus={setFocusId}
          onClose={() => setFocusId(null)}
        />
      )}
    </DetailSection>
  );
}

/**
 * 世界地圖彈窗：底圖 + 該圖全部點位（背景淡黃點，跟遊戲內一樣完整）；
 * 這隻怪的出沒點畫成可點的亮點，目前選到的那張地圖再高亮成橘紅大點。
 */
function WorldMapModal({
  focus,
  all,
  onFocus,
  onClose,
}: {
  focus: MapRef;
  all: MapRef[];
  onFocus: (id: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wm = focus.info.wm!;
  const sheet = worldMapSheet(wm.s);
  if (!sheet) return null;
  const siblings = all.filter((x) => x.info.wm?.s === wm.s);
  // 隱藏圖是借鄰居的點標約略位置，所以同一座標常常疊好幾張地圖（例：楓之島
  // (74,8) 疊了 7 張）。同座標只畫一顆點，不然下面幾顆是點不到的死按鈕，
  // 而且最後畫的那顆會蓋掉精準點的樣式。代表點取精準的，整組都約略才畫空心圈。
  const spotGroups = new Map<string, MapRef[]>();
  for (const s of siblings) {
    const k = `${s.info.wm!.x},${s.info.wm!.y}`;
    const g = spotGroups.get(k);
    if (g) g.push(s);
    else spotGroups.set(k, [s]);
  }
  const hasApprox = siblings.some((x) => x.info.wm!.a);
  const dots: WorldMapDot[] = [
    // 該圖其餘點位畫成背景淡點（扣掉已經被怪物點佔用的座標）
    ...sheet.spots
      .filter(([x, y]) => !spotGroups.has(`${x},${y}`))
      .map(([x, y]) => ({ key: `bg-${x},${y}`, x, y, dim: true })),
    ...[...spotGroups.values()].map((g) => {
      const rep = g.find((x) => !x.info.wm!.a) ?? g[0];
      return {
        key: String(rep.id),
        x: rep.info.wm!.x,
        y: rep.info.wm!.y,
        focus: g.some((x) => x.id === focus.id),
        approx: g.every((x) => !!x.info.wm!.a),
        title:
          g.length > 1 ? `${rep.info.name} 等 ${g.length} 張` : rep.info.name,
      };
    }),
  ];
  const legend = [
    spotGroups.size > 1 && "亮黃點為該怪物的其他出沒地點",
    hasApprox && "空心圈為約略位置",
  ]
    .filter(Boolean)
    .join("・");
  const label = focus.info.street
    ? `${focus.info.street}・${focus.info.name}`
    : focus.info.name;
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
          <MapPin
            size={16}
            className="shrink-0"
            style={{ color: "var(--accent-text)" }}
          />
          <span className="shrink-0 text-sm font-semibold">{sheet.title}</span>
          <span className="min-w-0 truncate text-sm text-[var(--text-muted)]">
            {label}
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
          onDotClick={(d) => onFocus(Number(d.key))}
        />
        {legend && (
          <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)]">
            {legend}
          </div>
        )}
      </div>
    </div>
  );
}
