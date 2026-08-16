"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  monsters,
  itemName,
  mapInfo,
  regionsOf,
  mobIconSrc,
  itemIconSrc,
  type DropMonster,
} from "@/data/drops";
import { GameIcon } from "./game-icon";
import { ItemTooltip, useItemTooltip } from "./item-tooltip";

const ALL_REGIONS = "全部";

function matches(m: DropMonster, q: string) {
  if (m.name.includes(q) || m.id === q) return true;
  if (m.drops.some((iid) => itemName(iid).includes(q))) return true;
  return m.maps.some((mp) => {
    const info = mapInfo(mp);
    return !!info && (info.name.includes(q) || info.street.includes(q));
  });
}

export default function MinimalMonsterPage() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(ALL_REGIONS);
  const [selectedId, setSelectedId] = useState(monsters[0].id);
  const tooltip = useItemTooltip();

  // 大地區清單：用出沒地圖數排序，只列有名字的大地區（街道層級，不下鑽到小地圖）
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of monsters) {
      for (const r of regionsOf(m)) counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, []);

  const q = query.trim();
  const filtered = useMemo(() => {
    return monsters.filter((m) => {
      if (q && !matches(m, q)) return false;
      if (region !== ALL_REGIONS && !regionsOf(m).includes(region)) return false;
      return true;
    });
  }, [q, region]);
  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">怪物掉落查詢</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          從遊戲用戶端圖鑑整理，共 {monsters.length} 隻怪物的掉落記錄
        </p>

        <div className="mt-4 relative max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋怪物 / 道具 / 地圖"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 py-2 text-sm outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[ALL_REGIONS, ...regions].map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`cursor-pointer text-xs rounded-full px-3 py-1 border transition-colors ${
                region === r
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-2 text-xs text-[var(--text-muted)]">
          共 {filtered.length} 隻符合{q && `「${q}」`}
          {region !== ALL_REGIONS && `・${region}`}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
        <div className="themed-scroll space-y-0.5 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2">
          {filtered.length === 0 && (
            <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
              找不到符合「{q}」的怪物、掉落物或地圖
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
              <GameIcon src={mobIconSrc(m.id)} alt={m.name} fallback="🐌" className="w-9 h-9 shrink-0" />
              <span className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.name}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {regionsOf(m)[0] ?? "出沒地不明"}
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
            <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
              <div className="w-16 h-16 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center overflow-hidden shrink-0">
                <GameIcon src={mobIconSrc(selected.id)} alt={selected.name} fallback="🐌" className="w-12 h-12" />
              </div>
              <div>
                <div className="text-2xl font-bold">{selected.name}</div>
                <div className="text-sm text-[var(--text-muted)]">#{selected.id}</div>
              </div>
              <div className="ml-auto flex gap-6 text-sm">
                <Stat label="等級" value={selected.level != null ? `${selected.level}` : "?"} />
                <Stat label="掉落物" value={`${selected.drops.length}`} />
                <Stat label="出沒地圖" value={`${selected.maps.length}`} />
              </div>
            </div>

            <MapChips monster={selected} />

            <div className="mt-6">
              <div className="text-sm font-semibold mb-3" style={{ color: "var(--accent)" }}>
                掉落物品
              </div>
              {selected.drops.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] py-4">圖鑑內沒有這隻怪物的掉落記錄。</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selected.drops.map((iid) => {
                    const name = itemName(iid);
                    const hit = q !== "" && name.includes(q);
                    return (
                      <div
                        key={iid}
                        {...tooltip.handlers(iid)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                          hit
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] hover:border-[var(--accent)]"
                        }`}
                      >
                        <GameIcon src={itemIconSrc(iid)} alt={name} fallback="📦" className="w-8 h-8 shrink-0" />
                        <span className="text-sm leading-tight">{name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="mt-5 text-xs text-[var(--text-muted)]">
              掉落清單取自遊戲用戶端的怪物圖鑑資料（不含掉落機率）；圖示來源 maplestory.io。
            </p>
          </div>
        )}
      </div>

      {tooltip.id != null && <ItemTooltip id={tooltip.id} panelRef={tooltip.panelRef} />}
    </div>
  );
}

function MapChips({ monster }: { monster: DropMonster }) {
  const named = monster.maps
    .map((id) => ({ id, info: mapInfo(id) }))
    .filter((x): x is { id: number; info: { street: string; name: string } } => !!x.info);
  if (named.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold mb-2" style={{ color: "var(--accent)" }}>
        出沒地圖
      </div>
      <div className="flex flex-wrap gap-1.5">
        {named.slice(0, 12).map(({ id, info }) => (
          <span
            key={id}
            className="text-xs rounded-full px-2.5 py-1 bg-[var(--accent-soft)] text-[var(--text)]"
          >
            {info.street ? `${info.street}・${info.name}` : info.name}
          </span>
        ))}
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
