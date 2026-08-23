// 真實掉落資料（來源：遊戲用戶端怪物圖鑑，tools/ 底下的腳本產生）。
// 產生流程：extract-monster-book.py + extract-mob-stats.py → build-site-data.py
//          → generated/monster-drops.json
import data from "./generated/monster-drops.json";
import rawItemInfo from "./generated/item-info.json";
import rawQuestData from "./generated/quests.json";

/** 怪物數值（wz 原始欄位名；5 隻未實裝活動怪沒有數值，物件為空） */
export interface MobStats {
  maxHP?: number;
  maxMP?: number;
  exp?: number;
  PADamage?: number;
  MADamage?: number;
  PDDamage?: number;
  MDDamage?: number;
  acc?: number;
  eva?: number;
  boss?: number;
  /** 屬性抗性字串，如 "F3I1"（字母=屬性、數字 1=免疫 2=抗性 3=弱點） */
  elemAttr?: string;
}

const ELEM_NAMES: Record<string, string> = {
  F: "火",
  I: "冰",
  L: "雷",
  S: "毒",
  H: "聖",
  D: "暗",
  P: "物理",
};

export interface ElemAttr {
  /** 弱點屬性（受到該屬性傷害加成） */
  weak: string[];
  /** 抗性屬性（傷害減半） */
  resist: string[];
  /** 免疫屬性 */
  immune: string[];
}

/** 解析 elemAttr 字串 → 中文屬性分組 */
export function parseElemAttr(s: string | undefined): ElemAttr {
  const out: ElemAttr = { weak: [], resist: [], immune: [] };
  if (!s) return out;
  for (const [, letter, digit] of s.matchAll(/([A-Z])(\d)/g)) {
    const name = ELEM_NAMES[letter] ?? letter;
    if (digit === "3") out.weak.push(name);
    else if (digit === "2") out.resist.push(name);
    else if (digit === "1") out.immune.push(name);
  }
  return out;
}

export interface DropMonster {
  id: string;
  name: string;
  level: number | null;
  /** false = 客戶端資料裡有、但目前版本未實裝的怪物 */
  released: boolean;
  maps: number[];
  /** 實裝道具的掉落 */
  drops: number[];
  /** 未實裝道具的掉落（未來視） */
  futureDrops: number[];
  stats: MobStats;
}

/** 世界地圖上的點位：s = 底圖名（public/worldmap/<s>.png），座標原點在圖中心 */
export interface WorldMapSpot {
  s: string;
  x: number;
  y: number;
  /** 1 = 約略位置（該地圖不在遊戲世界地圖上，借最接近的鄰居地圖標） */
  a?: number;
}

export interface MapInfo {
  street: string;
  name: string;
  wm?: WorldMapSpot;
}

/** 世界地圖底圖資訊（key 即 public/worldmap/<key>.png） */
export interface WorldMapSheet {
  title: string;
  w: number;
  h: number;
  /** 該圖全部點位 [x, y]（畫成背景點，讓地圖看起來跟遊戲內一樣完整） */
  spots: [number, number][];
}

const d = data as unknown as {
  items: Record<string, string>;
  futureItems: Record<string, string>;
  maps: Record<string, MapInfo>;
  futureMaps: Record<string, MapInfo>;
  worldmap: Record<string, WorldMapSheet>;
  monsters: DropMonster[];
};

/** 裝備 info 數值（舊 wz 欄位名：reqLevel/reqJob/attackSpeed/tuc/incPAD...） */
export type EquipStats = Record<string, number>;

/** 道具彈窗資料：desc = 遊戲內說明（#c...# 為橘色強調標記），eq = 裝備數值 */
export interface ItemInfo {
  desc?: string;
  eq?: EquipStats;
}

const infos = rawItemInfo as unknown as Record<string, ItemInfo>;

// 任務道具（需求/獎勵）不在怪物掉落資料裡，但道具彈窗是全站共用的，
// 所以這裡把任務那份併進來當 fallback——名稱/說明查詢對呼叫端只有一個入口。
const questItems = (rawQuestData as unknown as {
  items: Record<string, ItemInfo & { name: string }>;
}).items;

export const monsters: DropMonster[] = d.monsters;

export const itemName = (id: number) =>
  d.items[String(id)] ?? d.futureItems[String(id)] ?? questItems[String(id)]?.name ?? `#${id}`;
export const itemInfo = (id: number): ItemInfo | undefined =>
  infos[String(id)] ?? questItems[String(id)];
export const mapInfo = (id: number): MapInfo | undefined => d.maps[String(id)];
/** 未實裝地圖名稱（maplestory.io 補充，未來視分頁用） */
export const futureMapInfo = (id: number): MapInfo | undefined => d.futureMaps[String(id)];
/** 世界地圖底圖資訊 */
export const worldMapSheet = (s: string): WorldMapSheet | undefined => d.worldmap[s];
export const worldMapSrc = (s: string) => `/worldmap/${s}.png`;
export const mobIconSrc = (id: string) => `/icons/mob/${id}.gif`;
export const itemIconSrc = (id: number) => `/icons/item/${id}.png`;
