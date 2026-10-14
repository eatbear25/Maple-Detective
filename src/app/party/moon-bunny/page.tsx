import type { Metadata } from "next";
import { itemIconSrc } from "@/data/drops";
import {
  moonBunnyMap,
  moonBunnySeeds,
  type MoonBunnySpot,
} from "@/data/moon-bunny";

export const metadata: Metadata = {
  title: "月妙的年糕 迎月花山丘種子圖",
  description:
    "新楓之谷經典版組隊任務「月妙的年糕」第一階段：哪叢草掉哪色種子、六朵迎月花各收哪一色，一張圖看完。",
  alternates: { canonical: "/party/moon-bunny" },
};

const { image, bushes, flowers } = moonBunnyMap;

const ICON_RATIO = 28 / 26; // 種子圖示原始比例，別把它拉扁

/** 要看的世界座標範圍（y 向下為正） */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 一塊畫面：看哪一段、標記多大、哪些草叢／花要標 */
interface MapView {
  key: string;
  rect: Rect;
  /** 標記大小，單位是底圖像素；畫面越窄、縮得越小，就要給越大 */
  seedSize: number;
  flowerSize: number;
  bush: (s: MoonBunnySpot) => boolean;
  flower: boolean;
  label: string;
}

const WHOLE: Rect = {
  x0: -image.originX,
  y0: -image.originY,
  x1: image.width - image.originX,
  y1: image.height - image.originY,
};

// 寬螢幕：整張地圖跟著版面寬度縮放（以前固定 900px，視窗一窄右半邊就被裁掉）。
const WIDE: MapView = {
  key: "whole",
  rect: WHOLE,
  seedSize: 46,
  flowerSize: 72,
  bush: () => true,
  flower: true,
  label: `${moonBunnyMap.mapName}地圖`,
};

// 窄螢幕（玩家常把視窗縮在遊戲旁邊）：整張 1820px 的圖縮到三百多 px 寬，種子
// 只剩芝麻大，所以拆成三塊由上往下排——上方的迎月花，下層草叢從中間切成左右
// 兩半——每塊都佔滿寬度、標記也放大。三塊用的是同一張底圖（SVG viewBox 裁），
// 不多下載。左右兩半等寬（910px），兩邊標記縮放才一致；切在 x=-45，剛好落在
// 中間兩叢草（-101 與 8）之間，草叢各自只標在自己那一半，邊上不會出現半個標記。
const BUSH_SPLIT = -45;
const NARROW: MapView[] = [
  {
    key: "flowers",
    rect: { x0: -610, y0: -840, x1: 260, y1: -170 },
    seedSize: 46,
    flowerSize: 80,
    bush: () => false,
    flower: true,
    label: "迎月花",
  },
  {
    key: "bushes-left",
    rect: { x0: -955, y0: 80, x1: BUSH_SPLIT, y1: 310 },
    seedSize: 64,
    flowerSize: 0,
    bush: (s) => s.x < BUSH_SPLIT,
    flower: false,
    label: "草叢（左半）",
  },
  {
    key: "bushes-right",
    rect: { x0: -100, y0: 80, x1: 810, y1: 310 },
    seedSize: 64,
    flowerSize: 0,
    bush: (s) => s.x >= BUSH_SPLIT,
    flower: false,
    label: "草叢（右半）",
  },
];

/**
 * 種子標記：就是那顆種子本身站在地上，顏色簡稱寫在正上方——跟遊戲裡掉落物的
 * 畫法一致。不加底色框：底圖是夜色土地，框反而搶戲；改用一層深色投影把圖示從
 * 土紋裡拉出來。座標單位是底圖像素（SVG 疊在圖上、共用同一個座標系），顏色
 * 一律寫死不吃主題——它們貼在夜色底圖上，跟著頁面明暗換色反而會看不見。
 */
function Seed({
  spot,
  size,
  filter,
}: {
  spot: MoonBunnySpot;
  size: number;
  filter: string;
}) {
  const seed = moonBunnySeeds[spot.itemId];
  const w = size;
  const h = size * ICON_RATIO;
  const cx = spot.x + image.originX;
  // +12：reactor 座標是碰撞線，草皮畫在它下方約 12px，圖示底部要壓到草土交界
  // 才像「放在地上」，貼齊碰撞線會看起來浮在草上面。
  const base = spot.y + image.originY + 12;
  return (
    <g>
      <image
        href={itemIconSrc(spot.itemId)}
        x={cx - w / 2}
        y={base - h}
        width={w}
        height={h}
        filter={`url(#${filter})`}
      />
      <text
        x={cx}
        y={base - h - size * 0.16}
        textAnchor="middle"
        fontSize={size * 0.7}
        fontWeight={700}
        fill="#FFFFFF"
        stroke="#11131F"
        strokeWidth={size * 0.13}
        paintOrder="stroke"
      >
        {seed.label}
      </text>
    </g>
  );
}

function MapPanel({ view }: { view: MapView }) {
  const { rect } = view;
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const filter = `seed-shadow-${view.key}`;
  return (
    <div className="overflow-hidden rounded-xl">
      <svg
        viewBox={`${rect.x0 + image.originX} ${rect.y0 + image.originY} ${w} ${h}`}
        role="img"
        aria-label={view.label}
        className="block h-auto w-full"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <defs>
          <filter id={filter} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="3"
              floodColor="#05070F"
              floodOpacity="0.9"
            />
          </filter>
        </defs>
        <image
          href={image.src}
          x={0}
          y={0}
          width={image.width}
          height={image.height}
        />
        {bushes.filter(view.bush).map((b, i) => (
          <Seed key={`b${i}`} spot={b} size={view.seedSize} filter={filter} />
        ))}
        {view.flower &&
          flowers.map((f) => (
            <Seed
              key={`f${f.itemId}`}
              spot={f}
              size={view.flowerSize}
              filter={filter}
            />
          ))}
      </svg>
    </div>
  );
}

export default function MoonBunnyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">月妙的年糕</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          第一階段「{moonBunnyMap.mapName}」：打草撿種子，放到<b>同色</b>
          的迎月花上
        </p>
      </div>

      <div className="hidden md:block">
        <MapPanel view={WIDE} />
      </div>

      <div className="space-y-4 md:hidden">
        {NARROW.map((view) => (
          <section key={view.key}>
            <h2 className="mb-1.5 text-sm font-semibold">{view.label}</h2>
            <MapPanel view={view} />
          </section>
        ))}
      </div>
    </div>
  );
}
