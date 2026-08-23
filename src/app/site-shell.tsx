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
  BookOpen,
  Gamepad2,
  ChevronDown,
} from "lucide-react";
import { navTree, isNavGroup, navHref, type NavItem } from "@/nav";
import { LIGHT_TOKENS, DARK_TOKENS, useDarkMode, themeVars } from "./theme";

// nav 圖示對照表。鍵可以是 NavItem 的 key，也可以是 NavGroup 的 key
// （群組在桌機主列上也要有圖示，不然同一排只有單項有會看起來歪掉）。
const NAV_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  home: Home,
  lookup: BookOpen,
  simulators: Gamepad2,
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
  onMouseEnter,
}: {
  item: NavItem;
  pathname: string;
  linkClassName: (isActive: boolean, enabled: boolean) => string;
  onNavigate?: () => void;
  /** 桌機主列用：滑到頂層單項時把別的群組下拉收掉。 */
  onMouseEnter?: () => void;
}) {
  const Icon = NAV_ICONS[item.key];
  const href = navHref(item.path);
  const isActive = item.enabled && pathname === href;
  return (
    <Link
      href={item.enabled ? href : "#"}
      aria-disabled={!item.enabled}
      onMouseEnter={onMouseEnter}
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

/**
 * 桌機版：群組（查詢／模擬器）滑鼠移上去就展開，頂層單項（怪物掉落／BOSS 計時器）直接連過去。
 * 點擊仍然可以切換（鍵盤與觸控裝置只有這條路）。
 */
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 元件卸載時別留下待觸發的關閉計時器
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // 觸控裝置不吃 hover：那邊點一下也會先觸發 mouseenter，會跟按鈕的 click toggle
  // 打架變成「點開又立刻關掉」。在事件處理器裡才查（不是 render 時），避免 hydration 不一致。
  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  const hoverOpen = (key: string) => {
    if (!canHover()) return;
    cancelClose();
    setOpen(key);
  };

  // 延遲關閉：下拉是 absolute + mt-1，畫在 .relative 容器的框外，
  // 游標穿過那 4px 空隙時會先觸發 mouseleave，沒有緩衝的話選單會在半路關掉。
  const hoverClose = () => {
    if (!canHover()) return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  };

  return (
    <nav ref={ref} className={className}>
      {navTree.map((node) => {
        if (!isNavGroup(node)) {
          return (
            <NavEntry
              key={node.key}
              item={node}
              pathname={pathname}
              linkClassName={linkClassName}
              onMouseEnter={hoverClose}
            />
          );
        }
        const group = node;
        const GroupIcon = NAV_ICONS[group.key];
        const groupActive = group.items.some(
          (i) => i.enabled && pathname === navHref(i.path),
        );
        return (
          <div
            key={group.key}
            className="relative"
            onMouseEnter={() => hoverOpen(group.key)}
            onMouseLeave={hoverClose}
          >
            <button
              onClick={() => setOpen(open === group.key ? null : group.key)}
              aria-expanded={open === group.key}
              className={`${linkClassName(groupActive, true)} cursor-pointer`}
            >
              {GroupIcon && <GroupIcon size={15} />}
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
                    onNavigate={() => {
                      cancelClose();
                      setOpen(null);
                    }}
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

/** 手機版側邊選單：分組攤平列出，不做展開收合（少一層點擊）；頂層單項沒有小標，直接列。 */
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
      {navTree.map((node) =>
        isNavGroup(node) ? (
          <div key={node.key} className="mb-2">
            <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
              {node.label}
            </div>
            {node.items.map((item) => (
              <NavEntry
                key={item.key}
                item={item}
                pathname={pathname}
                linkClassName={linkClassName}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <NavEntry
            key={node.key}
            item={node}
            pathname={pathname}
            linkClassName={linkClassName}
            onNavigate={onNavigate}
          />
        ),
      )}
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
