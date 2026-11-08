"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const MOBILE = 4;
const DESKTOP = 8;

/**
 * 出沒地圖這種一長串的 chip：先顯示幾個（手機 4、lg 以上 8），按「顯示全部 N 張」攤開。
 * 收起來的那些只是 display:none，仍然在伺服器輸出的 HTML 裡（完整頁面要給爬蟲看）。
 * 換一隻怪要重新收起來：呼叫端用 key 換掉整個元件。
 */
export function ShowMore({ items, unit }: { items: ReactNode[]; unit: string }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <>
      <ul id={listId} className="flex flex-wrap gap-1.5">
        {items.map((node, i) => (
          <li
            key={i}
            className={open || i < MOBILE ? "flex" : i < DESKTOP ? "hidden lg:flex" : "hidden"}
          >
            {node}
          </li>
        ))}
      </ul>
      {items.length > MOBILE && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className={`cursor-pointer inline-flex h-10 items-center gap-1.5 self-start rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-[13px] font-medium text-[var(--accent-text)] transition-colors hover:border-[var(--accent)] lg:h-9 ${
            items.length > DESKTOP ? "" : "lg:hidden"
          }`}
        >
          {open ? "收合" : `顯示全部 ${items.length} ${unit}`}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </>
  );
}
