"use client";

import { useMemo, useState } from "react";
import { monsters } from "@/data/monsters";

export default function DarkMonsterPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(monsters[0].id);

  const filtered = useMemo(
    () => monsters.filter((m) => m.name.includes(query) || m.region.includes(query)),
    [query]
  );
  const selected = monsters.find((m) => m.id === selectedId) ?? monsters[0];

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-wide">怪物掉落查詢</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋怪物 / 地區…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-64 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur divide-y divide-white/5 overflow-hidden">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                m.id === selectedId ? "bg-cyan-400/10 border-l-2 border-cyan-400" : "hover:bg-white/5 border-l-2 border-transparent"
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <span className="flex-1">
                <div className="text-sm font-semibold text-slate-100">{m.name}</div>
                <div className="text-xs text-slate-500">{m.region}</div>
              </span>
              <span className="text-xs text-slate-500">Lv.{m.level}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <div className="flex items-center gap-4 pb-4 border-b border-white/10">
            <div className="w-14 h-14 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center text-3xl">
              {selected.icon}
            </div>
            <div>
              <div className="text-lg font-bold text-white">{selected.name}</div>
              <div className="text-sm text-slate-500">{selected.region}</div>
            </div>
            <div className="ml-auto flex gap-4 text-sm">
              <Stat label="等級" value={selected.level} color="text-cyan-300" />
              <Stat label="HP" value={selected.hp} color="text-rose-300" />
              <Stat label="經驗值" value={selected.exp} color="text-emerald-300" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-300 mb-2 tracking-wide">掉落物品</div>
            <div className="space-y-2">
              {selected.drops.map((d) => (
                <div key={d.itemId} className="flex items-center gap-3 rounded-lg bg-black/20 border border-white/5 px-3 py-2">
                  <span className="text-xl">{d.icon}</span>
                  <span className="flex-1 text-sm text-slate-200">{d.itemName}</span>
                  <div className="w-32 h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" style={{ width: `${Math.min(d.rate * 2, 100)}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 w-12 text-right">{d.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
