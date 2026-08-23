// 任務查詢資料（來源：遊戲用戶端 Quest/ 與地圖 life 節點，tools/ 底下的腳本產生）。
// 產生流程：extract-quest.py → build-quest-data.py → generated/quests.json
import data from "./generated/quests.json";
import type { EquipStats, MapInfo, WorldMapSheet } from "./drops";

/** NPC 所在地圖。region = 地區篩選用的大地區名（規則見 tools/build-quest-data.py） */
export interface QuestMapInfo extends MapInfo {
  region?: string;
}

export interface QuestItem {
  id: number;
  /** 數量 */
  n: number;
}

/** 道具彈窗資料：desc = 遊戲內說明（#c...# 為橘色強調），eq = 裝備數值 */
export interface QuestItemInfo {
  name: string;
  desc?: string;
  eq?: EquipStats;
}

export interface Quest {
  id: string;
  name: string;
  /** 系列名（遊戲的 QuestInfo.parent），沒有的任務就沒有這個欄位 */
  series?: string;
  /** 需求等級，0 = 無限制 */
  lv: number;
  /** false = 這個任務的 NPC 都不在已實裝地圖上（目前版本玩不到） */
  released: boolean;
  npc?: string;
  npcId?: number;
  /** NPC 所在地圖 id；查不到的是腳本動態生成的劇情 NPC */
  npcMap?: number;
  need: QuestItem[];
  rewards: QuestItem[];
  exp?: number;
  money?: number;
  /** 這個任務要向玩家收取的楓幣（例：#6000 收 100 萬），不是獎勵 */
  cost?: number;
  /** 名聲 */
  pop?: number;
  /** 1 = 這個任務會給技能 */
  skill?: number;
  /** 1 = 接受/完成處理交給伺服器端腳本，獎勵在客戶端沒有記錄 */
  scripted?: number;
  /** 1 = 有吃到 reference-data/quest-supplement.json 的人工補充 */
  sup?: number;
  prereq: string[];
  /** chains 索引；沒有前後關聯的單發任務沒有這個欄位 */
  c?: number;
}

const d = data as unknown as {
  quests: Quest[];
  /** 每條任務鏈，已依流程排好序 */
  chains: string[][];
  items: Record<string, QuestItemInfo>;
  maps: Record<string, QuestMapInfo>;
  worldmap: Record<string, WorldMapSheet>;
};

/** 依需求等級排序（無等級需求排最前） */
export const quests: Quest[] = d.quests;

export const questById = (id: string) => d.quests.find((q) => q.id === id);

/** 該任務所屬任務鏈的完整任務清單（依流程排序）；單發任務回空陣列 */
export const chainOf = (q: Quest): Quest[] =>
  q.c === undefined
    ? []
    : d.chains[q.c].map((id) => questById(id)).filter((x): x is Quest => !!x);

export const questItemInfo = (id: number): QuestItemInfo | undefined => d.items[String(id)];
export const questItemName = (id: number) => d.items[String(id)]?.name ?? `#${id}`;
export const questMapInfo = (id: number): QuestMapInfo | undefined => d.maps[String(id)];

/** 該任務的大地區名；NPC 沒有已實裝地圖的任務回 undefined */
export const questRegion = (q: Quest) =>
  q.npcMap != null ? d.maps[String(q.npcMap)]?.region : undefined;
/** 任務 NPC 站立圖（tools/download-icons.py 抓的；少數 NPC maplestory.io 沒有圖） */
export const npcIconSrc = (id: number) => `/icons/npc/${id}.gif`;

export const questWorldMapSheet = (s: string): WorldMapSheet | undefined => d.worldmap[s];
