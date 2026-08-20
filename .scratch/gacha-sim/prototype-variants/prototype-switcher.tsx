"use client";

/* 原型切換列。**只在開發模式顯示**，正式 build 會整個消失，
   所以就算不小心把原型 merge 進 main 也不會出現在使用者面前。
   選定變體之後這個檔案連同 variants/ 一起刪掉。 */

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: { key: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const idx = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const go = (delta: number) => {
      const next = variants[(idx + delta + variants.length) % variants.length];
      const q = new URLSearchParams(params.toString());
      q.set("variant", next.key);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    };
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, variants, params, pathname, router]);

  if (process.env.NODE_ENV === "production") return null;

  const go = (delta: number) => {
    const next = variants[(idx + delta + variants.length) % variants.length];
    const q = new URLSearchParams(params.toString());
    q.set("variant", next.key);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-fuchsia-400 bg-fuchsia-950/95 px-1.5 py-1 font-mono text-fuchsia-100 shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="上一個變體"
        className="grid h-7 w-7 place-items-center rounded-full hover:bg-fuchsia-800"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="px-2 text-xs font-bold tracking-wide">
        原型 {variants[idx].key} — {variants[idx].name}
        <span className="ml-2 opacity-50">←/→</span>
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="下一個變體"
        className="grid h-7 w-7 place-items-center rounded-full hover:bg-fuchsia-800"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
