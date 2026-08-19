import { itemIconSrc } from "@/data/drops";
import { moonBunnyMap, moonBunnySeeds } from "@/data/moon-bunny";

export const metadata = {
  title: "月妙的年糕 · 迎月花山丘種子圖",
  description:
    "月妙的年糕第一階段，哪叢草掉哪色種子、六朵迎月花各收哪一色，一張圖看完。",
};

const { image, bushes, flowers } = moonBunnyMap;

const ICON_RATIO = 28 / 26; // 種子圖示原始比例，別把它拉扁

/**
 * 種子標記：就是那顆種子本身站在地上，顏色簡稱寫在正上方——跟遊戲裡掉落物的
 * 畫法一致。不加底色框：底圖是夜色土地，框反而搶戲；改用一層深色投影把圖示從
 * 土紋裡拉出來。座標單位是底圖像素（SVG 疊在圖上、共用同一個 viewBox），顏色
 * 一律寫死不吃主題——它們貼在夜色底圖上，跟著頁面明暗換色反而會看不見。
 */
function Seed({
  x,
  y,
  itemId,
  size,
}: {
  x: number;
  y: number;
  itemId: number;
  size: number;
}) {
  const seed = moonBunnySeeds[itemId];
  const w = size;
  const h = size * ICON_RATIO;
  const cx = x + image.originX;
  // +12：reactor 座標是碰撞線，草皮畫在它下方約 12px，圖示底部要壓到草土交界
  // 才像「放在地上」，貼齊碰撞線會看起來浮在草上面。
  const base = y + image.originY + 12;
  return (
    <g>
      <image
        href={itemIconSrc(itemId)}
        x={cx - w / 2}
        y={base - h}
        width={w}
        height={h}
        filter="url(#seed-shadow)"
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

      <div className="themed-scroll overflow-x-auto">
        {/* 固定 900px：底圖本身有 1829px 寬，鋪滿版面反而看不出哪顆種子在哪一階 */}
        <div
          className="relative mx-auto w-[900px]"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 拆包底圖，尺寸固定不需要 next/image */}
          <img
            src={image.src}
            alt={`${moonBunnyMap.mapName}地圖`}
            className="h-full w-full rounded-xl"
          />
          <svg
            viewBox={`0 0 ${image.width} ${image.height}`}
            aria-hidden
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <filter
                id="seed-shadow"
                x="-40%"
                y="-40%"
                width="180%"
                height="180%"
              >
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="3"
                  floodColor="#05070F"
                  floodOpacity="0.9"
                />
              </filter>
            </defs>
            {bushes.map((b, i) => (
              <Seed key={`b${i}`} x={b.x} y={b.y} itemId={b.itemId} size={46} />
            ))}
            {flowers.map((f) => (
              <Seed
                key={`f${f.itemId}`}
                x={f.x}
                y={f.y}
                itemId={f.itemId}
                size={72}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
