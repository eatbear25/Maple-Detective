import { firstTimeTogetherQuiz } from "@/data/party-quests";
import { itemIconSrc } from "@/data/drops";
import { GameIcon } from "@/app/monsters/game-icon";

/** 超級綠水靈（9300003）掉的通行證，數字就是要交的張數 */
const PASS_ITEM_ID = 4001008;

export const metadata = {
  title: "超綠題庫",
  description: "第一次同行（超級綠水靈）第一階段，克魯特出題的完整題庫與答案。",
};

export default function FirstTimeTogetherPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">超綠題庫</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">第一階段題庫。</p>
      </div>

      {/* 票根造型：左邊固定寬的「票券聯」擺數字，虛線撕線右邊才是題目，
          數字永遠貼著題目、且各卡的題目起點對齊 */}
      <ul className="grid gap-4 sm:grid-cols-2">
        {firstTimeTogetherQuiz.map((q) => (
          <li
            key={q.question}
            className="flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          >
            <div className="flex w-28 shrink-0 items-center justify-center gap-1 border-r border-dashed border-[var(--border)] bg-[var(--accent-soft)] px-3">
              <span className="text-3xl font-bold leading-none tabular-nums text-[var(--accent)]">
                {q.answer}
              </span>
              <span className="text-xs text-[var(--text-muted)]">張</span>
              <GameIcon
                src={itemIconSrc(PASS_ITEM_ID)}
                alt="通行證"
                fallback="🎟️"
                className="ml-0.5 h-5 w-5 shrink-0"
              />
            </div>
            <span className="flex min-w-0 flex-1 items-center px-5 py-5 text-[15px] leading-snug">
              {q.question}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
