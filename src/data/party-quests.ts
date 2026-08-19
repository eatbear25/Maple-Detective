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

// 第一次同行（超級綠水靈）．第一階段：克魯特會 1 對 1 出題，隊員要打鱷魚
// 收集「剛好」等於答案數量的優惠券。題目原文出自客戶端腳本
// String/TW/ScriptString/party.wzjson（$SCRIPTSTRING_PARTY_9$ ~ _17$，共 9 題）。
// 答案不在客戶端（伺服器驗證），是另外交叉比對出來的：轉職等級來自轉職 NPC
// 腳本 job/job2.wzjson、新手 SP 總和來自 Skill/000.wzjson（三個新手技能上限各 3），
// 其餘為楓谷通用常數。順序照題型分組排（四題轉職等級擺一起，避免看錯）。

export interface QuizEntry {
  /** 題目的關鍵字，即遊戲內用紅字標出來的那段 */
  question: string;
  answer: number;
  /** 為什麼是這個數字，給玩家安心用 */
  note: string;
}

export const firstTimeTogetherQuiz: QuizEntry[] = [
  {
    question: "從等級 1 升到等級 2 所需經驗值",
    answer: 15,
    note: "新手最初的那 15 點經驗",
  },
  {
    question: "魔法師 1 轉所需最低等級",
    answer: 8,
    note: "只有魔法師是 8，其他職業都是 10",
  },
  { question: "劍士 1 轉所需最低等級", answer: 10, note: "" },
  { question: "弓箭手 1 轉所需最低等級", answer: 10, note: "" },
  { question: "盜賊 1 轉所需最低等級", answer: 10, note: "" },
  {
    question: "升級時獲得的 AP 數值",
    answer: 5,
    note: "每升一級加 5 點能力值",
  },
  {
    question: "升級時獲得的 SP 數值",
    answer: 3,
    note: "每升一級加 3 點技能點",
  },
  { question: "隊伍人數上限", answer: 6, note: "一隊最多 6 人" },
  {
    question: "新手可獲得的 SP 總和",
    answer: 6,
    note: "嫩寶丟擲術、團隊治癒、疾風之步，上限各 3 級",
  },
];
