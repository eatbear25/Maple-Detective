// BOSS 計時器用的固定重生 BOSS 清單。mobId 是從 reference-data 對照 monster-drops.json
// 「released」欄位手動核對出來的（同名怪在拆包資料裡常有好幾個任務/副本版本，只有
// 一個是實際出現在遊戲地圖上的那隻）。重生時間由玩家回報，不在客戶端資料裡。
export interface BossDef {
  /** 對應 monster-drops.json 的怪物 id，可重用 mobIconSrc()/掉落頁查詢 */
  id: string;
  name: string;
  /** 固定/已知重生分鐘數；不確定的先留空，由使用者第一次新增追蹤時自己填 */
  defaultRespawnMin?: number;
  defaultRespawnMax?: number;
}

export const bossList: BossDef[] = [
  {
    id: "2220000",
    name: "紅寶王",
    defaultRespawnMin: 45,
    defaultRespawnMax: 45,
  },
  {
    id: "3220000",
    name: "樹妖王",
    defaultRespawnMin: 45,
    defaultRespawnMax: 45,
  },
  {
    id: "6130101",
    name: "蘑菇王",
    defaultRespawnMin: 45,
    defaultRespawnMax: 60,
  },
  { id: "6300005", name: "殭屍蘑菇王" },
  { id: "8130100", name: "巴洛古" },
  {
    id: "5220000",
    name: "巨居蟹",
    defaultRespawnMin: 45,
    defaultRespawnMax: 45,
  },
  {
    id: "6220000",
    name: "沼澤巨鱷",
    defaultRespawnMin: 45,
    defaultRespawnMax: 45,
  },
  {
    id: "5220002",
    name: "殭屍猴王",
    defaultRespawnMin: 45,
    defaultRespawnMax: 45,
  },
];
