/**
 * 素材資料層 facade：renderer 只跟這裡講話。
 *
 * 三個來源：
 * - 身體/頭、zmap（圖層順序）、smap（部位遮蔽）走 /wz-static/（隨站部署，1.3MB）。
 *   maplestory.io **沒有**身體與頭的原始資料（實測 TMS/209、TWMS/256、GMS/62 打
 *   item/2000 一律回 null），所以這一小包非自己帶不可。
 * - 時裝走預先烤好的靜態檔 /wz-static/fashion/v1/，道具特效層在 fx-v1/（見 ./baked.ts）。
 * - 特效還是執行期打 maplestory.io（見 ./msio.ts）。
 */
import { fetchBakedItemWz, fetchItemEffect as fetchBakedItemEffect, type ItemEffect } from "./baked";
import { fetchEffectBooks as fetchEffectFromMsio, type EffectBooks } from "./msio";
import { ASSET_BASE_URL } from "@/lib/asset-base";

const STATIC_BASE = `${ASSET_BASE_URL}/wz-static`;

/** 身體/頭的 .img 路徑（直接在 Character/ 下，沒有部位子目錄） */
const BODY_HEAD_RE = /^Character\/000[01]2\d{3}\.img$/;
/** 身體/頭的部件圖連結（打包在 /wz-static/images） */
const BODY_HEAD_IMAGE_RE = /^Character\/_Canvas\/000[01]2\d{3}\.img\//;

/** WZ 節點路徑 → 檔案相對路徑（與抽取工具的命名一致） */
const pathToFile = (nodePath: string) => nodePath.replace(/[<>:"|?*\\]/g, "_");

async function fetchStaticJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`共用素材載入失敗 (HTTP ${res.status})：${url}`);
  return res.json();
}

/** 快取 helper：失敗不留快取，之後重試才有機會成功 */
function cachedPromise<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  limit: number,
  create: () => Promise<T>,
): Promise<T> {
  let cached = cache.get(key);
  if (!cached) {
    cached = create().catch((err) => {
      cache.delete(key);
      throw err;
    });
    if (cache.size >= limit) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, cached);
  }
  return cached;
}

let mappingCache: Promise<{ zmap: string[]; smap: Record<string, string> }> | null = null;

/** zmap（圖層順序）與 smap（部位遮蔽表） */
export function fetchMappings() {
  if (!mappingCache) {
    mappingCache = Promise.all([
      fetchStaticJson<string[]>(`${STATIC_BASE}/mapping/zmap.json`),
      fetchStaticJson<Record<string, string>>(`${STATIC_BASE}/mapping/smap.json`),
    ])
      .then(([zmap, smap]) => ({ zmap, smap }))
      .catch((err) => {
        mappingCache = null;
        throw err;
      });
  }
  return mappingCache;
}

const bodyHeadCache = new Map<string, Promise<unknown>>();
// 烤過的時裝一件只有幾 KB（去重後的圖集），留多一點，換來換去才不用重抓
const itemCache = new Map<string, Promise<unknown>>();
const ITEM_ID_RE = /(\d{8})\.img$/;

/** 道具 .img 結構（動作/frame/部件） */
export function fetchItemWz(imgPath: string): Promise<unknown> {
  if (BODY_HEAD_RE.test(imgPath)) {
    return cachedPromise(bodyHeadCache, imgPath, 40, () =>
      fetchStaticJson(`${STATIC_BASE}/json/${pathToFile(imgPath)}.json`),
    );
  }
  const id = ITEM_ID_RE.exec(imgPath);
  if (!id) return Promise.reject(new Error(`無法從路徑取得道具 id：${imgPath}`));
  return cachedPromise(itemCache, imgPath, 300, () => fetchBakedItemWz(Number(id[1])));
}

const itemEffectCache = new Map<string, Promise<ItemEffect>>();

/** 時裝的道具特效層（只有 catalog 標了 fx 的才有） */
export function fetchItemEffect(id: number): Promise<ItemEffect> {
  return cachedPromise(itemEffectCache, String(id), 40, () => fetchBakedItemEffect(id));
}

const effectCache = new Map<string, Promise<EffectBooks>>();

/** 特效道具的圖（0501 段），只有 maplestory.io 有 */
export function fetchEffectBooks(effectId: number): Promise<EffectBooks> {
  return cachedPromise(effectCache, String(effectId), 10, () =>
    fetchEffectFromMsio(effectId),
  );
}

/** 部件圖網址（身體／頭、特效用；時裝的圖是圖集裡的一塊，不走這裡）。data: URI 原樣回傳 */
export function imageUrl(nodePath: string): string {
  if (nodePath.startsWith("data:")) return nodePath;
  if (BODY_HEAD_IMAGE_RE.test(nodePath)) {
    return encodeURI(`${STATIC_BASE}/images/${pathToFile(nodePath)}.webp`);
  }
  return nodePath;
}
