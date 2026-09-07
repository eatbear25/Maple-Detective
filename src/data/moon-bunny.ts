// 月妙的年糕．第一階段（迎月花山丘）攻略圖資料。
// 地形／草叢／花的座標與顏色對應：tools/extract-moonbunny-map.py
//   → generated/moon-bunny-map.json（怎麼從客戶端解出來的見腳本 docstring）
// 這裡只補「給玩家看的東西」：簡稱與色票。色票是從種子圖示 PNG 取彩度最高
// 那群像素的平均值（跟 party-quests.ts 的唱盤同一套做法）。
import raw from "./generated/moon-bunny-map.json";

export interface MoonBunnySeed {
  itemId: number;
  /** 玩家口語的顏色叫法，畫在圖上的字 */
  label: string;
  /** 客戶端道具全名 */
  name: string;
  color: string;
}

export const moonBunnySeeds: Record<number, MoonBunnySeed> = {
  4001095: { itemId: 4001095, label: "綠", name: "淺綠色迎月花種子", color: "#A6D951" },
  4001096: { itemId: 4001096, label: "紫", name: "紫色迎月花種子", color: "#7755DD" },
  4001097: { itemId: 4001097, label: "粉", name: "淺紫色迎月花種子", color: "#DD55DD" },
  4001098: { itemId: 4001098, label: "褐", name: "黃褐色迎月花種子", color: "#D99151" },
  4001099: { itemId: 4001099, label: "黃", name: "黃色迎月花種子", color: "#EECC33" },
  4001100: { itemId: 4001100, label: "藍", name: "藍色迎月花種子", color: "#3377DD" },
};

/** 地圖上的一個標記（座標是遊戲世界座標，y 向下為正） */
export interface MoonBunnySpot {
  x: number;
  y: number;
  itemId: number;
}

export interface MoonBunnyFlower extends MoonBunnySpot {
  side: "left" | "right";
  /** 0=上 1=中 2=下 */
  row: number;
}

export const moonBunnyMap = raw as unknown as {
  mapId: number;
  mapName: string;
  /** 底圖與座標原點：world (x, y) 畫在圖上的 (x + originX, y + originY) */
  image: {
    src: string;
    width: number;
    height: number;
    originX: number;
    originY: number;
  };
  npc: { x: number; y: number; name: string };
  /** 每段地形 [x1, y1, x2, y2] */
  footholds: [number, number, number, number][];
  ropes: { x: number; y1: number; y2: number }[];
  bushes: MoonBunnySpot[];
  flowers: MoonBunnyFlower[];
};
