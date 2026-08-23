"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Shirt,
  Users,
  Moon,
  Sun,
  Menu,
  X,
  Map as MapIcon,
  Timer,
  Dices,
  ScrollText,
  Sparkles,
  Target,
  ChevronDown,
} from "lucide-react";
import { navGroups, navHref, type NavItem } from "@/nav";
import { LIGHT_TOKENS, DARK_TOKENS, useDarkMode, themeVars } from "./theme";

const NAV_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  home: Home,
  monsters: Search,
  gacha: Dices,
  quests: ScrollText,
  fashion: Shirt,
  party: Users,
  map: MapIcon,
  "boss-timer": Timer,
  skills: Sparkles,
  "skill-build": Target,
};

// 偵探帽 + 放大鏡標誌。用 CSS var 上色（不是 media query），
// 這樣才會跟著網站自己的深色模式開關即時換色，而不是只認系統設定。
function Logo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <ellipse cx="50" cy="62" rx="34" ry="8" fill="var(--text)" />
      <path
        d="M33 61 L33 36 Q33 20 50 20 Q67 20 67 36 L67 61 Z"
        fill="var(--text)"
      />
      <path
        d="M33 46 Q50 43 67 46 L67 52 Q50 49 33 52 Z"
        fill="var(--accent)"
      />
      <circle
        cx="68"
        cy="69"
        r="9.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3.4"
      />
      <line
        x1="74.7"
        y1="75.7"
        x2="82"
        y2="83"
        stroke="var(--accent)"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavEntry({
  item,
  pathname,
  linkClassName,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  linkClassName: (isActive: boolean, enabled: boolean) => string;
  onNavigate?: () => void;
}) {
  const Icon = NAV_ICONS[item.key];
  const href = navHref(item.path);
  const isActive = item.enabled && pathname === href;
  return (
    <Link
      href={item.enabled ? href : "#"}
      aria-disabled={!item.enabled}
      onClick={(e) => {
        if (!item.enabled) {
          e.preventDefault();
          return;
        }
        onNavigate?.();
      }}
      className={linkClassName(isActive, item.enabled)}
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
}

/** 桌機版：兩個主選單（查詢／工具），點了展開子選單。 */
function NavMenus({
  pathname,
  className,
  linkClassName,
}: {
  pathname: string;
  className: string;
  linkClassName: (isActive: boolean, enabled: boolean) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav ref={ref} className={className}>
      {navGroups.map((group) => {
        const groupActive = group.items.some(
          (i) => i.enabled && pathname === navHref(i.path),
        );
        return (
          <div key={group.key} className="relative">
            <button
              onClick={() => setOpen(open === group.key ? null : group.key)}
              aria-expanded={open === group.key}
              className={`${linkClassName(groupActive, true)} cursor-pointer`}
            >
              {group.label}
              <ChevronDown
                size={14}
                className={`transition-transform ${open === group.key ? "rotate-180" : ""}`}
              />
            </button>
            {open === group.key && (
              <div className="absolute left-0 top-full z-40 mt-1 min-w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
                {group.items.map((item) => (
                  <NavEntry
                    key={item.key}
                    item={item}
                    pathname={pathname}
                    linkClassName={linkClassName}
                    onNavigate={() => setOpen(null)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** 手機版側邊選單：分組攤平列出，不做展開收合（少一層點擊）。 */
function NavList({
  pathname,
  className,
  linkClassName,
  onNavigate,
}: {
  pathname: string;
  className: string;
  linkClassName: (isActive: boolean, enabled: boolean) => string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={className}>
      {navGroups.map((group) => (
        <div key={group.key} className="mb-2">
          <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
            {group.label}
          </div>
          {group.items.map((item) => (
            <NavEntry
              key={item.key}
              item={item}
              pathname={pathname}
              linkClassName={linkClassName}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isDark, toggle } = useDarkMode();
  const tokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const linkClassName = (isActive: boolean, enabled: boolean) =>
    [
      "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors md:py-1.5 md:whitespace-nowrap",
      enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50",
      enabled && isActive && "bg-[var(--accent-soft)] text-[var(--accent)]",
      enabled &&
        !isActive &&
        "text-[var(--text-muted)] hover:bg-[var(--accent-soft)]/60 hover:text-[var(--text)]",
      !enabled && "text-[var(--text-muted)]",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      style={{
        ...themeVars(tokens),
        fontFamily: "var(--font-noto-tc), system-ui, sans-serif",
      }}
      className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors"
    >
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 sm:gap-6">
          <Link
            href={navHref("")}
            className="flex items-center gap-2 font-bold text-[var(--accent)] shrink-0"
          >
            <Logo size={28} />
            <span className="text-lg">楓探</span>
            {/* <span className="text-xs font-normal text-[var(--text-muted)] hidden sm:inline">
              Maple Detective
            </span> */}
          </Link>

          <NavMenus
            pathname={pathname}
            className="hidden md:flex items-center gap-1 flex-1"
            linkClassName={linkClassName}
          />

          <div className="flex-1 md:hidden" />

          <button
            onClick={toggle}
            aria-label="切換深色模式"
            className="cursor-pointer w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            onClick={() => setMenuOpen(true)}
            aria-label="開啟選單"
            aria-expanded={menuOpen}
            className="cursor-pointer -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors md:hidden"
          >
            <Menu size={19} />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 md:hidden ${menuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity ${menuOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-[var(--surface)] shadow-xl transition-transform duration-200 ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-14 items-center justify-end border-b border-[var(--border)] px-4">
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="關閉選單"
              className="cursor-pointer -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
            >
              <X size={19} />
            </button>
          </div>
          <NavList
            pathname={pathname}
            className="flex flex-col gap-0.5 px-3 py-3"
            linkClassName={linkClassName}
            onNavigate={() => setMenuOpen(false)}
          />
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-[11px] text-[var(--text-muted)]">
        © 2026 楓探 Maple Detective
        <p className="mt-1">
          本站資料僅供參考，若有任何問題可至
          <a
            href="https://forum.gamer.com.tw/Co.php?bsn=85994&sn=5193"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            巴哈討論區
          </a>
          回報
        </p>
      </footer>
    </div>
  );
}
