/**
 * 單一道具的詳情頁，回答「這東西哪裡打／哪裡拿」。
 *
 * 這類查詢（「XX卷軸 哪裡打」）的搜尋量比「某隻怪掉什麼」還大，而站上本來就有
 * 全部的反查資料，只差沒有一個網址承接它。跟 /monsters/[id] 一樣，內容必須全部
 * 出現在 server HTML 裡，不可以塞進 client-only 的分支。
 *
 * 只產生「有來源」的道具（見 data/item-sources.ts）：沒有來源的道具頁面上什麼都
 * 沒有，那種薄頁對整站排名是扣分。
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Telescope, ArrowLeft } from "lucide-react";
import {
  itemName,
  itemInfo,
  itemIconSrc,
  mobIconSrc,
  isFutureItem,
  hasItemName,
  monsters,
  type EquipStats,
} from "@/data/drops";
import { questById } from "@/data/quests";
import { itemSources, sourcedItemIds } from "@/data/item-sources";
import { GameIcon } from "../../monsters/game-icon";
import {
  WEAPON_CATS,
  ARMOR_CATS,
  SPEED_LABELS,
  CLASSES,
  STAT_ROWS,
  Desc,
} from "../../monsters/equip-format";

export const dynamicParams = false;

export function generateStaticParams() {
  return sourcedItemIds
    .filter(hasItemName)
    .map((id) => ({ id: String(id) }));
}

const mobById = (id: string) => monsters.find((m) => m.id === id);

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
  const iid = Number(id);
  if (!Number.isFinite(iid) || !hasItemName(iid)) return {};

  const name = itemName(iid);
  const src = itemSources(iid);
  const mobNames = src.droppedBy
    .map((mid) => mobById(mid)?.name)
    .filter((n): n is string => !!n);
  const questNames = src.rewardedBy
    .map((qid) => questById(qid)?.name)
    .filter((n): n is string => !!n);

  const parts = [`新楓之谷經典版「${name}」的取得方式：`];
  if (mobNames.length) {
    parts.push(`由 ${joinNames(mobNames, 8, "隻怪")} 掉落。`);
  }
  if (questNames.length) {
    parts.push(`任務「${joinNames(questNames, 3, "個任務")}」會給。`);
  }
  if (!mobNames.length && !questNames.length) {
    parts.push("目前查不到掉落或任務來源。");
  }
  if (isFutureItem(iid)) parts.push("（此道具目前版本尚未實裝）");

  const title = `${name} 掉落來源與取得方式`;
  const description = parts.join("").slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/items/${iid}` },
    openGraph: {
      title: `${title} | 楓探`,
      description,
      url: `/items/${iid}`,
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
  const iid = Number(id);
  if (!Number.isFinite(iid) || !hasItemName(iid)) notFound();

  const name = itemName(iid);
  const info = itemInfo(iid);
  const src = itemSources(iid);

  const droppers = src.droppedBy
    .map(mobById)
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const rewardQuests = src.rewardedBy
    .map(questById)
    .filter((q): q is NonNullable<typeof q> => !!q);
  const needQuests = src.requiredBy
    .map(questById)
    .filter((q): q is NonNullable<typeof q> => !!q);

  return (
    <div className="space-y-6">
      <Link
        href="/monsters"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={15} />
        怪物掉落查詢
      </Link>

      <header className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] p-2">
          <GameIcon
            src={itemIconSrc(iid)}
            alt={name}
            fallback="📦"
            className="h-full w-full [image-rendering:pixelated]"
          />
        </div>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="break-words">{name}</span>
            {isFutureItem(iid) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                <Telescope size={12} />
                未實裝
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {droppers.length} 隻怪掉落 · {rewardQuests.length} 個任務會給 · #
            {iid}
          </p>
        </div>
      </header>

      {info?.desc && (
        <section>
          <h2 className="text-sm font-semibold">道具說明</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            <Desc text={info.desc} />
          </p>
        </section>
      )}

      {info?.eq && <EquipSection id={iid} eq={info.eq} />}

      <section>
        <h2 className="text-sm font-semibold">哪些怪會掉「{name}」</h2>
        {droppers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            遊戲內圖鑑沒有記錄哪隻怪會掉這件道具。
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {droppers.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/monsters/${m.id}`}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2 hover:border-[var(--accent)]"
                >
                  <GameIcon
                    src={mobIconSrc(m.id)}
                    alt={m.name}
                    fallback="👾"
                    className="h-8 w-8 shrink-0"
                  />
                  <span className="min-w-0 break-words text-sm">{m.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-[var(--text-muted)]">
                    {m.level != null ? `Lv.${m.level}` : "?"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {droppers.length > 0 && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            掉落機率不在遊戲用戶端裡，這裡只列出「會掉」，沒有機率。
          </p>
        )}
      </section>

      <QuestSection title="哪些任務會給這件道具" quests={rewardQuests} />
      <QuestSection title="哪些任務要繳交這件道具" quests={needQuests} />
    </div>
  );
}

function EquipSection({ id, eq }: { id: number; eq: EquipStats }) {
  const cat = Math.floor(id / 10000);
  const weaponCat = WEAPON_CATS[cat];
  const armorCat = ARMOR_CATS[cat];
  const reqJob = eq.reqJob ?? 0;

  const reqs: [string, number][] = [
    ["裝備等級", eq.reqLevel ?? 0],
    ["需要力量", eq.reqSTR ?? 0],
    ["需要敏捷", eq.reqDEX ?? 0],
    ["需要智力", eq.reqINT ?? 0],
    ["需要幸運", eq.reqLUK ?? 0],
  ];

  return (
    <section>
      <h2 className="text-sm font-semibold">裝備數值</h2>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {reqs.map(([label, v]) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-center"
          >
            <dd className="text-sm font-semibold tabular-nums">{v}</dd>
            <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="text-[var(--text-muted)]">可裝備職業</span>
        {CLASSES.map(([label, bit]) => {
          const usable = reqJob === 0 || (bit !== 0 && (reqJob & bit) !== 0);
          return (
            <span
              key={label}
              className={
                usable
                  ? "rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]"
                  : "rounded-full px-2 py-0.5 text-[var(--text-muted)] opacity-50"
              }
            >
              {label}
            </span>
          );
        })}
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {weaponCat && <StatRow label="武器分類" value={weaponCat} />}
        {armorCat && <StatRow label="裝備分類" value={armorCat} />}
        {eq.attackSpeed !== undefined && (
          <StatRow
            label="攻擊速度"
            value={SPEED_LABELS[eq.attackSpeed] ?? `${eq.attackSpeed}`}
          />
        )}
        {STAT_ROWS.map(([key, label]) => {
          const v = eq[key];
          return v ? (
            <StatRow key={key} label={label} value={v > 0 ? `+${v}` : `${v}`} />
          ) : null;
        })}
        {eq.tuc !== undefined && (
          <StatRow label="可使用捲軸次數" value={eq.tuc} />
        )}
      </ul>
    </section>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <li>
      <span className="text-[var(--text-muted)]">・{label}：</span>
      {value}
    </li>
  );
}

function QuestSection({
  title,
  quests,
}: {
  title: string;
  quests: { id: string; name: string; lv: number }[];
}) {
  if (quests.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {quests.map((q) => (
          <li key={q.id}>
            <Link
              href={`/quests?id=${q.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-xs hover:border-[var(--accent)]"
            >
              {q.name}
              {q.lv > 0 && (
                <span className="text-[var(--text-muted)]">Lv.{q.lv}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
