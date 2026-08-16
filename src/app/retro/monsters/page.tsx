"use client";

import { useMemo, useState } from "react";
import { monsters } from "@/data/monsters";

export default function RetroMonsterPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(monsters[0].id);

  const filtered = useMemo(
    () => monsters.filter((m) => m.name.includes(query) || m.region.includes(query)),
    [query]
  );
  const selected = monsters.find((m) => m.id === selectedId) ?? monsters[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-orange-900">🐌 怪物掉落查詢</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋怪物名稱或地區…"
        className="w-full rounded-xl border-4 border-black px-4 py-2 font-bold shadow-[4px_4px_0_0_#000] focus:outline-none focus:-translate-y-0.5 transition-transform bg-white"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 content-start">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`rounded-xl border-4 border-black p-3 text-center transition-transform shadow-[3px_3px_0_0_#000] ${
                m.id === selectedId ? "bg-orange-300 -translate-y-1" : "bg-white hover:-translate-y-1"
              }`}
            >
              <div className="text-3xl">{m.icon}</div>
              <div className="font-extrabold text-sm mt-1 truncate">{m.name}</div>
              <div className="text-[10px] text-orange-700 font-bold">Lv.{m.level}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
            <div className="flex items-center gap-4 border-b-4 border-black pb-4 mb-4">
              <div className="text-5xl">{selected.icon}</div>
              <div>
                <div className="text-xl font-extrabold text-orange-900">{selected.name}</div>
                <div className="text-sm font-bold text-gray-500">{selected.region}</div>
                <div className="flex gap-3 mt-1 text-xs font-bold">
                  <span className="bg-lime-200 border-2 border-black rounded px-2 py-0.5">Lv.{selected.level}</span>
                  <span className="bg-red-200 border-2 border-black rounded px-2 py-0.5">HP {selected.hp}</span>
                  <span className="bg-blue-200 border-2 border-black rounded px-2 py-0.5">EXP {selected.exp}</span>
                </div>
              </div>
            </div>

            <div className="font-extrabold text-orange-900 mb-2">掉落物品</div>
            <div className="space-y-2">
              {selected.drops.map((d) => (
                <div key={d.itemId} className="flex items-center gap-3 rounded-lg border-2 border-black bg-yellow-50 px-3 py-2">
                  <span className="text-2xl">{d.icon}</span>
                  <span className="flex-1 font-bold">{d.itemName}</span>
                  <div className="w-32 bg-white border-2 border-black rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-red-400" style={{ width: `${Math.min(d.rate * 2, 100)}%` }} />
                  </div>
                  <span className="text-sm font-extrabold w-14 text-right">{d.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
