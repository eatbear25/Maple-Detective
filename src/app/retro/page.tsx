import Link from "next/link";
import { monsters } from "@/data/monsters";
import { outfitPresets } from "@/data/outfits";

export default function RetroHome() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border-4 border-black bg-gradient-to-br from-pink-300 via-orange-300 to-yellow-300 p-8 shadow-[8px_8px_0_0_#000]">
        <h1 className="text-2xl md:text-3xl text-white drop-shadow-[3px_3px_0_#00000066] font-extrabold">
          歡迎回到楓之谷工具箱！🍁
        </h1>
        <p className="mt-2 text-white/90 font-bold">怪物掉落、時裝穿搭、組隊攻略，通通在這裡一次找齊。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard to="/retro/monsters" icon="🐌" label="收錄怪物" value={`${monsters.length} 隻`} color="from-lime-300 to-lime-400" />
        <StatCard to="/retro/fashion" icon="👗" label="穿搭方案" value={`${outfitPresets.length} 組`} color="from-sky-300 to-sky-400" />
        <StatCard to="/retro/party" icon="🛡️" label="組隊攻略" value="持續更新中" color="from-purple-300 to-purple-400" />
      </div>

      <div className="rounded-2xl border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
        <h2 className="font-extrabold text-lg text-orange-900 mb-3">🔥 熱門怪物掉落</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {monsters.slice(0, 4).map((m) => (
            <Link
              key={m.id}
              href="/retro/monsters"
              className="rounded-xl border-2 border-black bg-yellow-50 p-3 text-center hover:-translate-y-1 transition-transform shadow-[3px_3px_0_0_#000]"
            >
              <div className="text-3xl">{m.icon}</div>
              <div className="font-bold text-sm mt-1">{m.name}</div>
              <div className="text-xs text-orange-700">Lv.{m.level}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ to, icon, label, value, color }: { to: string; icon: string; label: string; value: string; color: string }) {
  return (
    <Link href={to} className={`rounded-2xl border-4 border-black bg-gradient-to-br ${color} p-5 shadow-[6px_6px_0_0_#000] hover:-translate-y-1 transition-transform block`}>
      <div className="text-3xl">{icon}</div>
      <div className="text-white/90 font-bold text-sm mt-2">{label}</div>
      <div className="text-white font-extrabold text-xl">{value}</div>
    </Link>
  );
}
