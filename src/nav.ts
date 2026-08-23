export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string; // relative segment under site root, "" = index
  enabled: boolean;
}

/** 頂層主選單。「查詢」= 查資料，「工具」= 操作型工具（2026-08-22 定案）。 */
export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
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
  },
  {
    key: "tools",
    label: "工具",
    items: [
      {
        key: "skill-build",
        label: "技能配點",
        icon: "🎯",
        path: "skill-build",
        enabled: true,
      },
      {
        key: "gacha",
        label: "轉蛋模擬",
        icon: "🎰",
        path: "gacha",
        enabled: true,
      },
      {
        key: "boss-timer",
        label: "BOSS 計時器",
        icon: "👑",
        path: "boss-timer",
        enabled: true,
      },
      {
        key: "fashion",
        label: "時裝搭配",
        icon: "👗",
        path: "fashion",
        enabled: true,
      },
    ],
  },
];

/** 攤平的清單，給不分組的地方用（例如手機側邊選單、路徑比對）。 */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function navHref(path: string) {
  return path ? `/${path}` : "/";
}
