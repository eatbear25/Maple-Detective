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
    ];
  },
};

export default nextConfig;
