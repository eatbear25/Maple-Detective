// 道具「來源」反查索引：一件道具是哪些怪掉的、哪些任務給的、哪些任務要的。
//
// 這份索引存在的理由是 /items/[id] 詳情頁——玩家搜「XX 哪裡打」時要落在一個
// 直接回答問題的頁面上。索引在模組載入時算一次（343 隻怪 + 490 個任務，很便宜），
// build 時全部頁面共用同一份，不需要另外做成 generated JSON。
import { monsters } from "./drops";
import { quests } from "./quests";

export interface ItemSources {
  /** 掉這件道具的怪物 id */
  droppedBy: string[];
  /** 會給這件道具的任務 id（獎勵，以及接任務時 NPC 先給的） */
  rewardedBy: string[];
  /** 需要繳交這件道具的任務 id */
  requiredBy: string[];
}

const EMPTY: ItemSources = { droppedBy: [], rewardedBy: [], requiredBy: [] };

const index = new Map<number, ItemSources>();

function entry(id: number): ItemSources {
  let e = index.get(id);
  if (!e) {
    e = { droppedBy: [], rewardedBy: [], requiredBy: [] };
    index.set(id, e);
  }
  return e;
}

for (const m of monsters) {
  // 未實裝掉落（futureDrops）也收：未來視分頁列得到，詳情頁就該查得到來源
  for (const iid of [...m.drops, ...m.futureDrops]) {
    const e = entry(iid);
    if (!e.droppedBy.includes(m.id)) e.droppedBy.push(m.id);
  }
}

for (const q of quests) {
  for (const it of [...q.rewards, ...(q.give ?? [])]) {
    const e = entry(it.id);
    if (!e.rewardedBy.includes(q.id)) e.rewardedBy.push(q.id);
  }
  for (const it of q.need) {
    const e = entry(it.id);
    if (!e.requiredBy.includes(q.id)) e.requiredBy.push(q.id);
  }
}

export const itemSources = (id: number): ItemSources => index.get(id) ?? EMPTY;

/**
 * 有來源的道具 id（給 /items/[id] 的 generateStaticParams 用）。
 * 只出有來源的，是為了避免產生一整批「頁面上什麼都沒有」的薄頁——
 * 那種頁面對搜尋排名是扣分不是加分。
 */
export const sourcedItemIds: number[] = [...index.keys()].sort((a, b) => a - b);
