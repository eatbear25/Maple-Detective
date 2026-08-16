export interface OutfitItem {
  id: string;
  name: string;
  slot: "帽子" | "上衣" | "鞋子" | "武器" | "耳環";
  icon: string;
  color: string;
}

// 名稱取自遊戲客戶端字串表，僅作示範用途
export const outfitItems: OutfitItem[] = [
  { id: "1000019", name: "葛亞帽", slot: "帽子", icon: "🎩", color: "#8b5cf6" },
  { id: "1001013", name: "貝雷帽", slot: "帽子", icon: "🧢", color: "#ef4444" },
  { id: "1001010", name: "熊帽子", slot: "帽子", icon: "🐻", color: "#a16207" },
  { id: "1000026", name: "聖誕帽", slot: "帽子", icon: "🎅", color: "#dc2626" },
  { id: "1071007", name: "兔子鞋", slot: "鞋子", icon: "👟", color: "#f472b6" },
  { id: "1072013", name: "紅色運動鞋", slot: "鞋子", icon: "👟", color: "#ef4444" },
  { id: "1071026", name: "純白運動鞋", slot: "鞋子", icon: "👟", color: "#e5e7eb" },
  { id: "1032040", name: "楓葉赤光耳環", slot: "耳環", icon: "💎", color: "#f97316" },
];

export interface OutfitPreset {
  id: string;
  title: string;
  author: string;
  likes: number;
  itemIds: string[];
}

export const outfitPresets: OutfitPreset[] = [
  { id: "p1", title: "楓葉小紅帽套裝", author: "小鎮劍士", likes: 128, itemIds: ["1000019", "1071007", "1032040"] },
  { id: "p2", title: "耶誕限定風", author: "冰霜法師", likes: 96, itemIds: ["1000026", "1072013"] },
  { id: "p3", title: "純白極簡風", author: "弓箭手Rin", likes: 74, itemIds: ["1001013", "1071026"] },
];
