"use client";

/**
 * 【原型用，不是正式功能】版型切換列。
 *
 * 用 `?variant=` 在同一條路由上切不同版型，選定之後贏的那版要重寫進正式碼、
 * 其餘連同這個檔案一起刪掉。正式建置（production）不會顯示這條列。
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";

export function useVariant(keys: string[]) {
  const params = useSearchParams();
  const v = params.get("variant");
  return keys.includes(v ?? "") ? (v as string) : keys[0];
}

export function PrototypeSwitcher({
  keys,
  labels,
  current,
}: {
  keys: string[];
  labels: Record<string, string>;
  current: string;
}) {
  const router = useRouter();
  const go = (dir: 1 | -1) => {
    const i = keys.indexOf(current);
    const next = keys[(i + dir + keys.length) % keys.length];
    router.replace(`?variant=${next}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-neutral-900 px-2 py-1.5 text-white shadow-xl">
      <FlaskConical size={13} className="mx-1 text-amber-400" />
      <button
        onClick={() => go(-1)}
        aria-label="上一個版型"
        className="cursor-pointer rounded-full p-1 hover:bg-white/10"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-48 text-center text-xs">
        <span className="font-bold text-amber-400">{current}</span>
        <span className="mx-1 opacity-40">·</span>
        {labels[current]}
      </span>
      <button
        onClick={() => go(1)}
        aria-label="下一個版型"
        className="cursor-pointer rounded-full p-1 hover:bg-white/10"
      >
        <ChevronRight size={15} />
      </button>
      <span className="ml-1 mr-1 text-[10px] opacity-40">← →</span>
    </div>
  );
}
