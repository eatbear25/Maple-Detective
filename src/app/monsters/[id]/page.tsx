/**
 * 單一怪物的詳情頁。存在的理由是 SEO：查詢頁 /monsters 是一個網址配 343 隻怪，
 * 不可能同時排上「嫩寶掉落」「綠水靈掉什麼」這幾百種長尾查詢，一隻怪一個網址才行。
 *
 * 所以這一頁有兩條硬規則，改動時別破壞：
 *   1. 內容全部要在 server HTML 裡 —— 不可以把掉落清單塞進 Suspense 或 client-only
 *      的分支。查詢頁就是踩到這個坑（整頁包在 <Suspense> + useSearchParams），
 *      預先產生的 HTML 只有骨架，爬蟲一個怪名都看不到。
 *   2. metadata 的 description 要塞真的掉落物名稱，那是被搜尋比對到的內容。
 */
import type { Metadata } from "next";
import { HoverPrefetchLink as Link } from "@/app/hover-prefetch-link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Search, Telescope } from "lucide-react";
import {
  monsters,
  itemName,
  hasItemName,
  mapInfo,
  futureMapInfo,
  mobIconSrc,
  type DropMonster,
} from "@/data/drops";
import { GameIcon } from "../game-icon";
import { MonsterHero, StatsPanel, ElemPanel, DetailSection, DropTileBody } from "../panels";
import { CARD, DROP_GRID, MAP_CHIP, PILL } from "../styles";
import { ShareButton } from "../share-button";
import { ShowMore } from "../show-more";

// 未列在 generateStaticParams 的 id 直接 404，不要在執行期現算一頁出來
export const dynamicParams = false;

export function generateStaticParams() {
  return monsters.map((m) => ({ id: m.id }));
}

const byId = (id: string) => monsters.find((m) => m.id === id);

/** 地圖名稱（實裝的優先，未實裝的退到 maplestory.io 補充名） */
const mapName = (id: number) =>
  mapInfo(id)?.name ?? futureMapInfo(id)?.name ?? null;

/** 把清單接成「甲、乙、丙」，超過 max 筆就加「等 N 種」 */
function joinNames(names: string[], max: number, unit: string) {
  const head = names.slice(0, max).join("、");
  return names.length > max ? `${head} 等 ${names.length} ${unit}` : head;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const m = byId(id);
  if (!m) return {};

  const dropNames = [...m.drops, ...m.futureDrops].map(itemName);
  const mapNames = m.maps.map(mapName).filter((n): n is string => !!n);
  const lv = m.level != null ? `Lv.${m.level}` : "等級不明";

  const parts = [`新楓之谷經典版「${m.name}」（${lv}）`];
  parts.push(
    dropNames.length
      ? `掉落 ${dropNames.length} 種道具：${joinNames(dropNames, 8, "種")}。`
      : "圖鑑沒有記錄到掉落物。",
  );
  if (mapNames.length) {
    parts.push(`出沒地圖：${joinNames(mapNames, 6, "張")}。`);
  }
  if (m.stats.maxHP != null) {
    parts.push(`HP ${m.stats.maxHP.toLocaleString()}`);
    if (m.stats.exp != null) parts.push(`、經驗值 ${m.stats.exp}`);
    parts.push("。");
  }
  if (!m.released) parts.push("（此怪目前版本尚未實裝）");

  const title = `${m.name} 掉落物與出沒地圖`;
  const description = parts.join("").slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/monsters/${m.id}` },
    openGraph: {
      title: `${title} | 楓探`,
      description,
      url: `/monsters/${m.id}`,
      type: "article",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const m = byId(id);
  if (!m) notFound();

  const namedMaps = m.maps
    .map((mid) => ({ id: mid, info: mapInfo(mid) ?? futureMapInfo(mid) }))
    .filter((x) => !!x.info)
    .map(({ id: mid, info }) => ({
      id: mid,
      name: info!.name,
      label: info!.street ? `${info!.street}・${info!.name}` : info!.name,
    }));

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav
        aria-label="麵包屑"
        className="hidden items-center gap-1.5 text-[13px] text-[var(--text-muted)] sm:flex"
      >
        <Link href="/" className="hover:text-[var(--accent-text)]">
          首頁
        </Link>
        <ChevronRight size={14} className="opacity-60" />
        <Link href="/monsters" className="hover:text-[var(--accent-text)]">
          怪物掉落
        </Link>
        <ChevronRight size={14} className="opacity-60" />
        <span aria-current="page" className="text-[var(--text)]">
          {m.name}
        </span>
      </nav>
      <Link
        href="/monsters"
        className="-my-2 inline-flex min-h-11 items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] sm:hidden"
      >
        <ChevronLeft size={18} />
        怪物列表
      </Link>

      <article aria-labelledby="monster-name" className={CARD}>
        <MonsterHero
          monster={m}
          heading="h1"
          headingId="monster-name"
          big
          dropCount={m.drops.length + m.futureDrops.length}
          actions={
            <>
              <ShareButton id={m.id} />
              <Link href={`/monsters?id=${m.id}`} className={PILL}>
                <Search size={13} />
                在查詢工具中開啟
              </Link>
            </>
          }
        />

        <div className="px-4 pb-5 sm:px-6">
          <StatsPanel stats={m.stats} />
          <ElemPanel stats={m.stats} />
          {Object.keys(m.stats).length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">
              這隻怪不在客戶端的數值表裡，只有圖鑑記錄。
            </p>
          )}
        </div>

        <DetailSection
          id="drop-h"
          heading="h2"
          title="掉落物"
          count={`${m.drops.length} 種`}
        >
          {m.drops.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              {m.futureDrops.length > 0
                ? "圖鑑記錄的掉落物目前版本都還沒開放，見下方未實裝掉落。"
                : "遊戲內圖鑑沒有記錄這隻怪的掉落物。"}
            </p>
          ) : (
            <DropLinks ids={m.drops} />
          )}
        </DetailSection>

        {m.futureDrops.length > 0 && (
          <DetailSection
            id="future-drop-h"
            heading="h2"
            title={
              <>
                <Telescope size={15} className="text-[var(--text-muted)]" />
                未實裝掉落
              </>
            }
            count={`${m.futureDrops.length} 種`}
            note="這些道具在客戶端資料裡掉，但目前版本還沒實裝。"
          >
            <DropLinks ids={m.futureDrops} future />
          </DetailSection>
        )}

        <DetailSection
          id="map-h"
          heading="h2"
          title="出沒地圖"
          count={`${namedMaps.length} 張`}
        >
          {namedMaps.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              查不到這隻怪的出沒地圖名稱。
            </p>
          ) : (
            <ShowMore
              unit="張"
              items={namedMaps.map((mp) => (
                <Link
                  key={mp.id}
                  href={`/monsters?q=${encodeURIComponent(mp.name)}`}
                  className={m.released ? MAP_CHIP.link : MAP_CHIP.future}
                >
                  {mp.label}
                </Link>
              ))}
            />
          )}
        </DetailSection>

        <RelatedMonsters monster={m} />
      </article>
    </div>
  );
}

/** 掉落物：完整頁面整張卡片就是連到道具頁，右邊的 ↗ 只是裝飾（樣式見 globals.css 的 .drop-arr） */
function DropLinks({ ids, future = false }: { ids: number[]; future?: boolean }) {
  return (
    <ul className={DROP_GRID}>
      {ids.map((iid) => {
        const body = (
          <>
            <DropTileBody id={iid} />
            <ArrowUpRight size={18} strokeWidth={2.25} className="drop-arr" />
          </>
        );
        const cls = `flex h-full min-h-12 items-center gap-2 rounded-[10px] border bg-[var(--surface)] py-1.5 pl-1.5 pr-2.5 sm:gap-2.5 sm:pl-2 ${
          future ? "border-dashed border-[var(--border-strong)] opacity-80" : "border-[var(--border)]"
        }`;
        return (
          <li key={iid}>
            {hasItemName(iid) ? (
              <Link
                href={`/items/${iid}`}
                className={`${cls} transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50`}
              >
                {body}
              </Link>
            ) : (
              <div className={cls}>
                <DropTileBody id={iid} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 同一張地圖上的其他怪。這一段同時是給讀者的「附近還有什麼」與給爬蟲的內鏈——
 * 沒有互相連結的話，343 個新頁面對爬蟲來說是 343 座孤島。
 */
function RelatedMonsters({ monster }: { monster: DropMonster }) {
  const mapSet = new Set(monster.maps);
  const related = monsters
    .filter(
      (o) =>
        o.id !== monster.id &&
        o.released === monster.released &&
        o.maps.some((mid) => mapSet.has(mid)),
    )
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .slice(0, 12);

  if (related.length === 0) return null;
  return (
    <DetailSection id="related-h" heading="h2" title="同區域出沒的其他怪物">
      <ul className="flex flex-wrap gap-1.5 sm:gap-2">
        {related.map((o) => (
          <li key={o.id}>
            <Link
              href={`/monsters/${o.id}`}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] pl-1.5 pr-3.5 text-[13px] transition-colors hover:border-[var(--accent)]"
            >
              <GameIcon
                src={mobIconSrc(o.id)}
                alt=""
                fallback="👾"
                className="h-[34px] w-[34px] shrink-0"
              />
              {o.name}
              {o.level != null && (
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  Lv.{o.level}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
