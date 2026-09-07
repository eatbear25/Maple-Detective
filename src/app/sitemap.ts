import type { MetadataRoute } from "next";
import { navItems, navHref } from "@/nav";
import { monsters, hasItemName } from "@/data/drops";
import { sourcedItemIds } from "@/data/item-sources";

const SITE_URL = "https://maple-detective.vercel.app";

// party 頁面沒有掛在 nav.ts 的選單樹上（沒有入口連結、內容是佔位假資料，已設 noindex），
// 所以 sitemap 只收 navItems 這份「實際可從網站點得到」的清單，不用另外硬加。
//
// 詳情頁（/monsters/[id]、/items/[id]）是這份 sitemap 的主體，約 2900 筆。
// 單一 sitemap 的上限是 50,000 筆，還差得遠，不需要 generateSitemaps 分檔。
// priority 用來表達「站內相對重要性」：工具頁 > 怪物頁 > 道具頁。
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const toolPages: MetadataRoute.Sitemap = navItems.map((item) => ({
    url: `${SITE_URL}${navHref(item.path)}`,
    lastModified,
    priority: 0.8,
  }));

  const monsterPages: MetadataRoute.Sitemap = monsters.map((m) => ({
    url: `${SITE_URL}/monsters/${m.id}`,
    lastModified,
    // 未實裝的怪查的人少，權重壓低一點，把爬取預算留給現行版本的怪
    priority: m.released ? 0.7 : 0.4,
  }));

  const itemPages: MetadataRoute.Sitemap = sourcedItemIds
    .filter(hasItemName)
    .map((id) => ({
      url: `${SITE_URL}/items/${id}`,
      lastModified,
      priority: 0.5,
    }));

  return [
    {
      url: SITE_URL,
      lastModified,
      priority: 1,
    },
    ...toolPages,
    ...monsterPages,
    ...itemPages,
  ];
}
