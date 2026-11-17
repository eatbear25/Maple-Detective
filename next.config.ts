import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // 允許用區網 IP（手機／另一台電腦）連 dev server 抓 /_next/ 資源。
  // 不加的話 client JS 會被擋，畫面出得來但所有按鈕都沒反應（沒 hydration）。
  allowedDevOrigins: ["192.168.0.225", "*.local"],
  // 怪物/道具圖示、世界地圖、時裝素材都是「同一個 ID 永遠對應同一張圖」，
  // 換圖只會用新 ID，不會覆蓋舊檔案內容，所以可以放心用 immutable 長快取：
  // 同一個訪客第二次來就完全不吃 Vercel 流量，也不用每次跟伺服器確認有沒有更新。
  // 轉蛋模擬 2026-10-29 改成神秘商人模擬（遊戲把轉蛋活動換掉了），舊網址導過去
  async redirects() {
    return [{ source: "/gacha", destination: "/merchant", permanent: true }];
  },
  // iOS、一些 App 的連結預覽與爬蟲不看頁面上的 <link>，直接去要這兩個固定網址。
  // 以前沒有檔案，每次都回 30KB 的 404 頁、而且不會被快取，每次都算一次 Vercel CDN Request。
  // 圖本身是 src/app/apple-icon.png（Next 會自動在 <head> 加 apple-touch-icon 的 <link>），
  // 這裡只是讓舊網址也拿得到同一張，不另外放一份。
  async rewrites() {
    return [
      { source: "/apple-touch-icon.png", destination: "/apple-icon.png" },
      { source: "/apple-touch-icon-precomposed.png", destination: "/apple-icon.png" },
    ];
  },
  async headers() {
    return [
      {
        // brand 是首頁的偵探企鵝：要換圖請換檔名，不要覆蓋同一個檔案
        source: "/(icons|worldmap|wz-static|maps|brand)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // 分頁小圖示（src/app/icon.svg）與 iOS 主畫面圖示（src/app/apple-icon.png）。
        // Next 預設給 max-age=0，瀏覽器每開一頁都要回來問一次，12 小時就是上千次 CDN Request。
        // 頁面上的連結是 /icon.svg?icon.<內容雜湊>.svg 這種，換圖網址就會跟著變，所以可以長快取。
        source: "/:file(icon\\.svg|apple-icon\\.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // 固定網址的圖示：public/favicon.ico 與上面 rewrites 的兩個 apple-touch-icon。
        // 網址不帶雜湊，換圖後舊訪客要等快取過期才看得到新的，所以不給一年、給 30 天。
        // favicon.ico 刻意放 public/ 不放 src/app/：放 app/ 的話 Next 會在 <head> 加一個
        // sizes="any" 的 <link>，Chrome 會改抓它而不抓 icon.svg（深色模式配色就沒了），
        // 而且那個網址不帶雜湊，每開一頁都要回來問一次。
        source: "/:file(favicon\\.ico|apple-touch-icon\\.png|apple-touch-icon-precomposed\\.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
