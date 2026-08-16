import Link from "next/link";
import { Search, Map as MapIcon, ArrowRight } from "lucide-react";

const FAQ: { q: string; a: string }[] = [
  {
    q: "網站主要用途？",
    a: "目的是想將自己平常在遊戲中會使用到的功能整合在一起，像是掉落查詢、地圖位置、時裝搭配等等，也順便分享給其他玩家。",
  },
  {
    q: "掉落資料來源？",
    a: "從遊戲用戶端拆包出的圖鑑資料整理而成，涵蓋每隻怪物掉落哪些道具、出沒在哪些地圖，但要特別注意，一定會與實際遊戲情況有出入，僅供參考。",
  },
  {
    q: "網站有問題要去哪裡回報？",
    a: "若有問題都可以在巴哈討論區直接回報，感謝！",
  },
];

export default function MinimalHome() {
  return (
    <div className="max-w-2xl space-y-10 m-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          楓探 Maple Detective
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          新楓之谷經典版工具站，資料來自遊戲用戶端拆包整理，與實際版本一定有差異，本站僅供參考。
        </p>
      </div>

      <form action="/minimal/monsters" method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <label htmlFor="home-search" className="sr-only">
            搜尋怪物 / 道具 / 地圖
          </label>
          <input
            id="home-search"
            name="q"
            placeholder="搜尋怪物 / 道具 / 地圖"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer shrink-0 rounded-full px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          查詢
        </button>
      </form>

      {/* <Link
        href="/minimal/map"
        className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
          <MapIcon size={18} style={{ color: "var(--accent)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">地圖導覽</div>
          <div className="text-xs text-[var(--text-muted)]">
            找地圖位置、看出沒怪物
          </div>
        </div>
        <ArrowRight
          size={16}
          className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
        />
      </Link> */}

      <div>
        <h2 className="text-sm font-semibold text-[var(--text-muted)]">
          常見問題
        </h2>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="px-4 py-3.5">
              <div className="text-sm font-medium">{q}</div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                {a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
