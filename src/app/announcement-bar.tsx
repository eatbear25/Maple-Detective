"use client";

import { HoverPrefetchLink as Link } from "@/app/hover-prefetch-link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  X,
} from "lucide-react";
import {
  SHEET_CSV_URL,
  parseAnnouncements,
  type Announcement,
} from "@/lib/announcements";
import { useStored } from "./fashion/storage";

/**
 * 全站公告列（資料來源與試算表格式見 src/lib/announcements.ts）。
 *
 * 併在 header 裡當第二列（同一個底色、細線隔開），不另外做一條有底色的橫幅：
 * 放在 header 上面加一條米色底的版本，畫面會變成三條顏色不同的帶子，像 cookie 提示。
 *
 * 頁面是純靜態的，公告在瀏覽器載入後才去 Google 試算表拿，所以會晚一拍才
 * 從 header 底下滑出來；沒有公告或讀不到試算表就整條不出現。
 *
 * 多則公告一次只顯示一則、輪流換（並排的話兩則擠在一條裡很亂）。單則塞不下時，
 * 輪到它的那段時間會先停一下、慢慢往左捲到結尾、再停一下才換下一則——窄視窗
 * 也看得完整句。滑鼠移上去或用 Tab 走進來就停住；系統開了「減少動態效果」就
 * 不滑動也不自動捲，塞不下的改成手動左右捲。
 *
 * 多則時右邊有上一則／下一則兩個小箭頭。使用者打槍過、別加回來的：箭頭中間的
 * 「1/2」頁碼（佔寬度、擋路）、捲動時左右兩端的淡出遮罩（手機上字會糊掉看不清楚）。
 *
 * 按 × 收起之後，header 右上角會出現大聲公按鈕可以再打開。收起是記在瀏覽器裡、
 * 綁定「這一批公告」：試算表內容一改（新增、改字、改連結）就會自動再打開。
 */

const DISMISSED_KEY = "announcement-dismissed";
const parseString = (v: unknown) => (typeof v === "string" ? v : null);
const NOT_DISMISSED = "";

/** 塞得下的公告每則停多久（ms） */
const DWELL = 5000;
/** 塞不下的公告捲動前、捲完後各停多久（ms） */
const HOLD = 1500;
/** 捲動速度（px／秒） */
const SPEED = 45;

export interface AnnouncementsState {
  items: Announcement[];
  collapsed: boolean;
  collapse: () => void;
  expand: () => void;
}

/** 公告列與 header 上的「打開公告」按鈕共用同一份狀態，由 SiteShell 呼叫一次再分給兩邊 */
export function useAnnouncements(): AnnouncementsState {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useStored(
    DISMISSED_KEY,
    NOT_DISMISSED,
    parseString,
  );

  useEffect(() => {
    let alive = true;
    fetch(SHEET_CSV_URL)
      // 試算表沒開共用時，Google 會導去登入頁（HTML），不能當 CSV 解出一堆亂碼公告
      .then((r) =>
        r.ok && r.headers.get("content-type")?.includes("text/csv")
          ? r.text()
          : "",
      )
      .then((csv) => {
        if (alive && csv) setItems(parseAnnouncements(csv));
      })
      .catch(() => {
        /* 讀不到就不顯示公告 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const signature = useMemo(
    () => items.map((a) => `${a.date}|${a.text}|${a.href ?? ""}`).join("\n"),
    [items],
  );

  return {
    items,
    collapsed: items.length > 0 && dismissed === signature,
    collapse: () => setDismissed(signature),
    expand: () => setDismissed(NOT_DISMISSED),
  };
}

/** header 第一列的按鈕：公告收起來時才出現，按了再打開 */
export function AnnouncementToggle({ state }: { state: AnnouncementsState }) {
  if (!state.collapsed) return null;
  return (
    <button
      onClick={state.expand}
      aria-label="打開公告"
      title="打開公告"
      className="cursor-pointer size-11 rounded-lg flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] transition-colors md:size-10"
    >
      <Megaphone size={18} />
    </button>
  );
}

export default function AnnouncementBar({
  state,
}: {
  state: AnnouncementsState;
}) {
  if (!state.items.length || state.collapsed) return null;
  return (
    <div
      role="region"
      aria-label="網站公告"
      className="announcement-bar h-9 overflow-hidden border-t border-[var(--border)] text-[13px]"
    >
      {/* 左右邊距跟 header 第一列一樣：「公告」標籤對齊 logo，× 對齊深色模式按鈕 */}
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center gap-2.5">
        <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-text)]">
          公告
        </span>
        <Rotator items={state.items} />
        <button
          onClick={state.collapse}
          aria-label="收起公告"
          title="收起公告"
          className="cursor-pointer shrink-0 flex h-7 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function Rotator({ items }: { items: Announcement[] }) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  /** 每換一次 +1，拿來當 key 讓新的那則重新掛載、播一次滑入動畫（只有一則時也靠它重播捲動） */
  const [cycle, setCycle] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const pausedRef = useRef(false);
  const paused = hovered || focused;

  const go = (delta: number) => {
    setIndex((i) => (((i + delta) % count) + count) % count);
    setCycle((c) => c + 1);
  };

  // ResizeObserver 一開始觀察就會先回報一次；視窗縮放時重算這則要不要捲
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => setBoxWidth(box.clientWidth));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // 這則公告的「停留＋捲動」用一支 Web Animation 表示：暫停／繼續就是 pause()／play()，
  // 不用自己記計時器剩多少；播完（onfinish）就換下一則。
  useEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text || !boxWidth) return;

    // 減少動態效果：照樣輪流換（每則停 DWELL），但塞不下時不自動捲，改成手動左右捲
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const overflow = reduced ? 0 : text.scrollWidth - box.clientWidth;
    if (overflow <= 0 && count === 1) return;

    let anim: Animation;
    if (overflow > 0) {
      const scroll = (overflow / SPEED) * 1000;
      const total = HOLD + scroll + HOLD;
      const end = `translateX(${-overflow}px)`;
      anim = text.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(0)", offset: HOLD / total },
          { transform: end, offset: (HOLD + scroll) / total },
          { transform: end },
        ],
        { duration: total, fill: "forwards" },
      );
    } else {
      anim = text.animate([{ opacity: 1 }, { opacity: 1 }], { duration: DWELL });
    }
    if (pausedRef.current) anim.pause();
    anim.onfinish = () => {
      setIndex((i) => (i + 1) % count);
      setCycle((c) => c + 1);
    };
    animRef.current = anim;
    return () => {
      anim.cancel();
      animRef.current = null;
    };
  }, [index, cycle, boxWidth, count]);

  useEffect(() => {
    pausedRef.current = paused;
    const anim = animRef.current;
    if (!anim) return;
    if (paused) anim.pause();
    else if (anim.playState === "paused") anim.play();
  }, [paused]);

  const a = items[index];

  return (
    <div
      className="flex flex-1 min-w-0 h-full items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // 只認鍵盤的 focus：滑鼠點完箭頭，焦點會一直留在按鈕上，算進去的話滑鼠移開了也不會再自動換
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div
        ref={boxRef}
        className="announcement-box flex-1 min-w-0 h-full overflow-hidden"
      >
        <div
          key={cycle}
          className={`h-full flex items-center ${cycle > 0 ? "announcement-swap" : ""}`}
        >
          <div ref={textRef} className="w-max">
            <Item a={a} />
          </div>
        </div>
      </div>
      {count > 1 && (
        <div className="flex shrink-0 items-center text-[var(--text-muted)]">
          <button
            onClick={() => go(-1)}
            aria-label="上一則公告"
            title="上一則"
            className="cursor-pointer flex h-7 w-6 items-center justify-center rounded-md hover:bg-[var(--accent-soft)] hover:text-[var(--text)] transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="下一則公告"
            title="下一則"
            className="cursor-pointer flex h-7 w-6 items-center justify-center rounded-md hover:bg-[var(--accent-soft)] hover:text-[var(--text)] transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function Item({ a }: { a: Announcement }) {
  const external = !!a.href && !a.href.startsWith("/");
  const LinkIcon = external ? ArrowUpRight : ArrowRight;
  const body = (
    <>
      {a.date && (
        <span className="tabular-nums text-[var(--text-muted)]">{a.date}</span>
      )}
      <span>{a.text}</span>
      {/* 不用 › ：會跟右邊切換上下則的箭頭長得一樣 */}
      {a.href && (
        <LinkIcon
          size={13}
          aria-hidden="true"
          className="shrink-0 text-[var(--accent-text)]"
        />
      )}
    </>
  );
  const cls = "flex items-center gap-1.5 whitespace-nowrap";
  if (!a.href) return <span className={cls}>{body}</span>;

  const linkCls = `${cls} rounded hover:text-[var(--accent-text)] hover:underline underline-offset-2`;
  if (!external) {
    // 完全不預先載入。輪播每 5 秒就重新掛載一次這個連結，網站一重新部署，
    // 舊分頁預先載入回來的資料版本對不上會被丟掉、10 秒後又重抓，永遠停不下來：
    // 2026-10-31 查到 10/30 以前開著沒關的分頁，12 小時把這兩則公告的頁面各打了 2.3 萬次。
    return (
      <Link href={a.href} prefetch={false} className={linkCls}>
        {body}
      </Link>
    );
  }
  return (
    <a
      href={a.href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkCls}
    >
      {body}
    </a>
  );
}
