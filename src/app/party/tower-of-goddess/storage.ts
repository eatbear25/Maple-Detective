// 女神之塔．倉庫（15 隻獨角獅的擊殺順序）。
//
// 資料來源是玩家流傳的順序表，不是拆包資料——奧爾比斯的地圖（920 那批）
// 目前完全不在客戶端裡，連地圖名稱表都查不到，所以平台位置只能照參考圖
// 重畫成「左右兩排交錯」的示意圖，不是從 foothold 座標算出來的。
// 之後遊戲更新把地圖推進客戶端，再改成真實座標。

/** 平台由上而下交錯排列：左排 8 個、右排 7 個 */
const LEFT_ORDERS = [10, 4, 5, 3, 13, 9, 14, 1];
const RIGHT_ORDERS = [15, 7, 2, 11, 6, 12, 8];

export interface Platform {
  /** 畫面上由上而下的序位，0 起算（畫版面用） */
  index: number;
  col: "left" | "right";
  /** 同一排裡由下往上數第幾個，1 起算 */
  rowInCol: number;
  /** 第幾個要打（1–15） */
  order: number;
  /** 給人唸的位置名，例："左3" */
  label: string;
}

export const STORAGE_PLATFORMS: Platform[] = (() => {
  const out: Platform[] = [];
  const max = Math.max(LEFT_ORDERS.length, RIGHT_ORDERS.length);
  for (let i = 0; i < max; i++) {
    for (const col of ["left", "right"] as const) {
      const src = col === "left" ? LEFT_ORDERS : RIGHT_ORDERS;
      if (i >= src.length) continue;
      // 玩家是從最下面的平台往上爬，所以「左1」是最底下那個，不是最上面那個
      const rowInCol = src.length - i;
      out.push({
        index: out.length,
        col,
        rowInCol,
        order: src[i],
        label: `${col === "left" ? "左" : "右"}${rowInCol}`,
      });
    }
  }
  return out;
})();

export const STORAGE_TOTAL = STORAGE_PLATFORMS.length;

/** 第 n 隻（1 起算）在哪個平台；index 0 = 第 1 隻 */
export const BY_ORDER: Platform[] = [...STORAGE_PLATFORMS].sort(
  (a, b) => a.order - b.order,
);

/** 貼到隊伍頻道用的一行文字 */
export const orderText = () =>
  `女神之塔 倉庫擊殺順序：${BY_ORDER.map((p) => p.label).join(" → ")}`;
