"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Search,
  Filter,
  MapPin,
  Telescope,
  X,
} from "lucide-react";
import {
  monsters,
  itemName,
  mapInfo,
  futureMapInfo,
  mobIconSrc,
  itemIconSrc,
  parseElemAttr,
  worldMapSheet,
  worldMapSrc,
  type DropMonster,
  type MapInfo,
  type MobStats,
} from "@/data/drops";
import { GameIcon } from "./game-icon";
import { ItemTooltip, useItemTooltip } from "./item-tooltip";
import { WorldMapView, type WorldMapDot } from "../worldmap-view";

type Tab = "current" | "future";

const STAT_LABELS: [keyof MobStats, string][] = [
  ["maxHP", "HP"],
  ["maxMP", "MP"],
  ["exp", "經驗值"],
  ["PADamage", "物理攻擊"],
  ["MADamage", "魔法攻擊"],
  ["PDDamage", "物理防禦"],
  ["MDDamage", "魔法防禦"],
  ["acc", "命中率"],
  ["eva", "迴避率"],
];

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

export default function MinimalMonsterPage() {
  const [tab, setTab] = useState<Tab>("current");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [weakSel, setWeakSel] = useState<string[]>([]);
  const [lvMin, setLvMin] = useState("");
  const [lvMax, setLvMax] = useState("");
  const [selectedId, setSelectedId] = useState(monsters[0].id);
  const tooltip = useItemTooltip();

  // 地圖導覽頁的「查看怪物」連結會帶 ?q=怪物名 進來
  useEffect(() => {
    const q0 = new URLSearchParams(window.location.search).get("q");
    if (!q0) return;
    setQuery(q0);
    if (!monsters.some((m) => m.released && matches(m, q0))) setTab("future");
  }, []);

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">怪物掉落查詢</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {tab === "current"
            ? `從遊戲用戶端圖鑑整理，共 ${baseList.length} 隻怪物的掉落記錄`
            : "客戶端資料裡存在、但目前版本尚未開放的怪物與掉落（不保證未來會實裝）"}
        </p>

        <div className="mt-4 inline-flex rounded-full border border-[var(--border)] p-0.5 text-sm">
          {(
            [
              ["current", "現行版本", null],
              ["future", "未來視", Telescope],
            ] as [Tab, string, typeof Telescope | null][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`cursor-pointer flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
                tab === key
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {Icon && <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋怪物 / 道具 / 地圖"
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
          <button
            onClick={() => setFilterOpen((v) => !v)}
            aria-label="進階篩選"
            className={`cursor-pointer relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
              filterOpen || filterCount > 0
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            <Filter size={16} />
            {filterCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {filterOpen && (
          <div className="mt-3 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-10">
        <div className="themed-scroll space-y-0.5 max-h-[40vh] overflow-y-auto rounded-lg border border-[var(--border)] p-1.5 lg:max-h-[70vh] lg:border-0 lg:p-0 lg:pr-2">
          {filtered.length === 0 && (
            <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
              沒有符合條件的怪物，試著放寬搜尋或篩選。
            </div>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`cursor-pointer w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                selected && m.id === selected.id
                  ? "bg-[var(--accent-soft)]"
                  : "hover:bg-[var(--accent-soft)]/40"
              }`}
            >
              <GameIcon
                src={mobIconSrc(m.id)}
                alt={m.name}
                fallback="🐌"
                className="w-9 h-9 shrink-0"
              />
              <span className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <span className="truncate">{m.name}</span>
                  {!m.released && (
                    <Telescope
                      size={13}
                      className="shrink-0 text-[var(--text-muted)]"
                    />
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {placeLabel(m)}
                </div>
              </span>
              <span className="text-xs text-[var(--text-muted)] shrink-0">
                {m.level != null ? `Lv.${m.level}` : "Lv.?"}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-6 border-b border-[var(--border)]">
              <div className="w-16 h-16 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center overflow-hidden shrink-0">
                <GameIcon
                  src={mobIconSrc(selected.id)}
                  alt={selected.name}
                  fallback="🐌"
                  className="w-12 h-12"
                />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold flex flex-wrap items-center gap-2">
                  <span className="break-words">{selected.name}</span>
                  {selected.stats.boss ? (
                    <span
                      className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent-soft)]"
                      style={{ color: "var(--accent)" }}
                    >
                      BOSS
                    </span>
                  ) : null}
                  {!selected.released && (
                    <span className="flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--text-muted)]">
                      <Telescope size={12} />
                      未實裝
                    </span>
                  )}
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  #{selected.id}
                </div>
              </div>
              <div className="flex gap-4 text-sm sm:ml-auto sm:gap-6">
                <Stat
                  label="等級"
                  value={selected.level != null ? `${selected.level}` : "?"}
                />
                <Stat
                  label="掉落物"
                  value={`${selected.drops.length + (tab === "future" ? selected.futureDrops.length : 0)}`}
                />
                <Stat label="出沒地圖" value={`${selected.maps.length}`} />
              </div>
            </div>

            <StatsPanel stats={selected.stats} />
            <ElemPanel stats={selected.stats} />

            <MapChips monster={selected} />

            <div className="mt-6">
              <div
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--accent)" }}
              >
                掉落物品
              </div>
              {selected.drops.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] py-4">
                  圖鑑內沒有這隻怪物的掉落記錄。
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selected.drops.map((iid) => {
                    const name = itemName(iid);
                    const hit = q !== "" && name.includes(q);
                    return (
                      <button
                        key={iid}
                        {...tooltip.handlers(iid, () => setQuery(name))}
                        title={`搜尋掉落「${name}」的怪物`}
                        className={`cursor-pointer flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          hit
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] hover:border-[var(--accent)]"
                        }`}
                      >
                        <GameIcon
                          src={itemIconSrc(iid)}
                          alt={name}
                          fallback="📦"
                          className="w-8 h-8 shrink-0"
                        />
                        <span className="text-sm leading-tight">{name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {tab === "future" && selected.futureDrops.length > 0 && (
              <div className="mt-6">
                <div
                  className="flex items-center gap-1.5 text-sm font-semibold mb-1"
                  style={{ color: "var(--accent)" }}
                >
                  <Telescope size={15} />
                  未實裝掉落
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  存在於客戶端資料、但目前版本拿不到的道具。
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selected.futureDrops.map((iid) => {
                    const name = itemName(iid);
                    return (
                      <button
                        key={iid}
                        {...tooltip.handlers(iid, () => setQuery(name))}
                        title={`搜尋掉落「${name}」的怪物`}
                        className="cursor-pointer flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-left opacity-80 transition-colors hover:border-[var(--accent)]"
                      >
                        <GameIcon
                          src={itemIconSrc(iid)}
                          alt={name}
                          fallback="📦"
                          className="w-8 h-8 shrink-0"
                        />
                        <span className="text-sm leading-tight">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {tooltip.id != null && (
        <ItemTooltip
          id={tooltip.id}
          panelRef={tooltip.panelRef}
          modal={!tooltip.hasHover}
          onClose={tooltip.close}
          onSearch={() => {
            if (tooltip.id != null) setQuery(itemName(tooltip.id));
            tooltip.close();
          }}
        />
      )}
    </div>
  );
}

function StatsPanel({ stats }: { stats: MobStats }) {
  const rows = STAT_LABELS.filter(([key]) => stats[key] !== undefined);
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {rows.map(([key, label]) => (
        <div
          key={key}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-center"
        >
          <div className="text-sm font-semibold tabular-nums">
            {(stats[key] as number).toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{label}</div>
        </div>
      ))}
    </div>
  );
}

function ElemPanel({ stats }: { stats: MobStats }) {
  const elem = parseElemAttr(stats.elemAttr);
  const groups: [string, string[]][] = [
    ["弱點", elem.weak],
    ["抗性", elem.resist],
    ["免疫", elem.immune],
  ];
  if (groups.every(([, list]) => list.length === 0)) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold" style={{ color: "var(--accent)" }}>
        屬性
      </span>
      {groups.map(([label, list]) =>
        list.map((e) => (
          <span
            key={label + e}
            className={`rounded-full border px-2.5 py-1 ${
              label === "弱點"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {label === "弱點"
              ? `弱${e}`
              : label === "抗性"
                ? `抗${e}`
                : `免疫${e}`}
          </span>
        )),
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
  const [open, setOpen] = useState(false);
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
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer flex w-full items-center gap-1.5 text-sm font-semibold lg:pointer-events-none lg:cursor-default"
        style={{ color: "var(--accent)" }}
      >
        出沒地圖
        <span className="font-normal text-[var(--text-muted)]">
          ({all.length})
        </span>
        <ChevronDown
          size={15}
          className={`ml-auto text-[var(--text-muted)] transition-transform lg:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`mt-2 flex-wrap gap-1.5 lg:flex ${open ? "flex" : "hidden"}`}
      >
        {all.map(({ id, info, future: isFuture }) => {
          const label = info.street
            ? `${info.street}・${info.name}`
            : info.name;
          const base = isFuture
            ? "border border-dashed border-[var(--border)] text-[var(--text-muted)]"
            : "bg-[var(--accent-soft)] text-[var(--text)]";
          if (!info.wm) {
            return (
              <span
                key={id}
                className={`text-xs rounded-full px-2.5 py-1 ${base}`}
              >
                {label}
              </span>
            );
          }
          return (
            <button
              key={id}
              onClick={() => setFocusId(id)}
              title="在世界地圖上顯示位置"
              className={`cursor-pointer flex items-center gap-1 text-xs rounded-full px-2.5 py-1 transition-shadow hover:ring-1 hover:ring-[var(--accent)] ${base}`}
            >
              <MapPin size={11} className="shrink-0 opacity-70" />
              {label}
            </button>
          );
        })}
      </div>
      {focus?.info.wm && (
        <WorldMapModal
          focus={focus}
          all={all}
          onFocus={setFocusId}
          onClose={() => setFocusId(null)}
        />
      )}
    </div>
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
            style={{ color: "var(--accent)" }}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
