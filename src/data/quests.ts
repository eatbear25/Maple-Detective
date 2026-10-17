// 任務查詢資料（來源：遊戲用戶端 Quest/ 與地圖 life 節點，tools/ 底下的腳本產生）。
// 產生流程：extract-quest.py → build-quest-data.py → generated/quests.json
import data from "./generated/quests.json";
import type { EquipStats, MapInfo, WorldMapSheet } from "./drops";
import { ASSET_BASE_URL } from "@/lib/asset-base";

/** NPC 所在地圖 */
export type QuestMapInfo = MapInfo;

export interface QuestItem {
  id: number;
  /** 數量 */
  n: number;
  /** 只有這些職業系列拿得到（獎勵才有；沒有這欄 = 全職業都拿得到） */
  job?: string[];
  /** 0 = 只有男生、1 = 只有女生（沒有這欄 = 不分性別） */
  g?: number;
}

/** 完成條件要打倒的怪 */
export interface QuestMob {
  id: number;
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
  /** 地區篩選用的大地區名（規則見 tools/build-quest-data.py）；
   *  沒有這個欄位 = 這個任務的 NPC 全都不在已實裝地圖上（＝未實裝任務） */
  region?: string;
  /** 完成條件：要繳交的道具 */
  need: QuestItem[];
  /** 完成條件：要打倒的怪（79 個任務有） */
  kill?: QuestMob[];
  /** 接取條件：身上要先有的道具 */
  have?: QuestItem[];
  /** 接取條件：職業限制（全職業都能接的任務沒有這欄） */
  jobs?: string[];
  /** 接取條件：等級上限（超過就接不到了） */
  lvMax?: number;
  /** 可以重複接的間隔，單位分鐘（目前全部是 1440＝一天一次） */
  repeat?: number;
  rewards: QuestItem[];
  /** 接任務時 NPC 先給的道具（Act["0"]）。不是獎勵——完成時多半會被收回去 */
  give?: QuestItem[];
  exp?: number;
  money?: number;
  /** 這個任務要向玩家收取的楓幣（例：#6000 收 100 萬），不是獎勵 */
  cost?: number;
  /** 名聲 */
  pop?: number;
  /** 1 = 這個任務會給技能（細節看 skills） */
  skill?: number;
  /** 技能獎勵。m = 把技能上限拉到幾級（精通書），lv = 直接學到幾級 */
  skills?: { id: number; job?: string[]; m?: number; lv?: number }[];
  /** 互斥任務：接過這裡面任何一個，這個任務就接不到了（五條「XX 之路」互相排斥） */
  exclude?: string[];
  /** 1 = 接受/完成處理交給伺服器端腳本，獎勵在客戶端沒有記錄 */
  scripted?: number;
  /** 1 = 有吃到 reference-data/quest-supplement.json 的人工補充 */
  sup?: number;
  prereq: string[];
  /** 交任務前要先完成的任務（母任務等子任務做完，例：#2144 謠言的真相） */
  needQ?: string[];
  /** 活動期間 [開始, 結束]，"YYYY-MM-DDTHH:MM"；不是活動任務就沒有這欄 */
  ev?: [string | null, string | null];
  /** flows 索引；沒有前後關聯的單發任務沒有這個欄位 */
  f?: number;
}

/**
 * 任務流程的一塊（規則見 tools/build-quest-data.py 的 build_flows）：
 * - 字串：主線上的一步（任務 id）
 * - all／one／split：分岔框，整框算一步。all = 都要完成、one = 擇一、split = 各自獨立的後續
 * - also／side：掛在主線旁的框，不算步數。also = 另外也要先完成、side = 分出去的支線
 */
export type FlowKind = "all" | "one" | "split" | "also" | "side";
export type FlowBlock = string | { k: FlowKind; lines: FlowBlock[][] };

const d = data as unknown as {
  quests: Quest[];
  /** 每條任務流程 */
  flows: FlowBlock[][];
  items: Record<string, QuestItemInfo>;
  mobs: Record<string, string>;
  skills: Record<string, string>;
  maps: Record<string, QuestMapInfo>;
  regions: string[];
  worldmap: Record<string, WorldMapSheet>;
};

/** 依需求等級排序（無等級需求排最前） */
export const quests: Quest[] = d.quests;

export const questById = (id: string) => d.quests.find((q) => q.id === id);

/** 該任務所屬的任務流程；單發任務回 undefined */
export const flowOf = (q: Quest): FlowBlock[] | undefined =>
  q.f === undefined ? undefined : d.flows[q.f];

/** 完成條件要打的怪的中文名 */
export const questMobName = (id: number) => d.mobs[String(id)] ?? `#${id}`;
/** 技能獎勵的技能中文名 */
export const questSkillName = (id: number) => d.skills[String(id)] ?? `#${id}`;

export const questItemInfo = (id: number): QuestItemInfo | undefined => d.items[String(id)];
export const questItemName = (id: number) => d.items[String(id)]?.name ?? `#${id}`;
export const questMapInfo = (id: number): QuestMapInfo | undefined => d.maps[String(id)];

/** 該任務的大地區名；NPC 沒有已實裝地圖的任務回 undefined */
export const questRegion = (q: Quest) => q.region;
/** 地區 chips 的順序：大致依遊戲地理動線（見 tools/build-quest-data.py 的 TOWNS） */
export const questRegions: string[] = d.regions;
/** 任務 NPC 站立圖（tools/download-icons.py 抓的；少數 NPC maplestory.io 沒有圖） */
export const npcIconSrc = (id: number) => `${ASSET_BASE_URL}/icons/npc/${id}.gif`;

export const questWorldMapSheet = (s: string): WorldMapSheet | undefined => d.worldmap[s];
