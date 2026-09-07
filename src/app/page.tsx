import { ReactNode } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  Timer,
  Map as MapIcon,
  ScrollText,
  Sparkles,
  Dices,
  Shirt,
  Target,
  MoonStar,
  ListChecks,
  TowerControl,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { navItems, navHref, type NavItem } from "@/nav";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * WebSite 結構化資料。SearchAction 指的就是下面那個 <form action="/monsters">，
 * 讓 Google 有機會在搜尋結果直接附一個站內搜尋框（sitelinks searchbox）。
 * 沒有做 FAQPage：這頁的 FAQ 常數目前整段被註解掉，畫面上沒有的東西不能上 schema。
 */
const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "楓探",
  alternateName: "楓探 | 新楓之谷：經典版工具箱",
  url: "https://maple-detective.vercel.app",
  inLanguage: "zh-Hant-TW",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate:
        "https://maple-detective.vercel.app/monsters?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

/**
 * 首頁的工作是「一次把站上有什麼攤在眼前」：功能已經十一個，
 * 首頁若只放一個搜尋框，等於只通往怪物掉落、其餘的完全沒被提到。
 *
 * 版面是磁磚牆，但刻意壓掉三種噪音（做過兩輪原型才收斂成這樣，
 * 原型留在 prototype/home-redesign 分支）：
 *   1. 沒有區段小標與分隔線 — 分組改用排列順序表達（前兩格是釘選的高頻入口，
 *      其餘依 查資料 → 模擬器 → 組隊 排）。原本八張卡剛好排成完整的 4×2，
 *      2026-09-07 併入組隊三個工具後變成 11 張、末排 3 張。
 *      要避免的是「4／3／1」那種末排只剩一張的參差，4／4／3 還可以接受；
 *      之後再加工具時湊到 12 張就會回到完整的 4×3
 *   2. 卡片平常沒有外框 — 只有很淡的底色，邊框 hover 才浮出來
 *   3. 圖示不套底色色塊 — 避免「框裡面還有一個框」
 */
type HomeGroup = "lookup" | "sim" | "party" | "track";

/** 磁磚的排列順序。沒有小標，靠這個順序讓同類的排在一起。 */
const GROUP_ORDER: Record<HomeGroup, number> = {
  lookup: 0,
  sim: 1,
  party: 2,
  track: 3,
};

/**
 * 釘在最前面的兩格 ＝ nav.ts 的頂層兩項，理由跟那裡一樣：
 * BOSS 計時器觸及率第 2（35.5%）但停留只有 22 秒（開啟→掃一眼→關掉），
 * 任何多餘的摩擦都佔體感時間很大一塊；而磁磚在手機（<640px）是單欄直排，
 * 照 GROUP_ORDER 排的話它會落在第 8 格，等於要滑過 7 張卡才看得到。
 *
 * 其餘六格維持語意分組。之後要依 GA 重排整面牆時請注意：2026-08-23 那份 GA
 * 只涵蓋 monsters / boss-timer / fashion / map 四頁，quests / skills /
 * skill-build / gacha 當時還沒上線，八格有四格沒數據，不足以拿來排序。
 */
const PINNED = ["monsters", "boss-timer"];

/**
 * 卡片的圖示、說明與分組。
 * 分組刻意跟主選單的分組不同：選單依「點擊成本 ÷ 停留時間」排（見 nav.ts），
 * 首頁則依「這個工具在幫你做什麼」排，所以 BOSS 計時器在這裡自成一類。
 * 清單本身是從 navItems 推出來的，新增工具只要在 nav.ts 加，首頁就會跟著長出卡片；
 * 這份表沒補到的話會退回沒有說明的陽春卡片，不會憑空消失。
 *
 * label 是選填的覆寫，沒寫就用選單的標籤。地圖／技能／任務三個在選單裡有「查詢」
 * 群組小標撐著才能用短標籤，攤在卡片牆上會太光溜，所以補成跟各頁 h1 一致的全名。
 */
const TOOL_META: Record<
  string,
  { label?: string; desc: string; group: HomeGroup; icon: LucideIcon }
> = {
  monsters: {
    desc: "查詢怪物掉落物，包含未來視",
    group: "lookup",
    icon: Search,
  },
  map: {
    label: "地圖導覽",
    desc: "在世界地圖上找位置與出沒怪物",
    group: "lookup",
    icon: MapIcon,
  },
  skills: {
    label: "技能查詢",
    desc: "各職業技能與每一級的數值",
    group: "lookup",
    icon: Sparkles,
  },
  quests: {
    label: "任務查詢",
    desc: "任務需求、獎勵查詢",
    group: "lookup",
    icon: ScrollText,
  },
  gacha: { desc: "用官方機率表模擬抽獎", group: "sim", icon: Dices },
  fashion: {
    desc: "紙娃娃試穿，包含客戶端未加入點裝",
    group: "sim",
    icon: Shirt,
  },
  "skill-build": {
    desc: "1、2 轉 SP 怎麼分配的試算",
    group: "sim",
    icon: Target,
  },
  "moon-bunny": {
    desc: "第一階段種子放置位置",
    group: "party",
    icon: MoonStar,
  },
  "first-time-together": {
    desc: "第一階段克魯特題庫",
    group: "party",
    icon: ListChecks,
  },
  "tower-of-goddess": {
    desc: "唱盤對照、封印房站位、倉庫擊殺順序",
    group: "party",
    icon: TowerControl,
  },
  "boss-timer": {
    desc: "記下擊殺時間，自動算下次重生",
    group: "track",
    icon: Timer,
  },
};

const FALLBACK_META = { desc: "", group: "lookup" as HomeGroup, icon: Search };

const metaOf = (i: NavItem) => TOOL_META[i.key] ?? FALLBACK_META;

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "網站主要用途？",
    a: "目的是想將自己平常在遊戲中會使用到的功能整合在一起，也順便分享給其他玩家。",
  },
  {
    q: "掉落資料來源？",
    a: "從遊戲用戶端拆包出的圖鑑資料整理而成，涵蓋每隻怪物掉落哪些道具、出沒在哪些地圖，與實際遊戲情況可能有出入，僅供參考。",
  },
  {
    q: "BOSS 重生時間來源？",
    a: "是依據社群玩家回報的時間統計而來，與實際重生時間可能有誤差，若有更正確的資訊歡迎回報，謝謝！",
  },
  {
    q: "網站有問題要去哪裡回報？",
    a: (
      <>
        若有問題都可以在
        <a
          href="https://forum.gamer.com.tw/Co.php?bsn=85994&sn=5193"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          巴哈討論區
        </a>
        直接回報，謝謝！
      </>
    ),
  },
];

function ToolTile({ item }: { item: NavItem }) {
  const { label, desc, icon: Icon } = metaOf(item);

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon size={20} style={{ color: "var(--accent)" }} />
        {!item.enabled && (
          <span className="ml-auto rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
            籌備中
          </span>
        )}
      </div>
      <div className="mt-3 text-[15px] font-semibold leading-snug">
        {label ?? item.label}
      </div>
      {desc && (
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          {desc}
        </p>
      )}
    </>
  );

  // 用 ring 而不是 border：hover 時不會因為多一圈邊框而讓整塊位移 1px
  const className =
    "flex flex-col rounded-xl bg-[var(--surface)] p-4 transition-shadow";

  if (!item.enabled) {
    return <div className={`${className} opacity-50`}>{inner}</div>;
  }
  return (
    <Link
      href={navHref(item.path)}
      className={`${className} ring-1 ring-transparent hover:ring-[var(--accent)]`}
    >
      {inner}
    </Link>
  );
}

export default function Home() {
  const tools = [...navItems].sort((a, b) => {
    const pa = PINNED.indexOf(a.key);
    const pb = PINNED.indexOf(b.key);
    if (pa !== -1 || pb !== -1) {
      return (pa === -1 ? PINNED.length : pa) - (pb === -1 ? PINNED.length : pb);
    }
    return GROUP_ORDER[metaOf(a).group] - GROUP_ORDER[metaOf(b).group];
  });

  return (
    <div className="space-y-9">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />
      {/* 標題與搜尋同一排：搜尋是附屬工具，不是主角 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">楓探 工具箱</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            新楓之谷經典版 ·
            資料來自遊戲用戶端拆包整理，與實際版本有差異，僅供參考
          </p>
        </div>
        <form action="/monsters" method="get" className="relative sm:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <label htmlFor="home-search" className="sr-only">
            搜尋怪物 / 道具 / 地圖
          </label>
          <input
            id="home-search"
            name="q"
            placeholder="搜尋怪物 / 道具 / 地圖"
            autoComplete="off"
            className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((i) => (
          <ToolTile key={i.key} item={i} />
        ))}
      </div>

      {/* 每一則各自收合：整包一起收的話，想看第三題得連前兩題一起攤開 */}
      {/* <section>
        <h2 className="text-xs font-semibold tracking-wide text-[var(--text-muted)]">
          常見問題
        </h2>
        <div className="mt-1 divide-y divide-[var(--border)]">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium">
                {q}
                <ChevronDown
                  size={15}
                  className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-3.5 pr-8 text-xs leading-relaxed text-[var(--text-muted)]">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section> */}
    </div>
  );
}
