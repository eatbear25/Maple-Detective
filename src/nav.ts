export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string; // relative segment under theme root, "" = index
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
  { key: "map", label: "地圖", icon: "🗺️", path: "map", enabled: true },
  {
    key: "fashion",
    label: "時裝搭配",
    icon: "👗",
    path: "fashion",
    enabled: true,
  },
  // { key: "party", label: "組隊攻略", icon: "🛡️", path: "party", enabled: true },
];

export function themeHref(theme: string, path: string) {
  return path ? `/${theme}/${path}` : `/${theme}`;
}
