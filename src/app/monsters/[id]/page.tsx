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
import { Telescope, Crown, ArrowLeft, Search } from "lucide-react";
import {
  monsters,
  itemName,
  mapInfo,
  futureMapInfo,
  mobIconSrc,
  itemIconSrc,
  type DropMonster,
} from "@/data/drops";
import { GameIcon } from "../game-icon";
import { StatsPanel, ElemPanel } from "../panels";

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
    .map((mid) => ({ id: mid, name: mapName(mid) }))
    .filter((x): x is { id: number; name: string } => !!x.name);

  return (
    <div className="space-y-6">
      <Link
        href="/monsters"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)]"
      >
        <ArrowLeft size={15} />
        怪物掉落查詢
      </Link>

      <header className="flex items-start gap-4">
        <GameIcon
          src={mobIconSrc(m.id)}
          alt={m.name}
          fallback="👾"
          className="h-16 w-16 shrink-0"
        />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="break-words">{m.name}</span>
            {m.stats.boss ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-text)]">
                <Crown size={12} />
                BOSS
              </span>
            ) : null}
            {!m.released && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                <Telescope size={12} />
                未實裝
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {m.level != null ? `Lv.${m.level}` : "等級不明"} · 掉落{" "}
            {m.drops.length + m.futureDrops.length} 種道具 · 出沒{" "}
            {m.maps.length} 張地圖 · #{m.id}
          </p>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-semibold">怪物數值</h2>
        <StatsPanel stats={m.stats} />
        <ElemPanel stats={m.stats} />
        {Object.keys(m.stats).length === 0 && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            這隻怪不在客戶端的數值表裡，只有圖鑑記錄。
          </p>
        )}
      </section>

      <DropSection
        title={`${m.name} 的掉落物`}
        ids={m.drops}
        empty={
          m.futureDrops.length > 0
            ? "圖鑑記錄的掉落物目前版本都還沒開放，見下方未實裝掉落。"
            : "遊戲內圖鑑沒有記錄這隻怪的掉落物。"
        }
      />

      {m.futureDrops.length > 0 && (
        <DropSection
          title="未實裝掉落（未來視）"
          ids={m.futureDrops}
          note="這些道具在客戶端資料裡掉，但目前版本還沒實裝。"
        />
      )}

      <section>
        <h2 className="text-sm font-semibold">出沒地圖</h2>
        {namedMaps.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            查不到這隻怪的出沒地圖名稱。
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {namedMaps.map((mp) => (
              <li key={mp.id}>
                <Link
                  href={`/monsters?q=${encodeURIComponent(mp.name)}`}
                  className="inline-block rounded-full border border-[var(--border)] px-3 py-1 text-xs hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
                >
                  {mp.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="border-t border-[var(--border)] pt-5">
        <Link
          href={`/monsters?id=${m.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent-text)] hover:brightness-95"
        >
          <Search size={15} />
          在查詢工具中開啟（看世界地圖位置、篩選其他怪物）
        </Link>
      </div>

      <RelatedMonsters monster={m} />
    </div>
  );
}

function DropSection({
  title,
  ids,
  empty,
  note,
}: {
  title: string;
  ids: number[];
  empty?: string;
  note?: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-[var(--text-muted)]">{note}</p>}
      {ids.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map((iid) => (
            <li key={iid}>
              <Link
                href={`/items/${iid}`}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2 hover:border-[var(--accent)]"
              >
                <GameIcon
                  src={itemIconSrc(iid)}
                  alt={itemName(iid)}
                  fallback="📦"
                  className="h-8 w-8 shrink-0"
                />
                <span className="min-w-0 break-words text-sm">
                  {itemName(iid)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <section>
      <h2 className="text-sm font-semibold">同區域出沒的其他怪物</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {related.map((o) => (
          <li key={o.id}>
            <Link
              href={`/monsters/${o.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] py-1 pl-1.5 pr-3 text-xs hover:border-[var(--accent)]"
            >
              <GameIcon
                src={mobIconSrc(o.id)}
                alt={o.name}
                fallback="👾"
                className="h-5 w-5 shrink-0"
              />
              {o.name}
              {o.level != null && (
                <span className="text-[var(--text-muted)]">Lv.{o.level}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
