import Link from "next/link";
import { monsters } from "@/data/monsters";
import { outfitPresets } from "@/data/outfits";

export default function MinimalHome() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">歡迎回來 👋</h1>
        <p className="text-slate-500 text-sm mt-1">怪物掉落、時裝搭配、組隊攻略，一站整理給你。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard to="/minimal/monsters" icon="🐌" label="收錄怪物" value={`${monsters.length}`} sub="隻怪物資料" />
        <StatCard to="/minimal/fashion" icon="👗" label="穿搭方案" value={`${outfitPresets.length}`} sub="組玩家精選" />
        <StatCard to="/minimal/party" icon="🛡️" label="組隊攻略" value="3" sub="篇文章" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">熱門怪物</h2>
          <Link href="/minimal/monsters" className="text-xs text-indigo-600 hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {monsters.slice(0, 4).map((m) => (
            <Link
              key={m.id}
              href="/minimal/monsters"
              className="border border-slate-200 rounded-lg p-3 text-center hover:border-indigo-300 hover:shadow-sm transition"
            >
              <div className="text-2xl">{m.icon}</div>
              <div className="text-sm font-medium text-slate-700 mt-1">{m.name}</div>
              <div className="text-xs text-slate-400">Lv.{m.level}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ to, icon, label, value, sub }: { to: string; icon: string; label: string; value: string; sub: string }) {
  return (
    <Link href={to} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition block">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-slate-800 mt-1">{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </Link>
  );
}
