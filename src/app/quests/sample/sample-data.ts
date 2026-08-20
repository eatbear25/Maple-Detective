// Sample 用假資料：從真實客戶端任務資料抽 19 筆代表性樣本（含系列鏈、獎勵、
// 需求道具、未實裝任務）。正式頁上線後這個資料夾整個刪掉，改吃 generated/quests.json。

export interface SampleItem {
  id: number;
  n: number;
  name: string;
}

export interface SampleQuest {
  id: string;
  name: string;
  series: string | null;
  /** 需求等級，0 = 無限制 */
  lv: number;
  npc: string | null;
  npcMap: string | null;
  released: boolean;
  need: SampleItem[];
  rewards: SampleItem[];
  exp: number;
  money: number;
  pop: number;
  skill: number;
  prereq: string[];
}

export const sampleQuests: SampleQuest[] = [
  {
    "id": "1001",
    "name": "給希娜弄來鏡子",
    "series": "莎麗的鏡子",
    "lv": 0,
    "npc": "莎麗",
    "npcMap": "菇菇村訓練所入口",
    "released": true,
    "need": [
      {
        "id": 4031003,
        "n": 1,
        "name": "莎麗的鏡子"
      }
    ],
    "rewards": [
      {
        "id": 4031003,
        "n": 1,
        "name": "莎麗的鏡子"
      }
    ],
    "exp": 1,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "1000"
    ]
  },
  {
    "id": "1005",
    "name": "交給長老的信件",
    "series": "將信件轉交給長老.",
    "lv": 0,
    "npc": "瑪麗亞",
    "npcMap": "岔道（往楓之港口和楓葉村）",
    "released": true,
    "need": [
      {
        "id": 4031000,
        "n": 1,
        "name": "瑪麗亞的信件"
      }
    ],
    "rewards": [
      {
        "id": 4031000,
        "n": 1,
        "name": "瑪麗亞的信件"
      }
    ],
    "exp": 0,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": []
  },
  {
    "id": "1006",
    "name": "長老的回信",
    "series": "將信件轉交給瑪麗亞",
    "lv": 0,
    "npc": "路卡斯",
    "npcMap": "楓葉村",
    "released": true,
    "need": [
      {
        "id": 4031001,
        "n": 1,
        "name": "路卡斯的信件"
      }
    ],
    "rewards": [
      {
        "id": 4031001,
        "n": 1,
        "name": "路卡斯的信件"
      },
      {
        "id": 1002008,
        "n": 1,
        "name": "褐色皮帽"
      },
      {
        "id": 1002053,
        "n": 1,
        "name": "綠色皮帽"
      },
      {
        "id": 1002014,
        "n": 1,
        "name": "紅色髮帶"
      },
      {
        "id": 1002066,
        "n": 1,
        "name": "黑髮帶"
      },
      {
        "id": 1002067,
        "n": 1,
        "name": "綠髮帶"
      },
      {
        "id": 1002068,
        "n": 1,
        "name": "黃髮帶"
      },
      {
        "id": 1002069,
        "n": 1,
        "name": "藍髮帶"
      }
    ],
    "exp": 10,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "1005"
    ]
  },
  {
    "id": "1007",
    "name": "比格斯的物品收集",
    "series": null,
    "lv": 0,
    "npc": "比格斯",
    "npcMap": "楓之港",
    "released": true,
    "need": [
      {
        "id": 4000000,
        "n": 5,
        "name": "藍寶殼"
      },
      {
        "id": 4000001,
        "n": 1,
        "name": "菇菇寶貝傘"
      }
    ],
    "rewards": [
      {
        "id": 1332007,
        "n": 1,
        "name": "短刀"
      },
      {
        "id": 1332005,
        "n": 1,
        "name": "刮鬍刀"
      }
    ],
    "exp": 50,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": []
  },
  {
    "id": "1024",
    "name": "解決愛情的煩惱?!",
    "series": null,
    "lv": 0,
    "npc": "桑姆",
    "npcMap": "嫩寶狩獵場Ⅰ",
    "released": true,
    "need": [
      {
        "id": 4000003,
        "n": 3,
        "name": "樹枝"
      }
    ],
    "rewards": [
      {
        "id": 2010002,
        "n": 5,
        "name": "雞蛋"
      },
      {
        "id": 2010003,
        "n": 5,
        "name": "柳橙"
      }
    ],
    "exp": 70,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": []
  },
  {
    "id": "1026",
    "name": "將營養果汁轉交給桑克斯",
    "series": "瑪麗亞與桑克斯",
    "lv": 0,
    "npc": "瑪麗亞",
    "npcMap": "岔道（往楓之港口和楓葉村）",
    "released": true,
    "need": [
      {
        "id": 4031556,
        "n": 1,
        "name": "營養果汁"
      }
    ],
    "rewards": [
      {
        "id": 4031556,
        "n": 1,
        "name": "營養果汁"
      },
      {
        "id": 2000000,
        "n": 10,
        "name": "紅色藥水"
      },
      {
        "id": 2000003,
        "n": 10,
        "name": "藍色藥水"
      }
    ],
    "exp": 100,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "1025"
    ]
  },
  {
    "id": "2232",
    "name": "登記成為跟隨者！",
    "series": "傳授領袖阿爾的知識",
    "lv": 0,
    "npc": "領袖阿爾",
    "npcMap": null,
    "released": false,
    "need": [],
    "rewards": [],
    "exp": 0,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "2231"
    ]
  },
  {
    "id": "2233",
    "name": "增加聲望值！",
    "series": "傳授領袖阿爾的知識 ",
    "lv": 0,
    "npc": "領袖阿爾",
    "npcMap": null,
    "released": false,
    "need": [],
    "rewards": [],
    "exp": 0,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "2232"
    ]
  },
  {
    "id": "6100",
    "name": "用透明墨水記載的書",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "圖書館員 懷玆",
    "npcMap": null,
    "released": false,
    "need": [
      {
        "id": 2022000,
        "n": 10,
        "name": "礦泉水"
      },
      {
        "id": 4006000,
        "n": 30,
        "name": "魔法石"
      },
      {
        "id": 4000183,
        "n": 50,
        "name": "墨汁瓶"
      },
      {
        "id": 4161018,
        "n": 1,
        "name": "#4161018"
      }
    ],
    "rewards": [],
    "exp": 700000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": []
  },
  {
    "id": "6101",
    "name": "老舊的書",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "圖書館員 懷玆",
    "npcMap": null,
    "released": false,
    "need": [
      {
        "id": 4161024,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "rewards": [
      {
        "id": 4161024,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "exp": 100000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6100"
    ]
  },
  {
    "id": "6102",
    "name": "弓箭手的終極技能",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "赫麗娜",
    "npcMap": "弓箭手培訓中心",
    "released": true,
    "need": [
      {
        "id": 4161025,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "rewards": [
      {
        "id": 4161025,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "exp": 100000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6101"
    ]
  },
  {
    "id": "6103",
    "name": "邪摩斯的忠告",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "蕾妮",
    "npcMap": null,
    "released": false,
    "need": [
      {
        "id": 4161026,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "rewards": [
      {
        "id": 4161026,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "exp": 100000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6102"
    ]
  },
  {
    "id": "6104",
    "name": "新的推測",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "邪摩斯",
    "npcMap": null,
    "released": false,
    "need": [
      {
        "id": 4161027,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "rewards": [
      {
        "id": 4161027,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "exp": 100000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6103"
    ]
  },
  {
    "id": "6105",
    "name": "記憶者",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "蕾妮",
    "npcMap": null,
    "released": false,
    "need": [
      {
        "id": 4161028,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "rewards": [
      {
        "id": 4161028,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "exp": 100000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6104"
    ]
  },
  {
    "id": "6106",
    "name": "無意義存在者",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "記憶者",
    "npcMap": "奇幻村",
    "released": true,
    "need": [
      {
        "id": 4161029,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "rewards": [
      {
        "id": 4161029,
        "n": 1,
        "name": "弓箭手之路"
      }
    ],
    "exp": 100000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6105"
    ]
  },
  {
    "id": "6107",
    "name": "黑暗靈魂石",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "無意義存在者",
    "npcMap": "另外的入口",
    "released": true,
    "need": [
      {
        "id": 4031466,
        "n": 50,
        "name": "黑暗靈魂石"
      }
    ],
    "rewards": [],
    "exp": 700000,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": [
      "6106"
    ]
  },
  {
    "id": "6108",
    "name": "異界的巴洛古",
    "series": "極致的試煉",
    "lv": 0,
    "npc": "無意義存在者",
    "npcMap": "另外的入口",
    "released": true,
    "need": [],
    "rewards": [],
    "exp": 1000000,
    "money": 0,
    "pop": 0,
    "skill": 1,
    "prereq": [
      "6107"
    ]
  },
  {
    "id": "6000",
    "name": "流浪煉金術師的新技術",
    "series": null,
    "lv": 13,
    "npc": "流浪煉金術師",
    "npcMap": "奇幻村",
    "released": true,
    "need": [
      {
        "id": 2040600,
        "n": 1,
        "name": "褲、裙防禦卷軸100%"
      },
      {
        "id": 1302013,
        "n": 1,
        "name": "紅色鞭子"
      },
      {
        "id": 2040000,
        "n": 1,
        "name": "頭盔防禦卷軸100%"
      },
      {
        "id": 2043000,
        "n": 1,
        "name": "單手劍攻擊卷軸100%"
      },
      {
        "id": 2040400,
        "n": 1,
        "name": "上衣防禦卷軸100%"
      }
    ],
    "rewards": [],
    "exp": 0,
    "money": -1000000,
    "pop": 0,
    "skill": 1,
    "prereq": []
  },
  {
    "id": "1054",
    "name": "皇家騎士團",
    "series": null,
    "lv": 20,
    "npc": "那因哈特",
    "npcMap": null,
    "released": false,
    "need": [],
    "rewards": [],
    "exp": 0,
    "money": 0,
    "pop": 0,
    "skill": 0,
    "prereq": []
  }
];

/** sample 用的道具資料（名稱＋遊戲內說明＋裝備數值），來源同 build-site-data.py：
 *  name-tables/Item.json 的 name/desc ＋ equip-info.json。正式版由
 *  build-quest-data.py 產進 generated/，這裡先自帶一份讓 tooltip 有東西顯示。 */
export const sampleItemInfo: Record<string, { name: string; desc?: string; eq?: Record<string, number> }> = {
  "1002008": {
    "name": "褐色皮帽",
    "eq": {
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1002014": {
    "name": "紅色髮帶",
    "eq": {
      "incACC": 1,
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1002053": {
    "name": "綠色皮帽",
    "eq": {
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1002066": {
    "name": "黑髮帶",
    "eq": {
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1002067": {
    "name": "綠髮帶",
    "eq": {
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1002068": {
    "name": "黃髮帶",
    "eq": {
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1002069": {
    "name": "藍髮帶",
    "eq": {
      "incPDD": 5,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1302013": {
    "name": "紅色鞭子",
    "eq": {
      "attackSpeed": 4,
      "incPAD": 48,
      "incSpeed": 15,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 35,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1332005": {
    "name": "刮鬍刀",
    "eq": {
      "attackSpeed": 4,
      "incPAD": 20,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 5,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "1332007": {
    "name": "短刀",
    "eq": {
      "attackSpeed": 3,
      "incPAD": 22,
      "reqDEX": 0,
      "reqINT": 0,
      "reqJob": 0,
      "reqLUK": 0,
      "reqLevel": 8,
      "reqSTR": 0,
      "tuc": 7
    }
  },
  "2000000": {
    "name": "紅色藥水",
    "desc": "紅色藥草製成的藥水。\\nHP恢復約50。"
  },
  "2000003": {
    "name": "藍色藥水",
    "desc": "藍色藥草製成的藥水。\\nMP恢復約100。"
  },
  "2010002": {
    "name": "雞蛋",
    "desc": "營養豐富的雞蛋。\\nHP恢復約50。"
  },
  "2010003": {
    "name": "柳橙",
    "desc": "酸甜的柳橙。\\nMP恢復約50。"
  },
  "2022000": {
    "name": "礦泉水",
    "desc": "非常純淨的水。\\nMP恢復約800。"
  },
  "2040000": {
    "name": "頭盔防禦卷軸100%",
    "desc": "頭盔的物理防禦力提升。\\n成功率：100%，物理防禦力+1"
  },
  "2040400": {
    "name": "上衣防禦卷軸100%",
    "desc": "上衣附加物理防禦力提升屬性。\\n成功率：100%，物理防禦力+1"
  },
  "2040600": {
    "name": "褲、裙防禦卷軸100%",
    "desc": "下衣附加物理防禦力提升屬性。\\n成功率：100%，物理防禦力+1"
  },
  "2043000": {
    "name": "單手劍攻擊卷軸100%",
    "desc": "單手劍附加攻擊力提升屬性。\\n成功率：100%，物理攻擊力+1"
  },
  "4000000": {
    "name": "藍寶殼",
    "desc": "從藍寶身上掉落的殼。"
  },
  "4000001": {
    "name": "菇菇寶貝傘",
    "desc": "菇菇寶貝的傘蓋"
  },
  "4000003": {
    "name": "樹枝",
    "desc": "從樹上砍下的枝"
  },
  "4000183": {
    "name": "墨汁瓶",
    "desc": "將海底深處的烏賊怪們身上的墨汁取出後，放入瓶中。"
  },
  "4006000": {
    "name": "魔法石",
    "desc": "有魔法能力的神秘石頭。用於高級技能。"
  },
  "4031000": {
    "name": "瑪麗亞的信件",
    "desc": "從瑪麗亞收到的信件。應該轉交給楓葉村的路卡斯"
  },
  "4031001": {
    "name": "路卡斯的信件",
    "desc": "從路卡斯收到的信件。應該轉交給蘑菇村的瑪麗亞"
  },
  "4031003": {
    "name": "莎麗的鏡子",
    "desc": "裝飾華麗的莎麗的鏡子。"
  },
  "4031466": {
    "name": "黑暗靈魂石",
    "desc": "擁有黑暗氣息的靈魂石。"
  },
  "4031556": {
    "name": "營養果汁",
    "desc": "用綠液球和菇菇芽孢所製作的特製營養果汁。"
  },
  "4161018": {
    "name": "#4161018"
  },
  "4161024": {
    "name": "弓箭手之路",
    "desc": "弓箭手的修煉指南。裡面記載著修煉方法與弓箭手修煉場相關的內容。"
  },
  "4161025": {
    "name": "弓箭手之路",
    "desc": "弓箭手的修煉指南。裡面記載著修煉方法與弓箭手修煉場相關的內容。"
  },
  "4161026": {
    "name": "弓箭手之路",
    "desc": "弓箭手的修煉指南。裡面記載著修煉方法與弓箭手修煉場相關的內容。"
  },
  "4161027": {
    "name": "弓箭手之路",
    "desc": "弓箭手的修煉指南。裡面記載著修煉方法與弓箭手修煉場相關的內容。"
  },
  "4161028": {
    "name": "弓箭手之路",
    "desc": "弓箭手的修煉指南。裡面記載著修煉方法與弓箭手修煉場相關的內容。"
  },
  "4161029": {
    "name": "弓箭手之路",
    "desc": "弓箭手的修煉指南。裡面記載著修煉方法與弓箭手修煉場相關的內容。"
  }
};
