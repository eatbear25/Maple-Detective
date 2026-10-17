"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import type { Announcement } from "@/lib/announcements";
import { useStored } from "./fashion/storage";

/**
 * 全站公告列（資料來源與試算表格式見 src/lib/announcements.ts）。
 *
 * 併在 header 裡當第二列（同一個底色、細線隔開），不另外做一條有底色的橫幅：
 * 放在 header 上面加一條米色底的版本，畫面會變成三條顏色不同的帶子，像 cookie 提示。
 *
 * 頁面是純靜態的，公告在瀏覽器載入後才去 /api/announcements 拿，所以會晚一拍才
 * 從 header 底下滑出來；沒有公告或讀不到試算表就整條不出現。
 *
 * 只有內容塞不下才會跑：一則短公告放在那邊不動，沒必要讓它一直晃。
 * 滑鼠移上去（或用 Tab 走到連結上）會停住，方便點；系統開了「減少動態效果」就不跑，
 * 改成可以手動左右捲。
 *
 * 按 × 收起來之後，同一批公告不再出現；試算表內容一改（新增、改字、改連結）就會再跳出來。
 */

const DISMISSED_KEY = "announcement-dismissed";
const parseString = (v: unknown) => (typeof v === "string" ? v : null);
const NOT_DISMISSED = "";

/** 跑馬燈速度（px／秒） */
const SPEED = 45;
/** 公告之間、以及頭尾接起來的間距（px），要跟下面的 gap-8／pr-8 一致 */
const GAP = 32;

export default function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [dismissed, setDismissed] = useStored(
    DISMISSED_KEY,
    NOT_DISMISSED,
    parseString,
  );

  useEffect(() => {
    let alive = true;
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Announcement[]) => {
        if (alive) setItems(data);
      })
      .catch(() => {
        /* 讀不到就不顯示公告 */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!items?.length) return null;
  const signature = items
    .map((a) => `${a.date}|${a.text}|${a.href ?? ""}`)
    .join("\n");
  if (dismissed === signature) return null;

  return (
    <div
      role="region"
      aria-label="網站公告"
      className="announcement-bar h-9 overflow-hidden border-t border-[var(--border)] text-[13px]"
    >
      {/* 左右邊距跟 header 第一列一樣：「公告」標籤對齊 logo，× 對齊深色模式按鈕 */}
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center gap-2.5">
        <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
          公告
        </span>
        <Ticker items={items} />
        <button
          onClick={() => setDismissed(signature)}
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

function Ticker({ items }: { items: Announcement[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  /** 一份公告（含尾端間距）的寬度；0 = 塞得下，不用跑 */
  const [loopWidth, setLoopWidth] = useState(0);

  // ResizeObserver 一開始觀察就會先回報一次，視窗縮放、字型載入完也會再報
  useEffect(() => {
    const box = boxRef.current;
    const copy = copyRef.current;
    if (!box || !copy) return;
    const ro = new ResizeObserver(() => {
      const w = copy.scrollWidth;
      setLoopWidth(w - GAP > box.clientWidth ? w : 0);
    });
    ro.observe(box);
    ro.observe(copy);
    return () => ro.disconnect();
  }, [items]);

  const moving = loopWidth > 0;

  return (
    <div
      ref={boxRef}
      className="announcement-box flex-1 min-w-0 h-full overflow-hidden"
      style={
        moving
          ? {
              maskImage:
                "linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent)",
            }
          : undefined
      }
    >
      <div
        className={`flex h-full w-max ${moving ? "announcement-track" : ""}`}
        style={
          moving
            ? { animationDuration: `${loopWidth / SPEED}s` }
            : undefined
        }
      >
        <div ref={copyRef} className="flex shrink-0 items-center gap-8 pr-8">
          {items.map((a, i) => (
            <Item key={i} a={a} />
          ))}
        </div>
        {/* 第二份是為了讓跑馬燈頭尾接起來，讀屏與 Tab 都跳過它 */}
        {moving && (
          <div
            aria-hidden="true"
            className="announcement-dup flex shrink-0 items-center gap-8 pr-8"
          >
            {items.map((a, i) => (
              <Item key={i} a={a} tabbable={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ a, tabbable = true }: { a: Announcement; tabbable?: boolean }) {
  const body = (
    <>
      {a.date && (
        <span className="tabular-nums text-[var(--text-muted)]">{a.date}</span>
      )}
      <span>{a.text}</span>
      {a.href && (
        <ChevronRight
          size={13}
          aria-hidden="true"
          className="text-[var(--accent)]"
        />
      )}
    </>
  );
  const cls = "flex items-center gap-1.5 whitespace-nowrap";
  if (!a.href) return <span className={cls}>{body}</span>;

  const linkCls = `${cls} rounded hover:text-[var(--accent)] hover:underline underline-offset-2`;
  const tabIndex = tabbable ? undefined : -1;
  if (a.href.startsWith("/")) {
    return (
      <Link href={a.href} tabIndex={tabIndex} className={linkCls}>
        {body}
      </Link>
    );
  }
  return (
    <a
      href={a.href}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={tabIndex}
      className={linkCls}
    >
      {body}
    </a>
  );
}
