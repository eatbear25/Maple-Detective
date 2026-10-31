"use client";

import { useState } from "react";
import { ASSET_BASE_URL } from "@/lib/asset-base";

const GIF = "/brand/detective-penguin.gif";
const PNG = "/brand/detective-penguin.png";

/**
 * 首頁的偵探企鵝（原圖 61×71）。
 *
 * - 動圖 5 格、每格 0.35 秒、無限循環，後 4 格眼睛是 $$；系統開了「減少動態效果」
 *   改顯示第一格的靜止 PNG（<picture> 的 media 由瀏覽器自己挑，不用 JS）。
 * - 只能整數倍放大（2 倍 122px、3 倍 183px），寬度由呼叫端的 className 給，
 *   搭配 .pixel-art（image-rendering: pixelated）像素才不會糊。
 * - 圖走 ASSET_BASE_URL（jsDelivr），不吃 Vercel 的 CDN Request 配額。新檔剛推上去時
 *   jsDelivr 的 @main 最久要 12 小時才看得到，那段時間會 404，所以失敗時退回本站同一路徑。
 */
export function DetectivePenguin({ className }: { className?: string }) {
  const [base, setBase] = useState(ASSET_BASE_URL);
  const fallback = () => {
    if (base) setBase("");
  };

  return (
    <picture>
      <source srcSet={base + PNG} media="(prefers-reduced-motion: reduce)" />
      <img
        src={base + GIF}
        alt="戴著偵探帽、拿放大鏡的企鵝"
        width={61}
        height={71}
        className={`pixel-art ${className ?? ""}`}
        onError={fallback}
        // 伺服器端渲染的圖可能在 React 接手前就 404 了，onError 會錯過；掛上去時補查一次
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) fallback();
        }}
      />
    </picture>
  );
}
