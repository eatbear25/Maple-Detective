"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, themeHref } from "@/nav";

export default function RetroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen flex"
      style={{
        fontFamily: "var(--font-baloo), system-ui, sans-serif",
        background: "repeating-linear-gradient(45deg, #ffe89a, #ffe89a 20px, #ffdd6b 20px, #ffdd6b 40px)",
      }}
    >
      <aside className="w-64 shrink-0 p-4">
        <div className="sticky top-4">
          <div className="rounded-2xl border-4 border-black bg-gradient-to-b from-lime-300 to-lime-400 p-4 mb-4 text-center shadow-[6px_6px_0_0_#000]">
            <div className="text-3xl">🍁</div>
            <div
              className="text-white text-[11px] leading-tight mt-1"
              style={{ fontFamily: "var(--font-press-start), monospace", textShadow: "2px 2px 0 #00000055" }}
            >
              楓谷工具箱
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const href = themeHref("retro", item.path);
              const isActive = pathname === href;
              return (
                <Link
                  key={item.key}
                  href={item.enabled ? href : "#"}
                  onClick={(e) => {
                    if (!item.enabled) e.preventDefault();
                  }}
                  className={[
                    "flex items-center gap-2 rounded-xl border-4 border-black px-3 py-2 font-extrabold text-sm transition-transform",
                    item.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                    isActive && item.enabled
                      ? "bg-orange-400 text-white shadow-[4px_4px_0_0_#000] -translate-y-0.5"
                      : "bg-white text-orange-900 shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000]",
                  ].join(" ")}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {!item.enabled && (
                    <span
                      className="text-[8px] bg-black text-white rounded px-1 py-0.5"
                      style={{ fontFamily: "var(--font-press-start), monospace" }}
                    >
                      敬請期待
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
