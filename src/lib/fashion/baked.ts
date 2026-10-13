/**
 * 時裝素材：`tools/fetch-fashion-assets.py` 預先烤好的靜態檔，一件一檔
 * （`public/wz-static/fashion/v1/<id>.json`）。
 *
 * 為什麼不在瀏覽器直接打 maplestory.io（2026-10-13 以前是那樣）：
 * - 那個 API 單次中位數 1.3 秒、4.6% 的請求超過 10 秒、最長卡 60 秒，試衣間
 *   因此常常停在「合成中」。
 * - 回應極肥：每個影格各帶一份 base64 圖，髮型 284KB、最大的武器 26MB。
 *   烤的時候把重複的圖去掉、併成一張圖集，髮型只剩 2KB。
 * - 各服的道具 ID 會撞（30570 在 GMS 是另一顆頭）。執行期備援是「有東西就用」，
 *   會畫錯；現在抓的當下就拿客戶端的座標驗過，對不上的不收。
 *
 * 所以這裡不會有「這件素材庫沒有」的情況——哪幾件沒圖，catalog 早就知道
 * （`FashionItem.preview`），清單上直接標出來，不會讓人點了才發現。
 * 會失敗的只剩網路問題。
 *
 * 檔案格式（跟 Python 那邊的 `bake()` 是同一份約定）：
 *   info   islot / vslot / invisibleFace（取自客戶端，不是 maplestory.io）
 *   atlas  去重後的部件圖併成一張，lossless WebP 的 base64
 *   s      每張部件圖在圖集裡的 [x, y, w, h]
 *   pc     部件定義 [圖編號, origin.x, origin.y, 圖層名, 錨點表]，一樣去重
 *   act    動作 → 逐格 → { 部件名: pc 編號 }；整格沒東西是 null
 */
import { ASSET_BASE_URL } from "@/lib/asset-base";

/** 目錄名帶格式版本，跟 fetch-fashion-assets.py 的 FORMAT 一起改 */
const DIR = "/wz-static/fashion/v1";

/**
 * 先問 CDN，不行就退回本站同一路徑（檔案本來就跟著站一起部署在 public/）。
 *
 * 需要這層是因為 jsDelivr 把 `@main` 解析成哪個 commit 會快取 12 小時：新烤的檔案
 * 推上去之後，CDN 可能半天都還回 404。沒有備援的話，每次補新時裝上線，試衣間
 * 就會壞到 CDN 更新為止。
 */
const SOURCES = ASSET_BASE_URL ? [ASSET_BASE_URL, ""] : [""];

type Rect = [x: number, y: number, w: number, h: number];

type BakedPiece = [
  sprite: number,
  originX: number,
  originY: number,
  layer: string | null,
  anchors: Record<string, [number, number]> | null,
];

interface BakedItem {
  info: { islot: string; vslot: string; cash: number; invisibleFace?: number };
  atlas: string;
  s: Rect[];
  pc: BakedPiece[];
  act: Record<string, (Record<string, number> | null)[]>;
}

function decodeAtlas(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("時裝圖集解碼失敗"));
    // data: URI 不算跨來源，畫上 canvas 之後照樣能匯出下載
    img.src = `data:image/webp;base64,${base64}`;
  });
}

/**
 * 抓一件時裝，轉成 renderer 吃的 WZ 節點形狀：
 * wz[動作][格][部件] = { image, rect, origin, map, z }。
 * 同一個部件定義在各格之間共用同一個物件（髮型 13 個動作其實只有 4 種部件）。
 */
async function fetchBaked(id: number): Promise<BakedItem> {
  let reason = "";
  for (const base of SOURCES) {
    try {
      const res = await fetch(`${base}${DIR}/${id}.json`);
      if (res.ok) return (await res.json()) as BakedItem;
      reason = `HTTP ${res.status}`;
    } catch (err) {
      reason = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`時裝素材載入失敗（${reason}）：#${id}`);
}

export async function fetchBakedItemWz(id: number): Promise<unknown> {
  const baked = await fetchBaked(id);
  if (!baked.atlas) return { info: baked.info };

  const image = await decodeAtlas(baked.atlas);
  const pieces = baked.pc.map(([sprite, x, y, layer, anchors]) => ({
    image,
    rect: baked.s[sprite],
    origin: { x, y },
    // 沒有 map 與「空的 map」renderer 的處理不同（前者退回 navel），照原樣交出去
    map:
      anchors === null
        ? undefined
        : Object.fromEntries(
            Object.entries(anchors).map(([name, [ax, ay]]) => [name, { x: ax, y: ay }]),
          ),
    z: layer ?? undefined,
  }));

  const wz: Record<string, unknown> = { info: baked.info };
  for (const [action, frames] of Object.entries(baked.act)) {
    const actionNode: Record<string, unknown> = {};
    frames.forEach((frame, index) => {
      if (!frame) return;
      actionNode[index] = Object.fromEntries(
        Object.entries(frame).map(([name, pieceIndex]) => [name, pieces[pieceIndex]]),
      );
    });
    wz[action] = actionNode;
  }
  return wz;
}
