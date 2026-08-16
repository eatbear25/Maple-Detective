"use client";

// 世界地圖底圖 + 標記點的共用元件（地圖導覽頁與怪物頁的世界地圖彈窗都用它）。
// 點的樣式仿遊戲內世界地圖：一般點＝亮黃小圓球（深棕描邊），
// 選中點＝橘紅大圓球＋白圈＋脈動光暈，約略位置＝空心圈，
// 背景點（dim）＝淡化縮小、不可點，只是把整張圖的點位補齊。
//
// 約略位置不要用虛線描邊：點只有 14px、邊框 2px，虛線會被切成 7～8 段短黑線，
// 而背景色會延伸到邊框底下從縫隙透出來，整顆看起來像放射狀的太陽而不是圓點。

export interface WorldMapDot {
  key: string;
  x: number;
  y: number;
  focus?: boolean;
  /** 約略位置（不在遊戲世界地圖上的隱藏圖，借鄰居的點標） */
  approx?: boolean;
  /** 背景點：不是本次查詢的目標，只補齊地圖點位，畫淡且不可點 */
  dim?: boolean;
  title?: string;
}

export function WorldMapView({
  src,
  alt,
  w,
  h,
  dots,
  onDotClick,
  className,
}: {
  src: string;
  alt: string;
  w: number;
  h: number;
  dots: WorldMapDot[];
  onDotClick?: (dot: WorldMapDot) => void;
  className?: string;
}) {
  const pos = (x: number, y: number) => ({
    left: `${((x + w / 2) / w) * 100}%`,
    top: `${((y + h / 2) / h) * 100}%`,
  });
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 拆包出的遊戲地圖底圖，不需要 next/image 最佳化 */}
      <img src={src} alt={alt} className="block h-auto w-full" draggable={false} />
      {dots.map((dot) =>
        dot.dim ? (
          <span
            key={dot.key}
            title={dot.title}
            aria-hidden
            className="absolute -translate-x-1/2 -translate-y-1/2 block h-2.5 w-2.5 rounded-full border opacity-55"
            style={{
              ...pos(dot.x, dot.y),
              background:
                "radial-gradient(circle at 35% 30%, #ffe98a, #ffc832 55%, #e89b00)",
              borderColor: "#6b3f10",
              boxShadow: "0 1px 2px rgba(0,0,0,.4)",
            }}
          />
        ) : (
        <button
          key={dot.key}
          onClick={() => onDotClick?.(dot)}
          title={dot.title}
          className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          style={pos(dot.x, dot.y)}
        >
          {dot.focus ? (
            <span className="relative flex h-7 w-7 items-center justify-center">
              <span
                className="absolute h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: "#ff5a3c" }}
              />
              <span
                className="relative h-[18px] w-[18px] rounded-full border-2 border-white"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, #ffb199, #ff5a3c 60%, #d23615)",
                  boxShadow: "0 0 0 2px #7a2a12, 0 2px 6px rgba(0,0,0,.6)",
                }}
              />
            </span>
          ) : (
            <span
              className="block h-3.5 w-3.5 rounded-full border-2 transition-transform group-hover:scale-125"
              style={
                dot.approx
                  ? {
                      background: "var(--surface)",
                      borderColor: "#e0a200",
                      boxShadow:
                        "0 0 0 1px rgba(107,63,16,.6), 0 1px 3px rgba(0,0,0,.45)",
                    }
                  : {
                      background:
                        "radial-gradient(circle at 35% 30%, #ffe98a, #ffc832 55%, #e89b00)",
                      borderColor: "#6b3f10",
                      boxShadow:
                        "0 1px 3px rgba(0,0,0,.55), inset 0 1px 1px rgba(255,255,255,.6)",
                    }
              }
            />
          )}
        </button>
        ),
      )}
    </div>
  );
}
