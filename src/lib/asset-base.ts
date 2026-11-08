/**
 * 靜態圖片資源（icons/worldmap）的 CDN base URL。
 *
 * 這些檔案原本放在 public/ 由 Vercel 直接發送，但數量上千（截至 2026-08 有
 * 3900+ 張），每一張圖對每個訪客都是一次 Edge Request，很快就把 Hobby 方案
 * 100 萬次配額吃光。設定 NEXT_PUBLIC_ASSET_BASE_URL 後，這些請求改由外部 CDN
 * 服務，完全不算進 Vercel 配額。
 *
 * 2026-11 起指向 GitHub Pages（.github/workflows/assets-pages.yml 把 public/ 發布過去），
 * 例：https://eatbear25.github.io/Maple-Detective（結尾不加斜線）。以前用 jsDelivr
 * （https://cdn.jsdelivr.net/gh/<user>/<repo>@main/public），但它對 GitHub 來源的實際
 * 上限是整個 repo 50MB，repo 超過之後圖片時好時壞。
 *
 * 這個值是 build 時寫死進 JS 的：在 Vercel 改了要重新部署才生效。
 *
 * 沒設定時 fallback 回空字串，走原本的本地 /public 相對路徑（本機開發用）。
 */
export const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "";
