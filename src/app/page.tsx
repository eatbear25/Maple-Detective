import { ReactNode } from "react";
import { HoverPrefetchLink as Link } from "@/app/hover-prefetch-link";
import {
  Search,
  ChevronDown,
  Timer,
  Map as MapIcon,
  ScrollText,
  Sparkles,
  Store,
  Shirt,
  Target,
  MoonStar,
  ListChecks,
  TowerControl,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { navTree, isNavGroup, navHref, type NavItem } from "@/nav";

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
 * 首頁是走廊，不是房間。
 *
 * GA（2026-08-23）：觸及率 97.87%，停留 13 秒——幾乎每個人都會經過，但沒有人
 * 停下來看；而 76.6% 的人要去的是怪物掉落，那本來就是一個搜尋框。
 *
 * 原本是 8 張磁磚的磁磚牆，工具長到 11 個之後整面牆佔掉一整個螢幕卻沒人在看。
 * 2026-09-07 做了四版原型（分組磁磚牆／搜尋優先／主力放大＋側欄／依動作分組，
 * 留在 prototype/home-redesign-2 分支）比過之後改成現在這樣：
 *   上半螢幕只有搜尋，工具全部降級成一份四欄的文字清單。
 *
 * 刻意不做的兩件事（原型階段試過又拿掉）：
 *   1. 工具名旁邊標 GA 觸及率——那是挑版型用的註記，長得卻像 UI，
 *      而且只有四頁有數據，其餘七個會被誤讀成「沒人用」。
 *      （2026-10-17 改成只標「常用」不標數字，見 TOOL_META 的 hot）
 *   2. 搜尋框下面放「試試：嫩寶／綠水靈…」的範例查詢
 */

/**
 * 清單的分段直接吃 nav.ts 的 navTree：每個 NavGroup 就是一段，成員跟著它走，
 * 所以在 nav.ts 加一個工具，首頁會自己長出來（跟舊版磁磚牆一樣的性質，別退化成
 * 寫死的 key 清單）。兩個頂層單項在 nav 上沒有群組，用下面這張表指定落點。
 */
const TOP_LEVEL_SECTION: Record<string, string> = {
  monsters: "lookup",
  "boss-timer": "track",
};

/**
 * 段落標題與順序。刻意跟 nav 的群組標籤不同：nav 在一條橫列上，字要短
 *（「查詢」「組隊」）；首頁是段落小標，可以講清楚一點。
 * "other" 是安全網——新增的頂層工具沒登記到 TOP_LEVEL_SECTION 時會掉進來，
 * 不會從畫面上無聲消失。
 */
const SECTIONS: { id: string; title: string }[] = [
  { id: "lookup", title: "查資料" },
  { id: "simulators", title: "模擬器" },
  { id: "party", title: "組隊任務" },
  { id: "track", title: "追蹤" },
  { id: "other", title: "其他" },
];

function buildSections() {
  const bucket = new Map<string, NavItem[]>();
  const push = (id: string, item: NavItem) => {
    const list = bucket.get(id) ?? [];
    list.push(item);
    bucket.set(id, list);
  };

  for (const node of navTree) {
    if (isNavGroup(node)) {
      for (const item of node.items) push(node.key, item);
    } else {
      push(TOP_LEVEL_SECTION[node.key] ?? "other", node);
    }
  }

  return SECTIONS.map((s) => ({ ...s, items: bucket.get(s.id) ?? [] })).filter(
    (s) => s.items.length > 0,
  );
}

/**
 * 每個工具的一句話說明與圖示。label 是選填的覆寫，沒寫就用選單的標籤——
 * 地圖／技能／任務在選單裡有群組小標撐著才能用短標籤，單獨列出來會太光溜。
 * 這份表沒補到的工具會退回沒有說明的陽春列，不會憑空消失。
 *
 * 圖示與 site-shell.tsx 的 NAV_ICONS 是兩份（那份還要吃 NavGroup 的 key），
 * 新增工具兩邊都要加。
 *
 * hot = 名稱旁掛「常用」標記，給比較多人用的工具（站長指定，2026-10-17：
 * 怪物掉落／時裝搭配／BOSS 計時器）。只標有沒有、不標數字。
 */
const TOOL_META: Record<
  string,
  { label?: string; desc: string; icon: LucideIcon; hot?: boolean }
> = {
  monsters: { desc: "查怪物掉落物，包含未來視", icon: Search, hot: true },
  map: {
    label: "地圖導覽",
    desc: "在世界地圖上找位置與出沒怪物",
    icon: MapIcon,
  },
  skills: {
    label: "技能查詢",
    desc: "各職業技能與每一級的數值",
    icon: Sparkles,
  },
  quests: { label: "任務查詢", desc: "任務需求、獎勵查詢", icon: ScrollText },
  merchant: { desc: "用官方機率表模擬刷新貨架", icon: Store },
  fashion: {
    desc: "紙娃娃試穿，包含客戶端未加入點裝",
    icon: Shirt,
    hot: true,
  },
  "skill-build": { desc: "1～3 轉 SP 怎麼分配的試算", icon: Target },
  "boss-timer": {
    desc: "記下擊殺時間，自動算下次重生",
    icon: Timer,
    hot: true,
  },
  "moon-bunny": { desc: "第一階段種子放置位置", icon: MoonStar },
  "first-time-together": { desc: "第一階段克魯特題庫", icon: ListChecks },
  "tower-of-goddess": {
    desc: "唱盤對照、封印房站位、倉庫擊殺順序",
    icon: TowerControl,
  },
};

const FALLBACK_META = { desc: "", icon: Search };
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

export default function Home() {
  const sections = buildSections();

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />

      {/* 上半螢幕只有一件事 */}
      <div className="flex flex-col items-center pt-10 text-center sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">楓探</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          新楓之谷經典版工具箱 · 查怪物掉落、道具來源、地圖與任務
        </p>
        <form
          action="/monsters"
          method="get"
          className="relative mt-7 w-full max-w-2xl"
        >
          <Search
            size={20}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <label htmlFor="home-search" className="sr-only">
            搜尋怪物 / 道具 / 地圖
          </label>
          <input
            id="home-search"
            name="q"
            placeholder="搜尋怪物 / 道具 / 地圖"
            autoComplete="off"
            className="h-14 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-14 pr-5 text-base outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
        </form>
      </div>

      {/* 工具全部平鋪成文字清單，四欄，一眼看完 */}
      <div className="grid gap-x-8 gap-y-7 border-t border-[var(--border)] pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <section key={s.id}>
            <h2 className="text-xs font-semibold tracking-wide text-[var(--text-muted)]">
              {s.title}
            </h2>
            <ul className="mt-2 space-y-0.5">
              {s.items.map((item) => (
                <li key={item.key}>
                  <ToolLink item={item} />
                </li>
              ))}
            </ul>
          </section>
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

function ToolLink({ item }: { item: NavItem }) {
  const { label, desc, icon: Icon, hot } = metaOf(item);

  const inner = (
    <>
      <Icon
        size={15}
        className="mt-0.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="text-sm font-medium">
          {label ?? item.label}
          {hot && item.enabled && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-[var(--accent)]/40 px-1.5 py-px align-[1px] text-[10px] font-semibold text-[var(--accent)]">
              <Flame size={10} aria-hidden />
              常用
            </span>
          )}
          {!item.enabled && (
            <span className="ml-1.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--text-muted)]">
              籌備中
            </span>
          )}
        </span>
        {desc && (
          <span className="block text-xs leading-snug text-[var(--text-muted)]">
            {desc}
          </span>
        )}
      </span>
    </>
  );

  const className = "group flex items-start gap-2 rounded-md px-2 py-1.5";

  if (!item.enabled) {
    return <div className={`${className} opacity-50`}>{inner}</div>;
  }
  return (
    <Link
      href={navHref(item.path)}
      className={`${className} transition-colors hover:bg-[var(--accent-soft)]`}
    >
      {inner}
    </Link>
  );
}
