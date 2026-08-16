"use client";

import { useState } from "react";
import { outfitItems, outfitPresets, type OutfitItem } from "@/data/outfits";

export default function DarkFashionPage() {
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
      <h1 className="text-xl font-bold text-white tracking-wide">時裝搭配</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-5 flex flex-col items-center">
          <div className="w-36 h-48 rounded-xl bg-black/30 border border-white/10 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent" />
            <div className="relative text-3xl">{equipped["帽子"]?.icon ?? "👤"}</div>
            <div className="relative text-2xl">🧍</div>
            <div className="relative text-xl">{equipped["鞋子"]?.icon ?? ""}</div>
          </div>
          <div className="mt-4 w-full text-xs text-slate-400 space-y-1.5">
            {Object.entries(equipped).map(([slot, item]) => (
              <div key={slot} className="flex justify-between">
                <span>{slot}</span>
                <span className="text-slate-200">{item ? item.name : "—"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-sm font-semibold text-slate-300 mb-3 tracking-wide">道具庫</div>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {outfitItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggle(item)}
                className={`rounded-lg border p-3 text-center transition ${
                  equipped[item.slot]?.id === item.id ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className="text-xl">{item.icon}</div>
                <div className="text-xs text-slate-300 mt-1 truncate">{item.name}</div>
              </button>
            ))}
          </div>

          <div className="text-sm font-semibold text-slate-300 mb-2 tracking-wide">熱門穿搭方案</div>
          <div className="space-y-2">
            {outfitPresets.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/20 border border-white/5 px-3 py-2">
                <div>
                  <div className="text-sm text-slate-200">{p.title}</div>
                  <div className="text-xs text-slate-500">by {p.author}</div>
                </div>
                <div className="text-xs text-fuchsia-300">❤ {p.likes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
