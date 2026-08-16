"use client";

import { useMemo, useState } from "react";
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

const MAX_MAP_CHIPS = 12;

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
  const [selectedId, setSelectedId] = useState(monsters[0].id);
  const tooltip = useItemTooltip();

  const q = query.trim();
  const filtered = useMemo(() => (q ? monsters.filter((m) => matches(m, q)) : monsters), [q]);
  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0];

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">怪物掉落查詢</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋怪物 / 道具 / 地圖"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
        />
      </div>

      <div className="text-xs text-slate-400">
        共 {filtered.length} 隻怪物{q && `符合「${q}」`}
        {q && filtered.length > 0 && "（也搜尋掉落物與出沒地圖）"}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-y-auto max-h-[75vh]">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              找不到符合「{q}」的怪物、掉落物或地圖
            </div>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                selected && m.id === selected.id ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <GameIcon src={mobIconSrc(m.id)} alt={m.name} fallback="🐌" className="w-10 h-10 shrink-0" />
              <span className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{m.name}</div>
                <div className="text-xs text-slate-400 truncate">{regionsOf(m)[0] ?? "出沒地不明"}</div>
              </span>
              <span className="text-xs text-slate-400 shrink-0">{m.level != null ? `Lv.${m.level}` : "Lv.?"}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 self-start">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
                <GameIcon src={mobIconSrc(selected.id)} alt={selected.name} fallback="🐌" className="w-14 h-14" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-800">{selected.name}</div>
                <div className="text-sm text-slate-400">#{selected.id}</div>
              </div>
              <div className="ml-auto flex gap-4 text-sm text-slate-600">
                <Stat label="等級" value={selected.level != null ? `${selected.level}` : "?"} />
                <Stat label="掉落物" value={`${selected.drops.length}`} />
                <Stat label="出沒地圖" value={`${selected.maps.length}`} />
              </div>
            </div>

            <MapChips monster={selected} />

            <div className="mt-4">
              <div className="text-sm font-medium text-slate-700 mb-2">掉落物品</div>
              {selected.drops.length === 0 ? (
                <div className="text-sm text-slate-400 py-4">圖鑑內沒有這隻怪物的掉落記錄。</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {selected.drops.map((iid) => {
                    const name = itemName(iid);
                    const hit = q !== "" && name.includes(q);
                    return (
                      <div
                        key={iid}
                        {...tooltip.handlers(iid)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                          hit ? "border-indigo-300 bg-indigo-50" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <GameIcon src={itemIconSrc(iid)} alt={name} fallback="📦" className="w-8 h-8 shrink-0" />
                        <span className="text-sm text-slate-700 leading-tight">{name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="mt-5 text-xs text-slate-400">
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
  const hidden = named.length - MAX_MAP_CHIPS;
  return (
    <div className="mt-4">
      <div className="text-sm font-medium text-slate-700 mb-2">出沒地圖</div>
      <div className="flex flex-wrap gap-1.5">
        {named.slice(0, MAX_MAP_CHIPS).map(({ id, info }) => (
          <span key={id} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
            {info.street ? `${info.street}・${info.name}` : info.name}
          </span>
        ))}
        {hidden > 0 && (
          <span className="text-xs text-slate-400 rounded-full px-1.5 py-1">+{hidden} 張</span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-slate-800 font-medium">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
