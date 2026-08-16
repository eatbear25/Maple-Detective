// 真實掉落資料（來源：遊戲用戶端怪物圖鑑，tools/ 底下的腳本產生）。
// 產生流程：extract-monster-book.py → build-site-data.py → generated/monster-drops.json
import data from "./generated/monster-drops.json";
import rawItemInfo from "./generated/item-info.json";

export interface DropMonster {
  id: string;
  name: string;
  level: number | null;
  maps: number[];
  drops: number[];
}

export interface MapInfo {
  street: string;
  name: string;
}

const d = data as unknown as {
  items: Record<string, string>;
  maps: Record<string, MapInfo>;
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

export const monsters: DropMonster[] = d.monsters;

export const itemName = (id: number) => d.items[String(id)] ?? `#${id}`;
export const itemInfo = (id: number): ItemInfo | undefined => infos[String(id)];
export const mapInfo = (id: number): MapInfo | undefined => d.maps[String(id)];
export const mobIconSrc = (id: string) => `/icons/mob/${id}.gif`;
export const itemIconSrc = (id: number) => `/icons/item/${id}.png`;

/** 出沒區域（具名地圖的街道名去重，保持地圖順序） */
export function regionsOf(m: DropMonster): string[] {
  const seen = new Set<string>();
  for (const mp of m.maps) {
    const street = mapInfo(mp)?.street;
    if (street) seen.add(street);
  }
  return [...seen];
}
