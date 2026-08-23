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

const LOOKUP: NavGroup = {
  key: "lookup",
  label: "查詢",
  items: [
    {
      key: "monsters",
      label: "怪物掉落",
      icon: "🐌",
      path: "monsters",
      enabled: true,
    },
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

const TOOLS: NavGroup = {
  key: "tools",
  label: "工具",
  items: [
    {
      key: "skill-build",
      label: "技能配點模擬",
      icon: "🎯",
      path: "skill-build",
      enabled: true,
    },
    {
      key: "boss-timer",
      label: "BOSS 計時器",
      icon: "👑",
      path: "boss-timer",
      enabled: true,
    },
  ],
};

const GACHA: NavItem = {
  key: "gacha",
  label: "轉蛋模擬",
  icon: "🎰",
  path: "gacha",
  enabled: true,
};

const FASHION: NavItem = {
  key: "fashion",
  label: "試衣間",
  icon: "👗",
  path: "fashion",
  enabled: true,
};

export const navTree: NavNode[] = [LOOKUP, TOOLS, GACHA, FASHION];

/** 攤平的清單，給不分組的地方用（路徑比對等）。 */
export const navItems: NavItem[] = navTree.flatMap((n) =>
  isNavGroup(n) ? n.items : [n],
);

export function navHref(path: string) {
  return path ? `/${path}` : "/";
}
