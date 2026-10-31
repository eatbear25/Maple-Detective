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
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { navTree, navItems, isNavGroup, navHref, type NavItem } from "@/nav";
import { DetectivePenguin } from "./detective-penguin";

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
 * 2026-09-07 從 8 張磁磚的磁磚牆改成「上半螢幕只有搜尋，工具降級成文字清單」。
 * 2026-10-31 照站長的設計稿（方案 A）再改一次，骨架不變、加了門面：
 *   主視覺＝左邊標題＋搜尋框＋三個常用 chip、右邊偵探企鵝（點點底紋整條滿版），
 *   底下「所有工具」每列一個圖示方塊＋名稱＋一句說明。
 *   - lg（1024px）以下用手機版面（標題與企鵝並排、搜尋框接在下面）。設計稿寫 768px
 *     就換，但桌機版面在 768–1023px 之間企鵝欄會被擠到搜尋框下面、靠左擺，所以延到 lg。
 *   - 不放「最近更新」區塊，沿用全站公告列。
 *
 * 刻意不做的事（原型階段試過又拿掉）：
 *   1. 工具名旁邊標 GA 觸及率——那是挑版型用的註記，長得卻像 UI，
 *      而且只有四頁有數據，其餘七個會被誤讀成「沒人用」。
 *      （改成搜尋框底下的「常用」chip，見 TOOL_META 的 hot）
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
 * hot = 放進搜尋框底下的「常用」chip（站長指定，2026-10-17：
 * 怪物掉落／時裝搭配／BOSS 計時器），順序跟選單一樣。
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
          className="text-[var(--accent-text)] hover:underline"
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
  const hot = navItems.filter((i) => i.enabled && TOOL_META[i.key]?.hot);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />

      <section className="home-hero border-b border-[var(--border)]">
        {/* 手機版是兩欄格線：標題｜企鵝 一列、說明＋搜尋＋chip 跨兩欄接在下面。
            桌機版改成左右兩欄的 flex，左欄外層從 contents 變回 block，把標題跟搜尋包在一起 */}
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-7 sm:px-6 lg:flex lg:gap-12 lg:pb-[52px] lg:pt-14">
          <div className="contents lg:block lg:min-w-0 lg:flex-1">
            <div className="col-start-1 row-start-1 flex min-w-0 flex-col items-start">
              <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-[var(--accent-soft)] px-2.5 text-xs font-medium text-[var(--accent-text)] lg:h-7 lg:px-3 lg:text-[13px]">
                新楓之谷經典版工具箱
              </span>
              <h1 className="mt-3 flex flex-col text-[40px] font-bold leading-[1.1] tracking-[0.02em] lg:mt-[18px] lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-3.5 lg:gap-y-1 lg:text-[56px]">
                楓探
                <span className="mt-1 text-xs font-medium tracking-[0.08em] text-[var(--text-muted)] lg:mt-0 lg:text-base">
                  MAPLE DETECTIVE
                </span>
              </h1>
            </div>

            <div className="col-span-2 row-start-2">
              <p className="mt-4 text-[15px] leading-[1.7] text-[var(--text-muted)] text-pretty lg:mt-3.5 lg:text-[17px]">
                查怪物掉落、道具來源、出沒地圖
              </p>

              <form
                action="/monsters"
                method="get"
                role="search"
                className="mt-4 w-full lg:mt-7 lg:max-w-[560px]"
              >
                <label htmlFor="home-search" className="sr-only">
                  搜尋怪物、道具或地圖
                </label>
                {/* 膠囊形：跟底下的常用 chip、怪物掉落頁的搜尋框同一種形狀（設計稿原本是 14px 圓角） */}
                <div className="flex h-[52px] items-center gap-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] pl-5 pr-1.5 shadow-[0_1px_2px_rgba(33,31,27,0.04),0_10px_28px_-14px_rgba(33,31,27,0.18)] transition-colors focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_30%,transparent)] lg:h-14 lg:gap-3 lg:pl-6 lg:pr-2">
                  <Search
                    size={20}
                    aria-hidden
                    className="shrink-0 text-[var(--text-muted)]"
                  />
                  {/* 光暈由外框的 focus-within 畫，輸入框自己的關掉，不然框裡會再套一圈。
                      要加 !：globals.css 的全站 :focus-visible 沒放在 layer 裡，一般的 utility 蓋不過它。
                      瀏覽器原生的清除叉叉也藏掉，那個位置改放送出按鈕 */}
                  <input
                    id="home-search"
                    name="q"
                    type="search"
                    enterKeyHint="search"
                    placeholder="搜尋怪物 / 道具 / 地圖"
                    autoComplete="off"
                    className="peer h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-muted)] focus-visible:shadow-none! [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {/* 打了字才出現（placeholder 還在＝框是空的），不然只能按 Enter 送出。
                      純 CSS 判斷，首頁不用為了這顆按鈕變成 client 元件。
                      只畫箭頭不畫底色；點擊區仍是 40px 的圓，hover 時箭頭往右滑一點
                      （開了「減少動態效果」就不動） */}
                  <button
                    type="submit"
                    aria-label="搜尋"
                    className="group grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--accent-text)] peer-placeholder-shown:hidden"
                  >
                    {/* 自己畫的箭頭：lucide 的 ArrowRight 線段太短（14），拉長到 17、頭縮成 6 */}
                    <svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover:translate-x-1"
                    >
                      <path d="M3 12h17" />
                      <path d="m14 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </form>

              <div className="mt-3.5 flex flex-wrap items-center gap-2 lg:mt-4">
                <span className="mr-1 hidden text-[13px] text-[var(--text-muted)] lg:inline">
                  常用
                </span>
                {hot.map((item) => {
                  const { icon: Icon } = metaOf(item);
                  return (
                    <Link
                      key={item.key}
                      href={navHref(item.path)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)] lg:h-9"
                    >
                      <Icon
                        size={15}
                        aria-hidden
                        className="text-[var(--accent)]"
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 企鵝：手機 2 倍（122px）、桌機 3 倍（183px），只能整數倍 */}
          <div className="col-start-2 row-start-1 flex justify-center lg:w-[360px] lg:shrink-0">
            <div className="relative h-[150px] w-32 lg:h-[300px] lg:w-[340px]">
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] lg:size-64"
              />
              <div
                aria-hidden
                className="absolute bottom-2 left-1/2 h-2.5 w-[92px] -translate-x-1/2 rounded-[50%] bg-black/10 dark:bg-black/40 lg:bottom-[38px] lg:h-3.5 lg:w-[150px]"
              />
              <DetectivePenguin className="absolute bottom-3 left-1/2 h-auto w-[122px] max-w-none -translate-x-1/2 lg:bottom-11 lg:w-[183px]" />
              <div className="absolute left-0 top-[18px] hidden rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-medium shadow-[0_6px_18px_-10px_rgba(33,31,27,0.25)] lg:block">
                今天要查什麼？
                <span
                  aria-hidden
                  className="absolute -bottom-[7px] right-[26px] size-3 rotate-45 border-b border-r border-[var(--border-strong)] bg-[var(--surface)]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="home-all"
        className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:pb-[72px] lg:pt-12"
      >
        <h2 id="home-all" className="text-lg font-bold lg:text-xl">
          所有工具
        </h2>
        <div className="mt-6 grid items-start gap-6 md:mt-5 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] md:gap-x-7 md:gap-y-8">
          {sections.map((s) => (
            <div key={s.id}>
              <h3 className="mb-1 border-b border-[var(--border)] pb-2 text-[13px] font-bold tracking-[0.04em] text-[var(--text-muted)] md:mb-2 md:pb-2.5">
                {s.title}
              </h3>
              <ul className="space-y-0.5">
                {s.items.map((item) => (
                  <li key={item.key}>
                    <ToolLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

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
    </>
  );
}

function ToolLink({ item }: { item: NavItem }) {
  const { label, desc, icon: Icon } = metaOf(item);

  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
        <Icon size={18} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-medium">
          {label ?? item.label}
          {!item.enabled && (
            <span className="ml-1.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--text-muted)]">
              籌備中
            </span>
          )}
        </span>
        {desc && (
          <span className="text-[13px] leading-normal text-[var(--text-muted)]">
            {desc}
          </span>
        )}
      </span>
    </>
  );

  // 手機每列至少 60px 高好點；左右各外推 10px，hover 底色比文字寬一圈但文字仍對齊段落標題
  const className =
    "-mx-2.5 flex min-h-[60px] items-center gap-3 rounded-[10px] px-2.5 py-2 md:min-h-14";

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
