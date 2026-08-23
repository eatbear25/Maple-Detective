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

export const navTree: NavNode[] = [MONSTERS, BOSS_TIMER, LOOKUP, SIMULATORS];

/** 攤平的清單，給不分組的地方用（路徑比對等）。 */
export const navItems: NavItem[] = navTree.flatMap((n) =>
  isNavGroup(n) ? n.items : [n],
);

export function navHref(path: string) {
  return path ? `/${path}` : "/";
}
