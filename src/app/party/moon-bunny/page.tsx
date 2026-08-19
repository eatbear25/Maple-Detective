import { itemIconSrc } from "@/data/drops";
import { moonBunnyMap, moonBunnySeeds } from "@/data/moon-bunny";

export const metadata = {
  title: "月妙的年糕 · 迎月花山丘種子圖",
  description:
    "月妙的年糕第一階段，哪叢草掉哪色種子、六朵迎月花各收哪一色，一張圖看完。",
};

const { image, bushes, flowers } = moonBunnyMap;

/**
 * 種子標記：白底框 + 種子圖示，框底貼著地面／平台，顏色簡稱寫在框的正上方
 * ——跟遊戲裡掉落物的畫法一致，框浮在半空會看不出種子是站在哪一階地形上。
 * 座標單位是底圖像素（SVG 疊在圖上、共用同一個 viewBox），顏色一律寫死不吃主題
 * ——它們貼在夜色底圖上，跟著頁面明暗換色反而會看不見。
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
  const half = size / 2;
  const cx = x + image.originX;
  // +12：reactor 座標是碰撞線，草皮畫在它下方約 12px，框底要壓到草土交界才像
  // 「放在地上」，貼齊碰撞線會看起來浮在草上面。
  const cy = y + image.originY - half + 12;
  return (
    <g>
      <rect
        x={cx - half}
        y={cy - half}
        width={size}
        height={size}
        rx={size * 0.2}
        fill="#FFFFFF"
        stroke={seed.color}
        strokeWidth={size * 0.09}
      />
      <image
        href={itemIconSrc(itemId)}
        x={cx - size * 0.34}
        y={cy - size * 0.34}
        width={size * 0.68}
        height={size * 0.68}
      />
      <text
        x={cx}
        y={cy - half - size * 0.14}
        textAnchor="middle"
        fontSize={size * 0.56}
        fontWeight={700}
        fill="#FFFFFF"
        stroke="#11131F"
        strokeWidth={size * 0.1}
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
          第一階段「{moonBunnyMap.mapName}」：打草撿種子，放到<b>同色</b>的迎月花上
        </p>
      </div>

      <div className="themed-scroll overflow-x-auto">
        <div
          className="relative min-w-[900px]"
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
            {bushes.map((b, i) => (
              <Seed key={`b${i}`} x={b.x} y={b.y} itemId={b.itemId} size={58} />
            ))}
            {flowers.map((f) => (
              <Seed
                key={`f${f.itemId}`}
                x={f.x}
                y={f.y}
                itemId={f.itemId}
                size={86}
              />
            ))}
          </svg>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        大框＝迎月花（放種子的地方），小框＝草叢（打了掉那個顏色的種子）。
      </p>
    </div>
  );
}
