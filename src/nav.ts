export interface NavChild {
  key: string;
  label: string;
  /** 完整路徑（含父層），例："party/tower-of-goddess" */
  path: string;
  enabled: boolean;
}

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string; // relative segment under site root, "" = index
  enabled: boolean;
  /** 有子項時，桌機版 hover 展開下拉、手機版在抽屜裡縮排列出 */
  children?: NavChild[];
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
  {
    key: "party",
    label: "組隊任務",
    icon: "🛡️",
    path: "party",
    enabled: true,
    children: [
      {
        key: "moon-bunny",
        label: "月妙的年糕",
        path: "party/moon-bunny",
        enabled: true,
      },
      {
        key: "first-time-together",
        label: "超綠題庫",
        path: "party/first-time-together",
        enabled: true,
      },
      {
        key: "tower-of-goddess",
        label: "女神速查",
        path: "party/tower-of-goddess",
        enabled: true,
      },
    ],
  },
];

export function navHref(path: string) {
  return path ? `/${path}` : "/";
}
