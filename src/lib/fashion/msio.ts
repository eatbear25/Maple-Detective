/**
 * maplestory.io 公開 API——現在只剩**特效**（點裝 0501 段）在執行期用它。
 *
 * 時裝本體（髮型、臉型、各部位裝備）已經改成預先烤好的靜態檔，見 ./baked.ts；
 * 那邊的說明寫了為什麼不再於執行期打這個 API（慢、肥、會撞 ID）。
 * 特效只有 45 件、分頁目前也沒開，所以還留在這裡沒搬。
 *
 * 注意 maplestory.io 對不存在的道具會回 **HTTP 200 + body `null`**，
 * 不是 404。只看 res.ok 會把缺件當成功，一定要檢查內容有沒有東西。
 */

const REGIONS = ["TMS/209", "TWMS/256", "GMS/211.1.0", "CMS/202", "KMS/389"] as const;

const BASE = (region: string) => `https://maplestory.io/api/${region}`;

/** 各版本都查不到這件道具（不是網路錯誤，重試也沒用） */
export class ItemNotAvailableError extends Error {
  readonly itemId: number;

  constructor(itemId: number) {
    super(`素材庫沒有這件道具（#${itemId}）`);
    this.name = "ItemNotAvailableError";
    this.itemId = itemId;
  }
}

interface MsioItem {
  /** 特效道具（0501）的圖在這裡，欄位名是小寫 b，跟裝備的 frameBooks 不同 */
  effect?: { framebooks?: Record<string, MsioEffectSub[]> };
}

interface MsioEffectSub {
  frames?: { image?: string; delay?: number; origin?: { x: number; y: number } }[];
}

/** 特效的一格：圖、原點、停留時間 */
export interface EffectFrame {
  url: string;
  origin: { x: number; y: number };
  delay: number;
}

/** book（動作名或 default）→ 隊列裡的每一隻 → 逐格 */
export type EffectBooks = Record<string, EffectFrame[][]>;

const hasFrames = (books: Record<string, MsioEffectSub[]> | undefined) =>
  !!books && Object.values(books).some((subs) => subs.some((s) => s.frames?.length));

/**
 * 抓特效道具（0501 段）的圖。跟裝備走不同欄位：`effect.framebooks`，
 * 而且結構多一層——每個 book 底下是「隊列陣列」，玩具小鴨家族那類
 * 一個 book 有 5 隻，一般特效只有 1 隻。
 *
 * 客戶端的 129 個動作 book 在這裡只剩 default 加上爬梯／爬繩／趴下幾個，
 * 因為原本就是 UOL 連結到同一份圖；取不到動作 book 時退回 default 是對的。
 */
export async function fetchEffectBooks(id: number): Promise<EffectBooks> {
  let books: Record<string, MsioEffectSub[]> | undefined;
  for (const region of REGIONS) {
    const res = await fetch(`${BASE(region)}/item/${id}`);
    if (!res.ok) continue;
    const json = (await res.json()) as MsioItem | null;
    if (hasFrames(json?.effect?.framebooks)) {
      books = json!.effect!.framebooks;
      break;
    }
  }
  if (!books) throw new ItemNotAvailableError(id);

  const out: EffectBooks = {};
  for (const [book, subs] of Object.entries(books)) {
    const converted = subs
      .map((sub) =>
        (sub.frames ?? [])
          .filter((frame) => frame.image)
          .map((frame) => ({
            url: `data:image/png;base64,${frame.image}`,
            origin: frame.origin ?? { x: 0, y: 0 },
            delay: frame.delay && frame.delay > 0 ? frame.delay : 100,
          })),
      )
      .filter((frames) => frames.length > 0);
    if (converted.length > 0) out[book] = converted;
  }
  return out;
}

/** 特效的縮圖。時裝的縮圖已經烤成靜態檔（data/fashion.ts 的 fashionIconSrc） */
export const effectIconUrl = (effectId: number) => `${BASE(REGIONS[0])}/item/${effectId}/icon`;
