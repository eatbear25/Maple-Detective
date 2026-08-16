"use client";

import { useState } from "react";
import { outfitItems, outfitPresets, type OutfitItem } from "@/data/outfits";

export default function MinimalFashionPage() {
  const [equipped, setEquipped] = useState<Record<string, OutfitItem | null>>({
    帽子: outfitItems[0],
    上衣: null,
    鞋子: outfitItems[4],
    武器: null,
    耳環: outfitItems[7],
  });

  const toggle = (item: OutfitItem) => {
    setEquipped((prev) => ({
      ...prev,
      [item.slot]: prev[item.slot]?.id === item.id ? null : item,
    }));
  };

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">時裝搭配</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center">
          <div className="w-36 h-48 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1">
            <div className="text-3xl">{equipped["帽子"]?.icon ?? "👤"}</div>
            <div className="text-2xl">🧍</div>
            <div className="text-xl">{equipped["鞋子"]?.icon ?? ""}</div>
          </div>
          <div className="mt-4 w-full text-xs text-slate-500 space-y-1.5">
            {Object.entries(equipped).map(([slot, item]) => (
              <div key={slot} className="flex justify-between">
                <span>{slot}</span>
                <span className="text-slate-700">{item ? item.name : "—"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-sm font-medium text-slate-700 mb-3">道具庫</div>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {outfitItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggle(item)}
                className={`border rounded-lg p-3 text-center transition ${
                  equipped[item.slot]?.id === item.id
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-xl">{item.icon}</div>
                <div className="text-xs text-slate-600 mt-1 truncate">{item.name}</div>
              </button>
            ))}
          </div>

          <div className="text-sm font-medium text-slate-700 mb-2">熱門穿搭方案</div>
          <div className="space-y-2">
            {outfitPresets.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm text-slate-800">{p.title}</div>
                  <div className="text-xs text-slate-400">by {p.author}</div>
                </div>
                <div className="text-xs text-slate-400">❤ {p.likes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
