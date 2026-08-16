// 點裝清單（來源：遊戲用戶端 Character/ 的 info.cash=1，tools/ 底下的腳本產生）。
// 產生流程：extract-cash-items.py → build-fashion-data.py → generated/fashion-catalog.json
//
// 圖與渲染資料不在這裡：那些是執行期向 maplestory.io 抓的（見 src/lib/fashion/msio.ts）。
// 這份只負責回答「有哪些點裝、叫什麼、哪個部位、限不限性別」——
// 那是 maplestory.io 給不了、只有客戶端知道的事。
import raw from "./generated/fashion-catalog.json";

/** 部位代號＝客戶端 Character/ 底下的子目錄（小寫），也直接對應 WZ 資料夾 */
export type FashionSlot =
  | "hair"
  | "face"
  | "cap"
  | "coat"
  | "longcoat"
  | "pants"
  | "shoes"
  | "glove"
  | "cape"
  | "accessory"
  | "weapon"
  | "shield";

/** 性別限制：0=男限 1=女限 2=共用 -1=不明（延伸髮型臉型推不出來） */
export type Gender = 0 | 1 | 2 | -1;

export interface FashionItem {
  id: number;
  name: string;
  slot: FashionSlot;
  gender: Gender;
}

interface RawRow {
  i: number;
  n: string;
  s: string;
  g: number;
}

const data = raw as unknown as { meta: { builtAt: string; items: number }; items: RawRow[] };

export const fashionItems: FashionItem[] = data.items.map((r) => ({
  id: r.i,
  name: r.n,
  slot: r.s as FashionSlot,
  gender: r.g as Gender,
}));

const byId = new Map(fashionItems.map((it) => [it.id, it]));
export const fashionItem = (id: number) => byId.get(id);

/** 部位顯示名稱與排列順序（試衣間左欄的分頁順序） */
export const SLOT_LABELS: { slot: FashionSlot; label: string }[] = [
  { slot: "hair", label: "髮型" },
  { slot: "face", label: "臉型" },
  { slot: "cap", label: "帽子" },
  { slot: "longcoat", label: "套服" },
  { slot: "coat", label: "上衣" },
  { slot: "pants", label: "褲裙" },
  { slot: "shoes", label: "鞋子" },
  { slot: "glove", label: "手套" },
  { slot: "cape", label: "披風" },
  { slot: "accessory", label: "飾品" },
  { slot: "weapon", label: "武器" },
  { slot: "shield", label: "盾牌" },
];

/**
 * 穿上這個部位時要自動脫掉哪些部位。
 * 套服（Longcoat）在遊戲裡佔上下半身，與上衣＋褲子互斥。
 */
export const SLOT_CONFLICTS: Partial<Record<FashionSlot, FashionSlot[]>> = {
  longcoat: ["coat", "pants"],
  coat: ["longcoat"],
  pants: ["longcoat"],
};

/** WZ 資料夾名（部位代號就是子目錄的小寫，這裡還原成渲染要的路徑） */
const WZ_FOLDER: Record<FashionSlot, string> = {
  hair: "Hair",
  face: "Face",
  cap: "Cap",
  coat: "Coat",
  longcoat: "Longcoat",
  pants: "Pants",
  shoes: "Shoes",
  glove: "Glove",
  cape: "Cape",
  accessory: "Accessory",
  weapon: "Weapon",
  shield: "Shield",
};

const pad8 = (id: number) => String(id).padStart(8, "0");

/** renderer 吃的 .img 路徑 */
export const itemImgPath = (item: FashionItem) =>
  `Character/${WZ_FOLDER[item.slot]}/${pad8(item.id)}.img`;

export const GENDER_LABELS: Record<string, string> = {
  "0": "男",
  "1": "女",
  "2": "共用",
  "-1": "不明",
};

export const catalogBuiltAt = data.meta.builtAt;

// ===== 髮型／臉型的顏色群組 =====
//
// 遊戲的 ID 編碼：髮型「個位數」是顏色（0黑 1紅 2橘 3黃 4綠 5藍 6紫 7棕）、
// 臉型「百位數」是顏色（名稱完全相同，只有瞳色不同）。
// 全 catalog 驗證過：髮型 1938 件收成 246 組、臉型 1267 件收成 159 組，
// 同組內性別一致。臉型另有 2 件 digit-8 的灰白色特例，不進色票
// （選不到，但也只是同臉型的重複色）。

/** 色票選項：digit＝ID 裡的顏色碼，hex 只是 UI 色塊的近似色 */
export interface ColorOption {
  digit: number;
  label: string;
  hex: string;
}

export const HAIR_COLORS: ColorOption[] = [
  { digit: 0, label: "黑色", hex: "#3f3d3d" },
  { digit: 1, label: "紅色", hex: "#a63c39" },
  { digit: 2, label: "橘色", hex: "#c86f34" },
  { digit: 3, label: "黃色", hex: "#c9a53f" },
  { digit: 4, label: "綠色", hex: "#5c8a44" },
  { digit: 5, label: "藍色", hex: "#4a6cae" },
  { digit: 6, label: "紫色", hex: "#85559f" },
  { digit: 7, label: "棕色", hex: "#7d5a3c" },
];

// 臉型各色的 label/hex 依 TMS/209 icon 平均色實測歸類（名稱表沒有瞳色名）
export const FACE_COLORS: ColorOption[] = [
  { digit: 0, label: "黑色", hex: "#4a4a4c" },
  { digit: 1, label: "藍色", hex: "#3e5f9e" },
  { digit: 2, label: "紅色", hex: "#a03a48" },
  { digit: 3, label: "綠色", hex: "#55793f" },
  { digit: 4, label: "褐色", hex: "#7d5442" },
  { digit: 5, label: "青色", hex: "#4787a5" },
  { digit: 6, label: "紫色", hex: "#77489d" },
  { digit: 7, label: "紫紅色", hex: "#a04a6e" },
];

/** 這兩個部位的清單以「造型群組＋色票」顯示，其他部位維持逐件 */
export const GROUPED_SLOTS: ReadonlySet<FashionSlot> = new Set(["hair", "face"]);

export const colorDigitOf = (slot: FashionSlot, id: number) =>
  slot === "hair" ? id % 10 : Math.floor(id / 100) % 10;

/** 把顏色碼歸零後的基底 id，同造型不同顏色共用 */
export const styleBaseId = (slot: FashionSlot, id: number) =>
  id - colorDigitOf(slot, id) * (slot === "hair" ? 1 : 100);

export interface FashionStyleGroup {
  /** 基底 id（styleBaseId） */
  key: number;
  /** 去掉顏色字首的造型名 */
  name: string;
  slot: FashionSlot;
  gender: Gender;
  /** 依顏色碼排序 */
  variants: { color: number; item: FashionItem }[];
}

// 遊戲資料的顏色字首有異體字（橙色、咖啡色、粽色、單獨一個「紫」），多字詞放前面
const COLOR_PREFIX_RE = /^(咖啡|粉紅|黑|紅|橘|橙|黃|金|綠|藍|紫|棕|褐|粽|白|銀|灰)色?/;

function buildGroups(slot: FashionSlot): FashionStyleGroup[] {
  const map = new Map<number, FashionStyleGroup>();
  for (const item of fashionItems) {
    if (item.slot !== slot) continue;
    const key = styleBaseId(slot, item.id);
    let group = map.get(key);
    if (!group) {
      group = { key, name: "", slot, gender: item.gender, variants: [] };
      map.set(key, group);
    }
    group.variants.push({ color: colorDigitOf(slot, item.id), item });
  }
  for (const group of map.values()) {
    group.variants.sort((a, b) => a.color - b.color);
    const rep = group.variants[0].item;
    const stripped = slot === "hair" ? rep.name.replace(COLOR_PREFIX_RE, "") : rep.name;
    group.name = stripped || rep.name;
  }
  return [...map.values()].sort((a, b) => a.key - b.key);
}

export const hairGroups = buildGroups("hair");
export const faceGroups = buildGroups("face");

const groupIndex = new Map<string, FashionStyleGroup>();
for (const group of [...hairGroups, ...faceGroups])
  groupIndex.set(`${group.slot}:${group.key}`, group);

/** 由任一顏色的 item id 反查它所屬的造型群組 */
export const styleGroupOf = (slot: FashionSlot, id: number) =>
  groupIndex.get(`${slot}:${styleBaseId(slot, id)}`);
