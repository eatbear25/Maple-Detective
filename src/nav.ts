export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string; // relative segment under site root, "" = index
  enabled: boolean;
}

export const navItems: NavItem[] = [
  // { key: "home", label: "總覽", icon: "🏠", path: "", enabled: true },
  {
    key: "monsters",
    label: "怪物掉落",
    icon: "🐌",
    path: "monsters",
    enabled: true,
  },
  {
    key: "quests",
    label: "任務查詢",
    icon: "📜",
    path: "quests",
    enabled: true,
  },
  { key: "map", label: "地圖", icon: "🗺️", path: "map", enabled: true },
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
  // { key: "party", label: "組隊攻略", icon: "🛡️", path: "party", enabled: true },
];

export function navHref(path: string) {
  return path ? `/${path}` : "/";
}
