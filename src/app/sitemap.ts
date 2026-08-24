import type { MetadataRoute } from "next";
import { navItems, navHref } from "@/nav";

const SITE_URL = "https://maple-detective.vercel.app";

// party 頁面沒有掛在 nav.ts 的選單樹上（沒有入口連結、內容也是佔位假資料），
// 所以 sitemap 只收 navItems 這份「實際可從網站點得到」的清單，不用另外硬加。
export default function sitemap(): MetadataRoute.Sitemap {
  const toolPages: MetadataRoute.Sitemap = navItems.map((item) => ({
    url: `${SITE_URL}${navHref(item.path)}`,
    lastModified: new Date(),
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      priority: 1,
    },
    ...toolPages,
  ];
}
