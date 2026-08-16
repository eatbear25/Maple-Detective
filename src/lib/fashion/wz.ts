/**
 * 素材資料層 facade：renderer 只跟這裡講話。
 *
 * 兩個來源：
 * - 身體/頭、zmap（圖層順序）、smap（部位遮蔽）走 /wz-static/（隨站部署，1.3MB）。
 *   maplestory.io **沒有**身體與頭的原始資料（實測 TMS/209、TWMS/256、GMS/62 打
 *   item/2000 一律回 null），所以這一小包非自己帶不可。
 * - 其餘道具走 maplestory.io（見 ./msio.ts）。
 */
import { fetchItemWz as fetchFromMsio } from "./msio";

const STATIC_BASE = "/wz-static";

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
// maplestory.io 的單件 JSON 內嵌 base64 圖，很肥（中位數 132KB，武器可到數 MB），
// 快取上限開小一點免得吃爆記憶體
const itemCache = new Map<string, Promise<unknown>>();

/** 道具 .img 結構（動作/frame/部件） */
export function fetchItemWz(imgPath: string): Promise<unknown> {
  if (BODY_HEAD_RE.test(imgPath)) {
    return cachedPromise(bodyHeadCache, imgPath, 40, () =>
      fetchStaticJson(`${STATIC_BASE}/json/${pathToFile(imgPath)}.json`),
    );
  }
  return cachedPromise(itemCache, imgPath, 40, () => fetchFromMsio(imgPath));
}

/** 部件圖網址。maplestory.io 的部件圖已經是 data: URI，原樣回傳 */
export function imageUrl(nodePath: string): string {
  if (nodePath.startsWith("data:")) return nodePath;
  if (BODY_HEAD_IMAGE_RE.test(nodePath)) {
    return encodeURI(`${STATIC_BASE}/images/${pathToFile(nodePath)}.webp`);
  }
  return nodePath;
}
