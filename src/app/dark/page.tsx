import Link from "next/link";
import { monsters } from "@/data/monsters";
import { outfitPresets } from "@/data/outfits";

export default function DarkHome() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-fuchsia-500/30 blur-3xl rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/30 blur-3xl rounded-full" />
        <h1 className="relative text-3xl font-bold tracking-wide text-white">
          冒險者，歡迎回來 <span className="text-cyan-300">Maplers</span>
        </h1>
        <p className="relative text-slate-400 mt-2">怪物掉落 / 時裝搭配 / 組隊攻略，一站式冒險資料庫。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard to="/dark/monsters" icon="🐌" label="收錄怪物" value={`${monsters.length}`} accent="from-cyan-400 to-blue-500" />
        <StatCard to="/dark/fashion" icon="👗" label="穿搭方案" value={`${outfitPresets.length}`} accent="from-fuchsia-400 to-pink-500" />
        <StatCard to="/dark/party" icon="🛡️" label="組隊攻略" value="3" accent="from-emerald-400 to-teal-500" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white tracking-wide">熱門怪物</h2>
          <Link href="/dark/monsters" className="text-xs text-cyan-300 hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {monsters.slice(0, 4).map((m) => (
            <Link
              key={m.id}
              href="/dark/monsters"
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-center hover:border-cyan-400/40 hover:bg-cyan-400/5 transition"
            >
              <div className="text-2xl">{m.icon}</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">{m.name}</div>
              <div className="text-xs text-slate-500">Lv.{m.level}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ to, icon, label, value, accent }: { to: string; icon: string; label: string; value: string; accent: string }) {
  return (
    <Link href={to} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 hover:border-white/20 transition block">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-3xl font-bold mt-1 bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{value}</div>
    </Link>
  );
}
