// 組隊任務工具用的固定資料。
//
// 女神之塔．休息室：每天要交的唱盤不同，道具 id 4001056–4001062 取自客戶端
// 名稱表 reference-data/name-tables/Item.json（圖示已抓到 public/icons/item/）。
// color 是直接從那張 icon 取出的主色（PNG 主要色相像素），只拿來畫色塊，
// 不拿來當文字色（黃色在淺色底上對比不足）。

export interface RecordEntry {
  /** 0 = 星期日，對應 Date#getDay() */
  day: number;
  dayLabel: string;
  itemId: number;
  /** 客戶端道具名（遊戲內看到的字） */
  name: string;
  /** 玩家口語的顏色叫法 */
  colorLabel: string;
  color: string;
}

export const loungeRecords: RecordEntry[] = [
  {
    day: 0,
    dayLabel: "星期日",
    itemId: 4001056,
    name: "傑出音樂的唱盤",
    colorLabel: "紅",
    color: "#EE3333",
  },
  {
    day: 1,
    dayLabel: "星期一",
    itemId: 4001057,
    name: "可愛音樂的唱盤",
    colorLabel: "橘",
    color: "#EE8833",
  },
  {
    day: 2,
    dayLabel: "星期二",
    itemId: 4001058,
    name: "可怕音樂的唱盤",
    colorLabel: "黃",
    color: "#FFCC33",
  },
  {
    day: 3,
    dayLabel: "星期三",
    itemId: 4001059,
    name: "有趣音樂的唱盤",
    colorLabel: "紫",
    color: "#BB11BB",
  },
  {
    day: 4,
    dayLabel: "星期四",
    itemId: 4001060,
    name: "憂鬱音樂的唱盤",
    colorLabel: "深藍",
    color: "#2222CC",
  },
  {
    day: 5,
    dayLabel: "星期五",
    itemId: 4001061,
    name: "冷淡音樂的唱盤",
    colorLabel: "水藍",
    color: "#00AADD",
  },
  {
    day: 6,
    dayLabel: "星期六",
    itemId: 4001062,
    name: "乾淨音樂的唱盤",
    colorLabel: "綠",
    color: "#00BB00",
  },
];
