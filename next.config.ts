import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // 允許用區網 IP（手機／另一台電腦）連 dev server 抓 /_next/ 資源。
  // 不加的話 client JS 會被擋，畫面出得來但所有按鈕都沒反應（沒 hydration）。
  allowedDevOrigins: ["192.168.0.225", "*.local"],
};

export default nextConfig;
