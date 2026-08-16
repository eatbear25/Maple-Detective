// 世界地圖導覽資料（tools/build-site-data.py → generated/worldmap-nav.json）。
// 底圖在 public/worldmap/<sheet>.png，由 tools/extract-worldmap.py 拆包產生。
import nav from "./generated/worldmap-nav.json";

/** 世界地圖上的一個標記點；座標原點在底圖中心 */
export interface WmSpot {
  x: number;
  y: number;
  /** 這個點代表的地圖（遊戲世界地圖本來就把相鄰幾張圖併成一點） */
  maps: number[];
  /** 借這個點標約略位置的隱藏地圖/迷你地城 */
  near?: number[];
}

export interface WmSheet {
  title: string;
  /** 上一層圖（總圖為 null） */
  parent: string | null;
  w: number;
  h: number;
  /** 子圖（例：維多利亞島 → 奇幻村、鯨魚號） */
  links: string[];
  spots: WmSpot[];
}

export interface WmMapName {
  street: string;
  name: string;
  /** 1 = 現行版本已實裝（客戶端 Map.json 有名字） */
  released?: number;
}

const d = nav as unknown as {
  sheets: Record<string, WmSheet>;
  mapNames: Record<string, WmMapName>;
  mobsByMap: Record<string, string[]>;
};

export const wmSheets = d.sheets;
/** 總圖 sheet id */
export const WM_ROOT = "WorldMap";
export const wmMapName = (id: number): WmMapName | undefined =>
  d.mapNames[String(id)];
/** 這張地圖上出沒的怪物 id（詳細資訊從 drops.ts 的 monsters 查） */
export const wmMobsOnMap = (id: number): string[] => d.mobsByMap[String(id)] ?? [];
