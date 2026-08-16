/**
 * 素材來源：maplestory.io 公開 API。
 *
 * 為什麼是這裡而不是自家拆包：經典版客戶端的圖確實抽得出來（8044 張、約 99MB），
 * 但錨點資料鎖在另一種自訂二進位格式（WZSS）裡，且整包塞進 public/ 會撞破
 * Vercel Hobby 的 100MB 靜態檔上限。走 API 就完全跳過這兩件事。
 *
 * 版本策略（實測 2026-08-16）：
 * - 主要用 TMS/209 —— 台服舊版，時代最接近經典版，母體加權命中率約 90%
 * - 缺的依序退到 TWMS/256 → GMS/211.1.0 → CMS/202 → KMS/389。
 *   抽樣 80 件：前兩版缺 5 件，後三版再救回 4 件（如龍男孩髮型系列只有
 *   GMS 新版有）。經典道具的像素圖各服一致，跨版本借圖安全。
 * - 全部都沒有的（約 1%，多為延伸臉型）丟 ItemNotAvailableError，
 *   UI 顯示「無法預覽」。命中即停，備援只在缺件時多花時間。
 *
 * 注意 maplestory.io 對不存在的道具會回 **HTTP 200 + body `null`**，
 * 不是 404。只看 res.ok 會把缺件當成功，一定要檢查 frameBooks 有沒有東西。
 */

const REGIONS = ["TMS/209", "TWMS/256", "GMS/211.1.0", "CMS/202", "KMS/389"] as const;

const BASE = (region: string) => `https://maplestory.io/api/${region}`;

/** 兩個版本都查不到這件道具（不是網路錯誤，重試也沒用） */
export class ItemNotAvailableError extends Error {
  readonly itemId: number;

  constructor(itemId: number) {
    super(`素材庫沒有這件道具（#${itemId}）`);
    this.name = "ItemNotAvailableError";
    this.itemId = itemId;
  }
}

interface MsioEffect {
  image?: string;
  origin?: { x: number; y: number };
  mapOffset?: Record<string, { x: number; y: number }>;
  position?: string;
}

interface MsioFrame {
  delay?: number;
  effects?: Record<string, MsioEffect>;
}

interface MsioItem {
  frameBooks?: Record<string, { frames?: (MsioFrame | null)[] }>;
  metaInfo?: {
    islots?: string[];
    vslots?: string[];
    cash?: boolean | number;
    invisibleFace?: number;
  };
}

/** 抓單件；回傳 null 代表這個版本沒有（而不是壞掉） */
async function fetchFromRegion(region: string, id: number): Promise<MsioItem | null> {
  const res = await fetch(`${BASE(region)}/item/${id}`);
  if (!res.ok) return null;
  const json = (await res.json()) as MsioItem | null;
  if (!json?.frameBooks || Object.keys(json.frameBooks).length === 0) return null;
  return json;
}

/**
 * 把 maplestory.io 的單件 JSON 轉成 renderer 吃的 WZ 節點形狀：
 * frameBooks[動作].frames[i].effects[部件] → wz[動作][i][部件]，
 * 部件圖的 base64 轉成 data: URI（renderer 直接畫，也不會污染 canvas，
 * 下載 PNG 才不會被瀏覽器擋）。
 */
export async function fetchItemWz(imgPath: string): Promise<unknown> {
  const idMatch = /(\d{8})\.img$/.exec(imgPath);
  if (!idMatch) throw new Error(`無法從路徑取得道具 id：${imgPath}`);
  const id = Number(idMatch[1]);

  let item: MsioItem | null = null;
  for (const region of REGIONS) {
    item = await fetchFromRegion(region, id);
    if (item) break;
  }
  if (!item?.frameBooks) throw new ItemNotAvailableError(id);

  const meta = item.metaInfo ?? {};
  const info: Record<string, unknown> = {
    islot: (meta.islots ?? []).join(""),
    vslot: (meta.vslots ?? []).join(""),
    cash: meta.cash ? 1 : 0,
  };
  if (meta.invisibleFace) info.invisibleFace = 1;

  const wz: Record<string, unknown> = { info };
  for (const [action, book] of Object.entries(item.frameBooks)) {
    const actionNode: Record<string, unknown> = {};
    (book.frames ?? []).forEach((frame, index) => {
      if (!frame?.effects) return;
      const frameNode: Record<string, unknown> = {};
      if (typeof frame.delay === "number" && frame.delay > 0) {
        frameNode.delay = frame.delay;
      }
      for (const [piece, effect] of Object.entries(frame.effects)) {
        if (!effect?.image) continue; // 空影格（該 frame 沒這個部件）
        frameNode[piece] = {
          path: `data:image/png;base64,${effect.image}`,
          origin: effect.origin ?? { x: 0, y: 0 },
          map: effect.mapOffset,
          z: effect.position,
        };
      }
      if (Object.keys(frameNode).length > 0) actionNode[index] = frameNode;
    });
    if (Object.keys(actionNode).length > 0) wz[action] = actionNode;
  }
  return wz;
}

/**
 * 縮圖的備援順序另列：TWMS/256 墊底。渲染資料靠 frameBooks null 檢查擋掉
 * ID 被新道具佔用的假命中，但 icon 端點回什麼就是什麼——實測 TWMS/256 對
 * 30380（龍男孩髮型）回一張完全無關的圖，GMS/211.1.0 才是對的。
 */
const ICON_REGIONS = ["TMS/209", "GMS/211.1.0", "CMS/202", "KMS/389", "TWMS/256"] as const;

/**
 * 道具縮圖網址候選清單。縮圖的涵蓋率比渲染資料高很多（抽樣 49/50），
 * 清單即使有些件不能穿上身，圖示通常還是看得到。
 * <img onError> 逐一往後退，全部失敗才顯示空位。
 */
export const itemIconUrls = (itemId: number) =>
  ICON_REGIONS.map((region) => `${BASE(region)}/item/${itemId}/icon`);
