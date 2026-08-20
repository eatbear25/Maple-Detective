/** 試衣間的固定設定：膚色、動作、表情、預設造型。 */
import type { FashionSlot } from "@/data/fashion";

export interface EquippedItem {
  id: number;
  name: string;
  /** renderer 用的 .img 路徑，見 data/fashion.ts 的 itemImgPath */
  path: string;
}

/**
 * 開著的特效。不佔部位、沒有性別限制，所以跟 equips 分開放。
 * z / trail / zOverride 只有客戶端知道，來自 data/fashion.ts 的 catalog。
 */
export interface EffectSpec {
  id: number;
  name: string;
  /** follow=跟在身後的隊列（錨點與其他型不同，見 renderer 的 buildEffectTrack） */
  kind: "follow" | "action" | "simple";
  /** 負數＝畫在角色後方，正數＝畫在前方 */
  z: number;
  /** 跟隨隊列：每一隻落後角色幾 px */
  trail?: number[];
  /** 少數 book 的 z 不同（例：翅膀爬梯時改畫在身前） */
  zOverride?: Record<string, number>;
}

export interface CharacterLook {
  /** 身體 id（2000 系列），頭部 id = 身體 + 10000 */
  skinId: number;
  equips: Partial<Record<FashionSlot, EquippedItem>>;
  effect?: EffectSpec;
}

/**
 * 經典版實裝的 8 種膚色。
 * 判定依據：客戶端 spritesheet 包的 Character/ 根目錄只有 00002000～00002011 這
 * 8 組身體＋對應的 8 組頭（新楓之谷有 50 種，那些經典版沒有）。
 */
export const SKINS: { id: number; name: string }[] = [
  { id: 2000, name: "奶油皮膚" },
  { id: 2001, name: "日光浴皮膚" },
  { id: 2002, name: "健康皮膚" },
  { id: 2003, name: "乳白皮膚" },
  { id: 2004, name: "淒涼皮膚" },
  { id: 2009, name: "蒼白皮膚" },
  { id: 2010, name: "貴族皮膚" },
  { id: 2011, name: "華麗皮膚" },
];

/** 可選動作（對應身體 img 的動作名稱） */
export const ACTIONS: { id: string; label: string }[] = [
  { id: "stand1", label: "站立" },
  { id: "walk1", label: "走路" },
  { id: "stand2", label: "站立（持武）" },
  { id: "walk2", label: "走路（持武）" },
  { id: "jump", label: "跳躍" },
  { id: "alert", label: "警戒" },
  { id: "prone", label: "趴下" },
  { id: "sit", label: "坐下" },
  { id: "ladder", label: "爬梯子" },
  { id: "rope", label: "爬繩子" },
  { id: "fly", label: "飛行" },
];

/** 可選表情（對應臉型 img 的表情名稱） */
export const EXPRESSIONS: { id: string; label: string }[] = [
  { id: "default", label: "預設" },
  { id: "blink", label: "眨眼" },
  { id: "smile", label: "微笑" },
  { id: "cheers", label: "開心" },
  { id: "love", label: "愛心" },
  { id: "wink", label: "拋媚眼" },
  { id: "chu", label: "親親" },
  { id: "angry", label: "生氣" },
  { id: "cry", label: "哭泣" },
  { id: "troubled", label: "困擾" },
  { id: "bewildered", label: "慌張" },
  { id: "stunned", label: "暈眩" },
  { id: "shine", label: "閃亮" },
  { id: "glitter", label: "亮晶晶" },
  { id: "despair", label: "絕望" },
  { id: "oops", label: "驚訝" },
  { id: "vomit", label: "嘔吐" },
  { id: "pain", label: "痛苦" },
  { id: "hum", label: "哼哼" },
  { id: "bowing", label: "鞠躬" },
  { id: "hot", label: "燥熱" },
  { id: "dam", label: "不滿" },
];

/** 開頁時的造型：最基本的黑髮＋挑戰的臉型（客戶端 MakeCharInfo 的預設值之一） */
export const DEFAULT_LOOK: CharacterLook = {
  skinId: 2000,
  equips: {
    hair: { id: 30000, name: "黑色基本冒險造型", path: "Character/Hair/00030000.img" },
    face: { id: 20000, name: "挑戰的臉型", path: "Character/Face/00020000.img" },
  },
};
