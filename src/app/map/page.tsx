"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
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

const monsterById = new Map<string, DropMonster>(
  monsters.map((m) => [m.id, m]),
);

/** 大陸圖的顯示順序＝總圖 links 的順序（楓之島 → 維多利亞島 → …） */
const CONTINENTS = [WM_ROOT, ...wmSheets[WM_ROOT].links].filter(
  (s) => wmSheets[s],
);

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

/** 可搜尋的地圖清單（有中文名、也找得到精準或約略位置的） */
const searchableMaps = Array.from(mapLocationIndex.entries())
  .map(([id, loc]) => ({ id, label: mapLabel(id), approx: loc.approx }))
  .filter((m) => !m.label.startsWith("#"));

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
    return searchableMaps.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 6);
  }, [trimmedQuery]);

  const monsterResults = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    return monsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [trimmedQuery]);

  const jumpToMap = (id: number) => {
    const loc = mapLocationIndex.get(id);
    if (!loc) return;
    setSheetId(loc.sheetId);
    setSpotIdx(loc.spotIdx);
    setQuery("");
    setSearchFocused(false);
  };

  const dots: WorldMapDot[] = useMemo(
    () =>
      sheet.spots.map((spot, i) => ({
        key: `${sheetId}-${i}`,
        x: spot.x,
        y: spot.y,
        focus: i === spotIdx,
        title: spot.maps.length > 0 ? mapLabel(spot.maps[0]) : undefined,
      })),
    [sheet, sheetId, spotIdx],
  );

  const spot = spotIdx != null ? sheet.spots[spotIdx] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">地圖導覽</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          遊戲世界地圖，透過點擊地圖上黃點看哪裡有出沒哪些怪物，包含了未來視的地圖，僅供參考。
        </p>
      </div>

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
                        <span className="flex-1">{m.label}</span>
                        {m.approx && (
                          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                            約略位置
                          </span>
                        )}
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

      <div className="flex flex-wrap items-center gap-1.5">
        {CONTINENTS.map((s) => (
          <button
            key={s}
            onClick={() => switchSheet(s)}
            className={`cursor-pointer text-sm rounded-full px-3.5 py-1.5 border transition-colors ${
              s === sheetId || wmSheets[sheetId].parent === s
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            {s === WM_ROOT ? "🍁 世界總覽" : wmSheets[s].title}
          </button>
        ))}
      </div>

      {sheetId !== WM_ROOT && sheet.links.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs -mt-3">
          <span className="text-[var(--text-muted)]">內部區域：</span>
          {sheet.links
            .filter((s) => wmSheets[s])
            .map((s) => (
              <button
                key={s}
                onClick={() => switchSheet(s)}
                className="cursor-pointer rounded-full border border-[var(--border)] px-2.5 py-1 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                {wmSheets[s].title}
              </button>
            ))}
        </div>
      )}

      {sheet.parent && sheet.parent !== WM_ROOT && (
        <button
          onClick={() => switchSheet(sheet.parent!)}
          className="cursor-pointer -mt-3 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={13} />
          回到{wmSheets[sheet.parent].title}
        </button>
      )}

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
            <SpotPanel spot={spot} />
          )}
        </div>
      </div>
    </div>
  );
}

function SpotPanel({ spot }: { spot: WmSpot }) {
  return (
    <div className="space-y-4">
      {spot.maps.map((mp) => (
        <MapBlock key={mp} id={mp} />
      ))}
      {spot.near && spot.near.length > 0 && (
        <div className="border-t border-dashed border-[var(--border)] pt-3">
          <div className="mb-2 text-xs text-[var(--text-muted)]">
            這附近的隱藏地圖／迷你地城（世界地圖上沒有標記）：
          </div>
          <div className="space-y-4">
            {spot.near.map((mp) => (
              <MapBlock key={mp} id={mp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MapBlock({ id }: { id: number }) {
  const info = wmMapName(id);
  const released = !!info?.released;
  const mobs = wmMobsOnMap(id)
    .map((mid) => monsterById.get(mid))
    .filter((m): m is DropMonster => !!m)
    .sort((a, b) => (a.level ?? 999) - (b.level ?? 999));
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
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
            <Telescope size={10} />
            未實裝
          </span>
        )}
      </div>
      {mobs.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {mobs.map((m) => (
            <Link
              key={m.id}
              href={`/monsters?q=${encodeURIComponent(m.name)}`}
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
      ) : (
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          圖鑑沒有這張地圖的怪物記錄。
        </div>
      )}
    </div>
  );
}
