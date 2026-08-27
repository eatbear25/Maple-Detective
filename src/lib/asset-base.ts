/**
 * 靜態圖片資源（icons/worldmap）的 CDN base URL。
 *
 * 這些檔案原本放在 public/ 由 Vercel 直接發送，但數量上千（截至 2026-08 有
 * 3900+ 張），每一張圖對每個訪客都是一次 Edge Request，很快就把 Hobby 方案
 * 100 萬次配額吃光。設定 NEXT_PUBLIC_ASSET_BASE_URL（例如 jsDelivr 的
 * GitHub CDN：https://cdn.jsdelivr.net/gh/<user>/<repo>@main/public）後，
 * 這些請求改由外部 CDN 服務，完全不算進 Vercel 配額。
 *
 * 沒設定時 fallback 回空字串，走原本的本地 /public 相對路徑（本機開發用）。
 */
export const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "";
