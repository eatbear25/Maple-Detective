import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { navItems, navHref } from "@/nav";

/** 每個組隊任務的一句話說明，key 對應 nav.ts 的 children key */
const QUEST_BLURB: Record<string, string> = {
  "tower-of-goddess": "休息室唱盤對照、封印房站位解答、倉庫擊殺順序",
};

const quests = navItems.find((i) => i.key === "party")?.children ?? [];

export default function PartyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">組隊工具</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          各組隊任務的關卡小工具
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {quests.map((q) => (
          <Link
            key={q.key}
            href={navHref(q.path)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-colors hover:border-[var(--accent)]"
          >
            <div>
              <div className="font-semibold">{q.label}</div>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                {QUEST_BLURB[q.key]}
              </p>
            </div>
            <ArrowRight
              size={18}
              className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
