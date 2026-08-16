"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Telescope } from "lucide-react";
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

export default function MapNavPage() {
  const [sheetId, setSheetId] = useState(WM_ROOT);
  const [spotIdx, setSpotIdx] = useState<number | null>(null);
  const sheet = wmSheets[sheetId];

  const switchSheet = (s: string) => {
    setSheetId(s);
    setSpotIdx(null);
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
          遊戲內建世界地圖搬上網頁：點黃色點點看那裡有哪些地圖、出沒哪些怪物。
        </p>
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
              href={`/minimal/monsters?q=${encodeURIComponent(m.name)}`}
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
