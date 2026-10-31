/**
 * 造型分享連結的編解碼。網址長這樣：
 *
 *   /fashion?skin=2003&items=30003.20000.1002357&act=walk1&face=smile
 *
 * items 只放道具 id——部位由 id 查 catalog 就知道，不必寫進網址。
 * 動作與表情是預設值時省略，網址短一點。背景色與縮放是看的人自己的偏好，不進連結。
 */
import { ACTIONS, EXPRESSIONS, SKINS } from "./config";

export const DEFAULT_ACTION = ACTIONS[0].id;
export const DEFAULT_EXPRESSION = EXPRESSIONS[0].id;

export interface SharedLook {
  skinId: number;
  /** 身上穿的道具 id（順序不重要） */
  itemIds: number[];
  action: string;
  expression: string;
}

/** 編成 query string（不含開頭的 ?） */
export function encodeLook(look: SharedLook): string {
  const params = new URLSearchParams({
    skin: String(look.skinId),
    items: look.itemIds.join("."),
  });
  if (look.action !== DEFAULT_ACTION) params.set("act", look.action);
  if (look.expression !== DEFAULT_EXPRESSION)
    params.set("face", look.expression);
  return params.toString();
}

/**
 * 把來路不明的造型驗成 SharedLook（別人給的網址、存在瀏覽器裡的搭配都走這裡）。
 * 每一欄都可能是亂填的或過時的：不認得的膚色／動作／表情退回預設值，
 * 道具 id 只保證是正整數——catalog 裡有沒有這件由呼叫端自己查。
 */
export function normalizeLook(raw: {
  skinId: unknown;
  itemIds: unknown[];
  action: unknown;
  expression: unknown;
}): SharedLook {
  return {
    skinId: SKINS.find((s) => s.id === raw.skinId)?.id ?? SKINS[0].id,
    itemIds: raw.itemIds.filter(
      (id): id is number => Number.isInteger(id) && (id as number) > 0,
    ),
    action: ACTIONS.find((a) => a.id === raw.action)?.id ?? DEFAULT_ACTION,
    expression:
      EXPRESSIONS.find((e) => e.id === raw.expression)?.id ??
      DEFAULT_EXPRESSION,
  };
}

/** 從 location.search 解出造型；網址沒帶造型就回 null */
export function decodeLook(search: string): SharedLook | null {
  const params = new URLSearchParams(search);
  if (!params.has("items") && !params.has("skin")) return null;

  return normalizeLook({
    skinId: Number(params.get("skin")),
    itemIds: (params.get("items") ?? "").split(".").map(Number),
    action: params.get("act"),
    expression: params.get("face"),
  });
}
