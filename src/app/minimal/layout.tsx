"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, themeHref } from "@/nav";

export default function MinimalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
            楓
          </div>
          <span className="font-semibold text-slate-800">楓谷工具箱</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const href = themeHref("minimal", item.path);
            const isActive = pathname === href;
            return (
              <Link
                key={item.key}
                href={item.enabled ? href : "#"}
                aria-disabled={!item.enabled}
                onClick={(e) => {
                  if (!item.enabled) e.preventDefault();
                }}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  !item.enabled && "text-slate-300 cursor-not-allowed",
                  item.enabled && isActive && "bg-indigo-50 text-indigo-700",
                  item.enabled && !isActive && "text-slate-600 hover:bg-slate-100",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {!item.enabled && (
                  <span className="text-[10px] bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">籌備中</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 text-[11px] text-slate-400 border-t border-slate-200 space-y-1">
          <div>資料整理自玩家社群，非官方網站</div>
          <Link href="/styles" className="text-indigo-500 hover:underline">
            查看其他風格預覽
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6">
          <span className="text-sm text-slate-500">給玩家的楓之谷攻略工具箱</span>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
