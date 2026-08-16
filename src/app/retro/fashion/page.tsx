"use client";

import { useState } from "react";
import { outfitItems, outfitPresets, type OutfitItem } from "@/data/outfits";

export default function RetroFashionPage() {
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
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-orange-900">👗 時裝搭配</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border-4 border-black bg-gradient-to-b from-sky-200 to-sky-300 p-5 shadow-[6px_6px_0_0_#000] flex flex-col items-center">
          <div className="text-sm font-extrabold text-sky-900 mb-2">角色預覽</div>
          <div className="relative w-40 h-56 bg-white border-4 border-black rounded-2xl flex flex-col items-center justify-center gap-1">
            <div className="text-4xl">{equipped["帽子"]?.icon ?? "👤"}</div>
            <div className="text-3xl">🧍</div>
            <div className="text-2xl">{equipped["鞋子"]?.icon ?? ""}</div>
            {equipped["耳環"] && <div className="absolute top-10 right-4 text-lg">{equipped["耳環"].icon}</div>}
          </div>
          <div className="mt-3 text-xs font-bold text-sky-900 space-y-1 text-left w-full">
            {Object.entries(equipped).map(([slot, item]) => (
              <div key={slot} className="flex justify-between border-b border-sky-400/50 pb-0.5">
                <span>{slot}</span>
                <span>{item ? item.name : "（未裝備）"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
          <div className="font-extrabold text-orange-900 mb-3">道具庫（點擊穿脫）</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
            {outfitItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggle(item)}
                className={`rounded-xl border-4 border-black p-3 text-center transition-transform shadow-[3px_3px_0_0_#000] ${
                  equipped[item.slot]?.id === item.id ? "-translate-y-1 bg-orange-200" : "bg-yellow-50 hover:-translate-y-1"
                }`}
              >
                <div className="text-2xl">{item.icon}</div>
                <div className="text-xs font-bold mt-1 truncate">{item.name}</div>
                <div className="text-[10px] text-gray-500">{item.slot}</div>
              </button>
            ))}
          </div>

          <div className="font-extrabold text-orange-900 mb-2">熱門穿搭方案</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {outfitPresets.map((p) => (
              <div key={p.id} className="rounded-xl border-2 border-black bg-pink-50 p-3">
                <div className="font-bold text-sm">{p.title}</div>
                <div className="text-xs text-gray-500">by {p.author}</div>
                <div className="text-xs mt-1">❤️ {p.likes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
