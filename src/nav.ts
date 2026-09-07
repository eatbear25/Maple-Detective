export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string; // relative segment under site root, "" = index
  enabled: boolean;
}

// 頂層主選單
export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/** 頂層可以是一個下拉群組，也可以是直接連出去的單一項目。 */
export type NavNode = NavGroup | NavItem;

export function isNavGroup(node: NavNode): node is NavGroup {
  return "items" in node;
}

/**
 * 頂層位置的分配標準是「觸及率 ÷ 停留時間」，不是「哪個功能最得意」：
 * 點擊成本會乘上造訪次數，但會被停留時間稀釋。一頁進去待 100 秒，多點一下沒感覺；
 * 進去待 22 秒，多點一下就佔了 10% 的體感時間。
 * 依 2026-08-23 的 GA（141 位活躍使用者）：
 *   monsters 76.6% / 58 秒、boss-timer 35.5% / 22 秒、fashion 20.6% / 98 秒、map 19.2% / 56 秒。
 * 所以高頻的 monsters 與「開啟→掃一眼→關掉」的 boss-timer 放頂層直達，
 * 低頻但黏的 fashion 收進下拉（多一次點擊被 98 秒的停留稀釋掉）。
 * quests / skills / skill-build / gacha 在這份 GA 之後才上線、還沒有數據，
 * 目前是依性質歸類，兩週後要回頭用 GA 再確認一次。
 */
const MONSTERS: NavItem = {
  key: "monsters",
  label: "怪物掉落",
  icon: "🐌",
  path: "monsters",
  enabled: true,
};

const BOSS_TIMER: NavItem = {
  key: "boss-timer",
  label: "BOSS 計時器",
  icon: "👑",
  path: "boss-timer",
  enabled: true,
};

const LOOKUP: NavGroup = {
  key: "lookup",
  label: "查詢",
  items: [
    { key: "map", label: "地圖", icon: "🗺️", path: "map", enabled: true },
    { key: "skills", label: "技能", icon: "✨", path: "skills", enabled: true },
    {
      key: "quests",
      label: "任務",
      icon: "📜",
      path: "quests",
      enabled: true,
    },
  ],
};

/**
 * 「模擬器」的三個成員都是「進去待很久、一次玩完」的深度工具，語意一致。
 * 舊的「工具」群組把 BOSS 計時器（查一下就走）跟技能配點（模擬器）綁在一起，
 * 兩者性質相反，這次拆開。之後的裝備模擬器、楓幣計算機也放這裡。
 */
const SIMULATORS: NavGroup = {
  key: "simulators",
  label: "模擬器",
  items: [
    {
      key: "gacha",
      label: "轉蛋模擬",
      icon: "🎰",
      path: "gacha",
      enabled: true,
    },
    {
      key: "fashion",
      label: "時裝搭配",
      icon: "👗",
      path: "fashion",
      enabled: true,
    },
    {
      key: "skill-build",
      label: "技能配點模擬",
      icon: "🎯",
      path: "skill-build",
      enabled: true,
    },
  ],
};

/**
 * 組隊任務的關卡小工具。三個都是「開著查、邊打邊看」的對照表，
 * 跟「模擬器」那種一次玩很久的深度工具性質不同，所以自成一組。
 *
 * feat/party 原本自己做了一套 NavItem.children 的兩層選單（父層 /party 是
 * 一張列出三個工具的 landing page），但 dev 這邊已經有 NavGroup 了，
 * 同一個功能沒必要兩套實作，所以改用 NavGroup、landing page 一併移除——
 * 下拉選單本來就在做「列出三個工具」這件事。
 *
 * 位置排在最後只是因為還沒有 GA 數據，不是判斷它不重要；
 * 有數據之後照這個檔案開頭那條「觸及率 ÷ 停留時間」的標準重排。
 */
const PARTY: NavGroup = {
  key: "party",
  label: "組隊",
  items: [
    {
      key: "moon-bunny",
      label: "月妙的年糕",
      icon: "🌙",
      path: "party/moon-bunny",
      enabled: true,
    },
    {
      key: "first-time-together",
      label: "超綠題庫",
      icon: "❓",
      path: "party/first-time-together",
      enabled: true,
    },
    {
      key: "tower-of-goddess",
      label: "女神速查",
      icon: "🗼",
      path: "party/tower-of-goddess",
      enabled: true,
    },
  ],
};

export const navTree: NavNode[] = [
  MONSTERS,
  BOSS_TIMER,
  LOOKUP,
  SIMULATORS,
  PARTY,
];

/** 攤平的清單，給不分組的地方用（路徑比對等）。 */
export const navItems: NavItem[] = navTree.flatMap((n) =>
  isNavGroup(n) ? n.items : [n],
);

export function navHref(path: string) {
  return path ? `/${path}` : "/";
}
