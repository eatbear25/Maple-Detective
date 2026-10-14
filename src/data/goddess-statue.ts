// 女神之塔．最後一關（中央塔）女神像碎片攻略圖資料。
// 哪個平台收哪片碎片、底圖：tools/extract-goddess-statue.py
//   → generated/goddess-statue.json（怎麼來的見腳本 docstring）
import raw from "./generated/goddess-statue.json";

/** 一個放置點：站上這塊平台把道具丟下去 */
export interface StatueSpot {
  reactorId: number;
  itemId: number;
  /** 客戶端道具全名 */
  name: string;
  /** 第幾個碎片（1–6）；null = 最後那一步的生命草 */
  order: number | null;
  /** 平台中點，遊戲世界座標（y 向下為正，落在地形線上） */
  x: number;
  y: number;
}

export const goddessStatue = raw as unknown as {
  mapId: number;
  /** 底圖與座標原點：world (x, y) 畫在圖上的 (x + originX, y + originY) */
  image: {
    src: string;
    width: number;
    height: number;
    originX: number;
    originY: number;
  };
  /** 依碎片編號排好，生命草在最後 */
  spots: StatueSpot[];
};
