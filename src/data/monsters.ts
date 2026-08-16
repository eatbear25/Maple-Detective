export interface DropEntry {
  itemId: string;
  itemName: string;
  rate: number; // % 掉落機率 (示意用假資料)
  icon: string;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  exp: number;
  region: string;
  icon: string;
  drops: DropEntry[];
}

// 注意：怪物 / 道具「名稱」取自遊戲客戶端可公開讀取的本地化字串表（示範用途）。
// 等級、HP、EXP、掉落機率為示意用假資料，之後會替換成正式資料來源。
export const monsters: Monster[] = [
  {
    id: "100100",
    name: "嫩寶",
    level: 1,
    hp: 15,
    exp: 3,
    region: "楓之島",
    icon: "🐌",
    drops: [
      { itemId: "1012098", itemName: "楓葉", rate: 55, icon: "🍁" },
      { itemId: "2000000", itemName: "初階力量藥水", rate: 12, icon: "🧪" },
      { itemId: "1062112", itemName: "內褲", rate: 3, icon: "🩲" },
    ],
  },
  {
    id: "100101",
    name: "藍寶",
    level: 2,
    hp: 21,
    exp: 4,
    region: "楓之島",
    icon: "🐌",
    drops: [
      { itemId: "1012098", itemName: "楓葉", rate: 50, icon: "🍁" },
      { itemId: "2000001", itemName: "初階敏捷藥水", rate: 10, icon: "🧪" },
    ],
  },
  {
    id: "130100",
    name: "木妖",
    level: 8,
    hp: 82,
    exp: 8,
    region: "楓之島",
    icon: "🌳",
    drops: [
      { itemId: "1012052", itemName: "忍者卷軸", rate: 6, icon: "📜" },
      { itemId: "1050154", itemName: "塞爾拉鞋", rate: 2, icon: "👞" },
    ],
  },
  {
    id: "130101",
    name: "紅寶",
    level: 5,
    hp: 42,
    exp: 6,
    region: "楓之島",
    icon: "🐌",
    drops: [
      { itemId: "1012098", itemName: "楓葉", rate: 48, icon: "🍁" },
      { itemId: "1061039", itemName: "粉紅棉內褲", rate: 4, icon: "🩲" },
    ],
  },
  {
    id: "210100",
    name: "綠水靈",
    level: 4,
    hp: 33,
    exp: 5,
    region: "露娜草原",
    icon: "💧",
    drops: [
      { itemId: "2000002", itemName: "初階智力藥水", rate: 14, icon: "🧪" },
      { itemId: "1060026", itemName: "藍條內褲", rate: 3, icon: "🩲" },
    ],
  },
  {
    id: "1110100",
    name: "綠菇菇",
    level: 6,
    hp: 55,
    exp: 7,
    region: "垂柳山谷",
    icon: "🍄",
    drops: [
      { itemId: "1012101", itemName: "楓葉", rate: 45, icon: "🍁" },
      { itemId: "2000000", itemName: "初階力量藥水", rate: 15, icon: "🧪" },
    ],
  },
  {
    id: "1120100",
    name: "三眼章魚",
    level: 10,
    hp: 130,
    exp: 12,
    region: "垂柳山谷",
    icon: "🐙",
    drops: [
      { itemId: "1032040", itemName: "楓葉赤光耳環", rate: 1.5, icon: "💎" },
      { itemId: "1071026", itemName: "純白運動鞋", rate: 2, icon: "👟" },
    ],
  },
  {
    id: "1210100",
    name: "肥肥",
    level: 9,
    hp: 100,
    exp: 10,
    region: "美麗小鎮牧場",
    icon: "🐷",
    drops: [
      { itemId: "1012102", itemName: "楓葉", rate: 40, icon: "🍁" },
      { itemId: "1071007", itemName: "兔子鞋", rate: 3, icon: "👟" },
    ],
  },
  {
    id: "1210101",
    name: "緞帶肥肥",
    level: 11,
    hp: 150,
    exp: 15,
    region: "美麗小鎮牧場",
    icon: "🎀",
    drops: [
      { itemId: "1012103", itemName: "楓葉", rate: 40, icon: "🍁" },
      { itemId: "1000019", itemName: "葛亞帽", rate: 1.2, icon: "🎩" },
    ],
  },
  {
    id: "2100100",
    name: "母砂兔",
    level: 13,
    hp: 220,
    exp: 20,
    region: "熾熱沙漠",
    icon: "🐇",
    drops: [
      { itemId: "1072012", itemName: "紅皮鞋", rate: 2.5, icon: "👞" },
      { itemId: "2000001", itemName: "初階敏捷藥水", rate: 18, icon: "🧪" },
    ],
  },
  {
    id: "2100103",
    name: "仙人掌",
    level: 15,
    hp: 320,
    exp: 28,
    region: "熾熱沙漠",
    icon: "🌵",
    drops: [
      { itemId: "1072013", itemName: "紅色運動鞋", rate: 2, icon: "👟" },
      { itemId: "1001013", itemName: "貝雷帽", rate: 1, icon: "🎩" },
    ],
  },
  {
    id: "2220000",
    name: "紅寶王",
    level: 18,
    hp: 5200,
    exp: 320,
    region: "楓之島（頭目）",
    icon: "👑",
    drops: [
      { itemId: "1002758", itemName: "楓葉頭盔", rate: 8, icon: "⛑️" },
      { itemId: "1032041", itemName: "楓葉赤光耳環", rate: 5, icon: "💎" },
      { itemId: "1012098", itemName: "楓葉", rate: 90, icon: "🍁" },
    ],
  },
];

export const regions = Array.from(new Set(monsters.map((m) => m.region)));
