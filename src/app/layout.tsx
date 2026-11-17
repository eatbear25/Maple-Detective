import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import SiteShell from "./site-shell";
import { ASSET_BASE_URL } from "@/lib/asset-base";
import {
  BASE_OPEN_GRAPH,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  TITLE_TEMPLATE,
} from "@/lib/site-metadata";

// Noto Sans TC 直接向 Google Fonts 要，不用 next/font：next/font 會把字型檔放到本站
// /_next/static/media 自己發，中文字型又被切成上百片，一個新訪客要抓三四十片，
// 每片都算一次 Vercel CDN Request（2026-10-30 實測佔全部請求的三成）。
// 同一套字型、同樣的切片，只是改由 Google 發。
const NOTO_SANS_TC_CSS =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap";

// 這裡的 openGraph／twitter 只給首頁用。其他頁面一定要走 pageMetadata()，
// 只寫 title 的話分享預覽會整包繼承這份（標題永遠是首頁的），見 site-metadata.ts。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    ...BASE_OPEN_GRAPH,
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  verification: {
    google: "lG7oSqTaf7CHtR8dq8PPfnSBmuZ3bwkz_KN7ZxMr6Ug",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className="h-full overflow-x-hidden antialiased"
      // 瀏覽器擴充功能會在 hydrate 前往 <html> 塞自訂屬性（speedupyoutubeads 等），只抑制此元素的屬性比對
      suppressHydrationWarning
    >
      {/* 圖示/世界地圖改吃外部 CDN（ASSET_BASE_URL）後，第一張圖要多做一次跨網域連線
          握手；preconnect 讓瀏覽器提早把這個握手做掉，同頁後面上百張圖沿用同一條連線。 */}
      {ASSET_BASE_URL && (
        <link rel="preconnect" href={new URL(ASSET_BASE_URL).origin} crossOrigin="" />
      )}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={NOTO_SANS_TC_CSS} precedence="default" />
      {/* overflow-x-hidden 只掛在 <html> 一層：手機選單抽屜是 position:fixed +
          translate-x-full 藏到畫面外，但部分瀏覽器排版時還是把它算進水平捲動範圍，
          縮小視窗會多出一截 X 軸可以捲、把抽屜內容露出來，這裡把它擋掉。
          body 不能重複套一樣的 class——只設 overflow-x 會被 CSS 規範自動把
          overflow-y 轉成 auto，html 和 body 兩層同時變成獨立的捲動容器，
          子孫的 position:sticky 就會抓到「不會真的捲動」的 body 當基準而整個失效
          （2026-08-24 skill-build 配點面板不會吸附就是這個坑）。 */}
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "system-ui, 'Microsoft JhengHei', sans-serif" }}
      >
        <SiteShell>{children}</SiteShell>
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
