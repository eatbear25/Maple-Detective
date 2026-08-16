"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Shirt, Users, Moon, Sun } from "lucide-react";
import { navItems, themeHref } from "@/nav";
import { LIGHT_TOKENS, DARK_TOKENS, useDarkMode, themeVars } from "./theme";

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home,
  monsters: Search,
  fashion: Shirt,
  party: Users,
};

export default function MinimalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isDark, toggle } = useDarkMode();
  const tokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;

  return (
    <div
      style={{ ...themeVars(tokens), fontFamily: "var(--font-noto-tc), system-ui, sans-serif" }}
      className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors"
    >
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-[var(--accent)] shrink-0">
            <span className="text-lg">楓探</span>
            <span className="text-xs font-normal text-[var(--text-muted)] hidden sm:inline">Maple Detective</span>
          </div>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = NAV_ICONS[item.key];
              const href = themeHref("minimal", item.path);
              const isActive = item.enabled && pathname === href;
              return (
                <Link
                  key={item.key}
                  href={item.enabled ? href : "#"}
                  aria-disabled={!item.enabled}
                  onClick={(e) => {
                    if (!item.enabled) e.preventDefault();
                  }}
                  className={[
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    item.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                    item.enabled && isActive && "bg-[var(--accent-soft)] text-[var(--accent)]",
                    item.enabled && !isActive && "text-[var(--text-muted)] hover:bg-[var(--accent-soft)]/60 hover:text-[var(--text)]",
                    !item.enabled && "text-[var(--text-muted)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {Icon && <Icon size={15} />}
                  {item.label}
                  {!item.enabled && (
                    <span className="text-[10px] bg-[var(--accent-soft)] text-[var(--text-muted)] rounded-full px-1.5 py-0.5">
                      籌備中
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={toggle}
            aria-label="切換深色模式"
            className="cursor-pointer w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-[11px] text-[var(--text-muted)]">
        資料整理自玩家社群，非官方網站・
        <Link href="/styles" className="text-[var(--accent)] hover:underline">
          查看其他風格預覽
        </Link>
      </footer>
    </div>
  );
}
