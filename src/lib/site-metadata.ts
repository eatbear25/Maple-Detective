import type { Metadata } from "next";

export const SITE_URL = "https://maple-detective.vercel.app";
export const SITE_NAME = "楓探";
export const SITE_TITLE = "楓探 | 新楓之谷：經典版工具箱";
export const SITE_DESCRIPTION =
  "新楓之谷經典版攻略工具箱：怪物掉落查詢、地圖導覽、技能查詢與配點模擬、任務查詢、BOSS 計時器、神秘商人模擬、時裝搭配，資料取自遊戲用戶端拆包整理。";

/** 根 layout 的 title.template，pageMetadata 的分享標題也照這個格式 */
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

/** 全站共用的 openGraph 欄位，各頁覆寫 openGraph 時要一起帶上 */
export const BASE_OPEN_GRAPH = {
  locale: "zh_TW",
  siteName: SITE_NAME,
} as const;

/**
 * 每一頁的 metadata 都走這支，**不要只寫 title / description**。
 *
 * Next.js 的 metadata 是「淺層」合併：頁面沒寫 openGraph／twitter 的話，會整包繼承
 * 根 layout 的那份，而那份的標題寫死是首頁標題。Discord、LINE、FB 貼連結時讀的是
 * og:title／og:description，不是 <title>，所以以前不管分享哪一頁，預覽卡片都是
 * 「楓探 | 新楓之谷：經典版工具箱」（2026-11-17 站長回報）。反過來，頁面一寫
 * openGraph 就會把根 layout 的整包蓋掉（siteName、locale 一起不見），所以共用欄位
 * 也要在這裡補回去。
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  /** 站內路徑，例："/merchant" */
  path: string;
  type?: "website" | "article";
}): Metadata {
  const shareTitle = TITLE_TEMPLATE.replace("%s", title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...BASE_OPEN_GRAPH,
      type,
      title: shareTitle,
      description,
      url: path,
    },
    twitter: {
      card: "summary",
      title: shareTitle,
      description,
    },
  };
}
