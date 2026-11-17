"use client";

// 地圖導覽：兩排分類 chip ＋搜尋 → 世界地圖（點黃點）→ 右側列出那一帶的地圖與出沒怪物。
// 分類跟任務查詢同一套（2026-11-16 改，共用 filter-chip.tsx）：第一排只放「世界總覽＋
// 現行版本的大陸＋未來視」，選了才出現第二排。以前 11 個大陸排成一排，其中 8 個整個還沒開放
// （路德斯湖、水世界…），玩家要在一堆去不了的地方裡找現在能去的三個。

import { useEffect, useMemo, useRef, useState } from "react";
import { NoPrefetchLink as Link } from "@/app/no-prefetch-link";
import {
  ArrowRight,
  ExternalLink,
  Globe,
  MapPin,
  Search,
  Telescope,
  X,
} from "lucide-react";
import {
  monsters,
  mobIconSrc,
  worldMapSrc,
  type DropMonster,
} from "@/data/drops";
import {
  wmSheets,
  wmMapName,
  wmMobsOnMap,
  WM_ROOT,
  type WmSpot,
} from "@/data/worldmap";
import { GameIcon } from "../monsters/game-icon";
import { WorldMapView, type WorldMapDot } from "../worldmap-view";
import { PageHeader } from "@/app/page-header";
import { FilterChip, FilterChipSubRow } from "@/app/filter-chip";

const monsterById = new Map<string, DropMonster>(
  monsters.map((m) => [m.id, m]),
);

const mapReleased = (id: number) => !!wmMapName(id)?.released;
/** 這個點有沒有任何一張現行版本的地圖（含借它標位置的隱藏地圖） */
const spotReleased = (spot: WmSpot) =>
  spot.maps.some(mapReleased) || !!spot.near?.some(mapReleased);

const childSheets = (id: string) =>
  wmSheets[id].links.filter((s) => wmSheets[s]);

/** 大陸圖的順序＝總圖 links 的順序（楓之島 → 維多利亞島 → …） */
const CONTINENTS = childSheets(WM_ROOT);
/** 現行版本去得了的大陸：至少一個點有已開放的地圖。目前是楓之島／維多利亞島／冰原雪域 */
const LIVE = CONTINENTS.filter((s) => wmSheets[s].spots.some(spotReleased));
/**
 * 還沒開放的大陸，收在「未來視」那顆 chip 底下。它們的子圖（路德斯湖的鐘塔最下層）
 * 直接排在母圖後面攤平成一排——再多一層 chip 就三排了。
 * 遊戲開新大陸時這裡會自己變：那個大陸有地圖在客戶端 Map.json 有名字，就升到第一排。
 */
const FUTURE = CONTINENTS.filter((s) => !LIVE.includes(s)).flatMap((s) => [
  s,
  ...childSheets(s),
]);

function mapLabel(id: number) {
  const info = wmMapName(id);
  if (!info) return `#${id}`;
  return info.street ? `${info.street}・${info.name}` : info.name;
}

interface MapLoc {
  sheetId: string;
  spotIdx: number;
  /** 借鄰居約略標位置，不是精準座標 */
  approx: boolean;
}

/** 地圖 id → 該去哪個 sheet 的哪個點才找得到它。同一張圖常常在總圖與大陸圖都有一個點，
 *  優先取最深層（最精準）的那個；完全沒有精準點的（隱藏圖/迷你地城）才退而用 near 的約略位置。 */
function buildMapLocationIndex(): Map<number, MapLoc> {
  const depthCache = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached != null) return cached;
    let n = 0;
    let cur = wmSheets[id];
    while (cur?.parent) {
      n++;
      cur = wmSheets[cur.parent];
    }
    depthCache.set(id, n);
    return n;
  };

  const index = new Map<number, MapLoc>();
  const bestDepth = new Map<number, number>();
  for (const [sheetId, sheet] of Object.entries(wmSheets)) {
    const depth = depthOf(sheetId);
    sheet.spots.forEach((spot, spotIdx) => {
      for (const id of spot.maps) {
        if ((bestDepth.get(id) ?? -1) < depth) {
          bestDepth.set(id, depth);
          index.set(id, { sheetId, spotIdx, approx: false });
        }
      }
    });
  }

  const bestNearDepth = new Map<number, number>();
  for (const [sheetId, sheet] of Object.entries(wmSheets)) {
    const depth = depthOf(sheetId);
    sheet.spots.forEach((spot, spotIdx) => {
      for (const id of spot.near ?? []) {
        if (index.has(id)) continue;
        if ((bestNearDepth.get(id) ?? -1) < depth) {
          bestNearDepth.set(id, depth);
          index.set(id, { sheetId, spotIdx, approx: true });
        }
      }
    });
  }

  return index;
}

const mapLocationIndex = buildMapLocationIndex();

/**
 * 可搜尋的地圖清單（有中文名、也找得到精準或約略位置的）。
 * 現行版本的排前面：搜「神殿」不該先跳出去不了的時間神殿。
 * sheet = 在哪張圖上，搜尋結果會寫出來（同名地圖很多，「入口」「岔路」不寫大陸分不出來）。
 */
const searchableMaps = Array.from(mapLocationIndex.entries())
  .map(([id, loc]) => ({
    id,
    label: mapLabel(id),
    approx: loc.approx,
    released: mapReleased(id),
    sheet: wmSheets[loc.sheetId].title,
  }))
  .filter((m) => !m.label.startsWith("#"))
  .sort((a, b) => Number(b.released) - Number(a.released));

/** 怪物也是現行版本的排前面（monsters 本身的順序用穩定排序保留） */
const searchableMonsters = [...monsters].sort(
  (a, b) => Number(b.released) - Number(a.released),
);

function FutureTag() {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
      <Telescope size={10} />
      未實裝
    </span>
  );
}

export default function MapNavPage() {
  const [sheetId, setSheetId] = useState(WM_ROOT);
  const [spotIdx, setSpotIdx] = useState<number | null>(null);
  const sheet = wmSheets[sheetId];

  const switchSheet = (s: string) => {
    setSheetId(s);
    setSpotIdx(null);
  };

  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const trimmedQuery = query.trim();
  const showDropdown = searchFocused && trimmedQuery.length > 0;

  const mapResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    return searchableMaps
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [trimmedQuery]);

  const monsterResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    return searchableMonsters
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [trimmedQuery]);

  const jumpToMap = (id: number) => {
    const loc = mapLocationIndex.get(id);
    if (!loc) return;
    setSheetId(loc.sheetId);
    setSpotIdx(loc.spotIdx);
    setQuery("");
    setSearchFocused(false);
  };

  /* 還沒開放的點畫淡（照樣可以點）。整張圖都沒開放（未來視的大陸）就不用淡化了，
     全部一樣淡等於沒標，反而只是看不清楚 */
  const dots: WorldMapDot[] = useMemo(() => {
    const mixed = sheet.spots.some(spotReleased);
    return sheet.spots.map((spot, i) => ({
      key: `${sheetId}-${i}`,
      x: spot.x,
      y: spot.y,
      focus: i === spotIdx,
      muted: mixed && !spotReleased(spot),
      title: spot.maps.length > 0 ? mapLabel(spot.maps[0]) : undefined,
    }));
  }, [sheet, sheetId, spotIdx]);

  const spot = spotIdx != null ? sheet.spots[spotIdx] : null;

  /** 目前這張圖屬於哪個大陸（子圖算它的母圖） */
  const continent =
    sheet.parent && sheet.parent !== WM_ROOT ? sheet.parent : sheetId;
  const inFuture = FUTURE.includes(sheetId);
  /** 第二排：未來視 → 還沒開放的大陸；有子圖的現行大陸 → 整張＋各子圖；其他沒有第二排 */
  const subRow = inFuture
    ? FUTURE.map((s) => ({ id: s, label: wmSheets[s].title }))
    : sheetId !== WM_ROOT && childSheets(continent).length > 0
      ? [
          { id: continent, label: "全圖" },
          ...childSheets(continent).map((s) => ({
            id: s,
            label: wmSheets[s].title,
          })),
        ]
      : null;

  /* 總圖上一個點＝一整個城鎮周邊（最多 89 張地圖），列出來太長，
     所以面板最上面放一顆捷徑，直接跳到大陸圖上那個城鎮的點 */
  const zoomTo =
    sheetId === WM_ROOT && spot
      ? mapLocationIndex.get(spot.maps[0])
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="地圖導覽"
        description="點地圖上的黃點，看那一帶有哪些地圖、出沒哪些怪物。還沒開放的大陸收在「未來視」"
      />

      <div ref={searchBoxRef} className="relative max-w-md">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="搜尋地圖 / 怪物名稱"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-10 pr-9 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="清除搜尋"
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="absolute z-20 mt-1.5 max-h-96 w-full overflow-y-auto themed-scroll rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
            {mapResults.length === 0 && monsterResults.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
                找不到符合的地圖或怪物
              </div>
            ) : (
              <>
                {mapResults.length > 0 && (
                  <div className="mb-1.5">
                    <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      地圖
                    </div>
                    {mapResults.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => jumpToMap(m.id)}
                        className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]"
                      >
                        <MapPin
                          size={13}
                          className="shrink-0 text-[var(--text-muted)]"
                        />
                        <span className="min-w-0 flex-1">{m.label}</span>
                        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                          {m.sheet}
                          {m.approx && "・約略位置"}
                        </span>
                        {!m.released && <FutureTag />}
                      </button>
                    ))}
                  </div>
                )}

                {monsterResults.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      怪物
                    </div>
                    {monsterResults.map((m) => {
                      const spots = m.maps
                        .filter((id) => mapLocationIndex.has(id))
                        .map((id) => ({ id, label: mapLabel(id) }))
                        .sort((a, b) => a.id - b.id);
                      return (
                        <div key={m.id} className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5 text-sm">
                            <GameIcon
                              src={mobIconSrc(m.id)}
                              alt={m.name}
                              fallback="🐌"
                              className="h-5 w-5 shrink-0"
                            />
                            <span className="font-medium">{m.name}</span>
                            {m.level != null && (
                              <span className="text-xs text-[var(--text-muted)]">
                                Lv.{m.level}
                              </span>
                            )}
                            {!m.released && <FutureTag />}
                          </div>
                          {spots.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1 pl-[26px]">
                              {spots.slice(0, 8).map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => jumpToMap(s.id)}
                                  className="cursor-pointer rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
                                >
                                  {s.label}
                                </button>
                              ))}
                              {spots.length > 8 && (
                                <span className="px-1 py-0.5 text-[11px] text-[var(--text-muted)]">
                                  等共 {spots.length} 個地點
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 pl-[26px] text-[11px] text-[var(--text-muted)]">
                              找不到可導覽的地點
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div>
        {/* 第一排：世界總覽＋現行版本的大陸＋未來視 */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="世界總覽"
            icon={<Globe size={12} />}
            active={sheetId === WM_ROOT}
            onClick={() => switchSheet(WM_ROOT)}
          />
          {LIVE.map((s) => (
            <FilterChip
              key={s}
              label={wmSheets[s].title}
              active={continent === s}
              onClick={() => switchSheet(s)}
            />
          ))}
          {FUTURE.length > 0 && (
            <FilterChip
              label="未來視"
              icon={<Telescope size={12} />}
              active={inFuture}
              onClick={() => switchSheet(FUTURE[0])}
            />
          )}
        </div>
        {/* 第二排：子圖（鯨魚號、奇幻村、廢礦），或未來視底下還沒開放的大陸。
            以前子圖是「內部區域：」一排字＋進去之後另一顆「回到維多利亞島」，
            現在母圖跟子圖並排在同一排，哪顆亮著就是在哪張 */}
        {subRow && (
          <FilterChipSubRow>
            {subRow.map((c) => (
              <FilterChip
                key={c.id}
                small
                label={c.label}
                active={sheetId === c.id}
                onClick={() => switchSheet(c.id)}
              />
            ))}
          </FilterChipSubRow>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] self-start">
          <WorldMapView
            src={worldMapSrc(sheetId)}
            alt={sheet.title}
            w={sheet.w}
            h={sheet.h}
            dots={dots}
            onDotClick={(d) => setSpotIdx(Number(d.key.split("-").pop()))}
          />
        </div>

        <div className="self-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:max-h-[75vh] lg:overflow-y-auto themed-scroll">
          {!spot ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              <MapPin size={20} className="mx-auto mb-2 opacity-60" />
              點地圖上的黃點，
              <br />
              即可查看該位置出沒怪物。
            </div>
          ) : (
            <>
              {zoomTo && (
                <button
                  onClick={() => jumpToMap(spot.maps[0])}
                  className="cursor-pointer mb-4 flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  <span>
                    到{wmSheets[zoomTo.sheetId].title}地圖看
                    <span className="font-semibold">
                      「{wmMapName(spot.maps[0])?.name}」
                    </span>
                    這一帶
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-[var(--accent-text)]"
                  />
                </button>
              )}
              <SpotPanel spot={spot} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotPanel({ spot }: { spot: WmSpot }) {
  return (
    <div className="space-y-4">
      <MapList ids={spot.maps} />
      {spot.near && spot.near.length > 0 && (
        <div className="border-t border-dashed border-[var(--border)] pt-3">
          <div className="mb-2 text-xs text-[var(--text-muted)]">
            這附近的隱藏地圖／迷你地城（世界地圖上沒有標記）：
          </div>
          <MapList ids={spot.near} />
        </div>
      )}
    </div>
  );
}

const mobsOn = (id: number) =>
  wmMobsOnMap(id)
    .map((mid) => monsterById.get(mid))
    .filter((m): m is DropMonster => !!m)
    .sort((a, b) => (a.level ?? 999) - (b.level ?? 999));

/**
 * 一個點底下的地圖：有怪的各自一塊，**沒有怪的收成最後一行名字**。
 * 以前每張都一塊，沒怪的印「圖鑑沒有這張地圖的怪物記錄。」——城鎮的點有十幾間
 * 武器店、民宅、美髮店，整個面板就是同一句話重複十幾次，真正有怪的地圖被擠到下面。
 */
function MapList({ ids }: { ids: number[] }) {
  const busy = ids.filter((id) => mobsOn(id).length > 0);
  const quiet = ids.filter((id) => !busy.includes(id));
  return (
    <div className="space-y-4">
      {busy.map((id) => (
        <MapBlock key={id} id={id} />
      ))}
      {quiet.length > 0 && (
        <div className="text-xs leading-relaxed text-[var(--text-muted)]">
          <div className="mb-0.5 font-semibold">
            {busy.length > 0 ? "其他沒有怪的地圖" : "這裡的地圖都沒有怪"}
          </div>
          {quiet.map((id, i) => {
            const info = wmMapName(id);
            return (
              <span key={id}>
                {i > 0 && "、"}
                {info?.name ?? `#${id}`}
                {!info?.released && (
                  <Telescope
                    size={10}
                    aria-label="未實裝"
                    className="ml-0.5 inline-block align-[-1px]"
                  />
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapBlock({ id }: { id: number }) {
  const info = wmMapName(id);
  const released = !!info?.released;
  const mobs = mobsOn(id);
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold">{info?.name ?? `#${id}`}</span>
        {info?.street && (
          <span className="text-xs text-[var(--text-muted)]">
            {info.street}
          </span>
        )}
        {!released && (
          <span className="ml-auto">
            <FutureTag />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {mobs.map((m) => (
          <Link
            key={m.id}
            href={`/monsters/${m.id}`}
            target="_blank"
            rel="noopener"
            title={`在新分頁查看 ${m.name} 的掉落`}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] py-0.5 pl-1 pr-2.5 text-xs transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <GameIcon
              src={mobIconSrc(m.id)}
              alt={m.name}
              fallback="🐌"
              className="h-5 w-5 shrink-0"
            />
            <span>{m.name}</span>
            <span className="text-[var(--text-muted)]">
              {m.level != null ? `Lv.${m.level}` : ""}
            </span>
            <ExternalLink
              size={10}
              className="shrink-0 text-[var(--text-muted)] opacity-70"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
