"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, themeHref } from "@/nav";

export default function DarkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen flex text-slate-100"
      style={{
        fontFamily: "var(--font-rajdhani), system-ui, sans-serif",
        background: "radial-gradient(circle at 20% 20%, #1e1b4b 0%, #0b0f1a 45%, #05070d 100%)",
      }}
    >
      <aside className="w-64 shrink-0 border-r border-white/10 p-4 flex flex-col">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-black">
            楓
          </div>
          <div>
            <div className="font-bold tracking-wide text-white">楓谷工具箱</div>
            <div className="text-[10px] text-cyan-300/70 uppercase tracking-widest">Toolbox v0.1</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const href = themeHref("dark", item.path);
            const isActive = pathname === href;
            return (
              <Link
                key={item.key}
                href={item.enabled ? href : "#"}
                onClick={(e) => {
                  if (!item.enabled) e.preventDefault();
                }}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold tracking-wide border transition-all",
                  !item.enabled && "text-slate-600 border-transparent cursor-not-allowed",
                  item.enabled && isActive && "bg-cyan-400/10 border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_-3px_rgba(34,211,238,0.5)]",
                  item.enabled && !isActive && "text-slate-300 border-transparent hover:bg-white/5 hover:border-white/10",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {!item.enabled && (
                  <span className="text-[9px] bg-white/5 text-slate-500 rounded px-1.5 py-0.5 border border-white/10">SOON</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="text-[10px] text-slate-500 px-2 pt-4 border-t border-white/10">資料整理自玩家社群 · 非官方</div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
