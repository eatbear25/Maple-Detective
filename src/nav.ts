export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string; // relative segment under theme root, "" = index
  enabled: boolean;
}

export const navItems: NavItem[] = [
  { key: "home", label: "總覽", icon: "🏠", path: "", enabled: true },
  { key: "monsters", label: "怪物掉落查詢", icon: "🐌", path: "monsters", enabled: true },
  { key: "fashion", label: "時裝搭配", icon: "👗", path: "fashion", enabled: true },
  { key: "party", label: "組隊攻略", icon: "🛡️", path: "party", enabled: true },
  { key: "sim", label: "裝備模擬器", icon: "⚔️", path: "sim", enabled: false },
  { key: "calc", label: "楓幣計算機", icon: "🧮", path: "calc", enabled: false },
  { key: "map", label: "地圖導覽", icon: "🗺️", path: "map", enabled: false },
];

export function themeHref(theme: string, path: string) {
  return path ? `/${theme}/${path}` : `/${theme}`;
}
