import type { Metadata } from "next";
import {
  Baloo_2,
  Press_Start_2P,
  Rajdhani,
  Noto_Sans_TC,
} from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import SiteShell from "./site-shell";
import { ASSET_BASE_URL } from "@/lib/asset-base";

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const baloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const SITE_URL = "https://maple-detective.vercel.app";
const SITE_TITLE = "楓探 | 新楓之谷：經典版工具箱";
const SITE_DESCRIPTION =
  "新楓之谷經典版攻略工具箱：怪物掉落查詢、地圖導覽、技能查詢與配點模擬、任務查詢、BOSS 計時器、轉蛋模擬、時裝搭配，資料取自遊戲用戶端拆包整理。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | 楓探",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "楓探",
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
      className={`${baloo2.variable} ${pressStart2P.variable} ${rajdhani.variable} ${notoSansTC.variable} h-full overflow-x-hidden antialiased`}
      // 瀏覽器擴充功能會在 hydrate 前往 <html> 塞自訂屬性（speedupyoutubeads 等），只抑制此元素的屬性比對
      suppressHydrationWarning
    >
      {/* 圖示/世界地圖改吃外部 CDN（ASSET_BASE_URL）後，第一張圖要多做一次跨網域連線
          握手；preconnect 讓瀏覽器提早把這個握手做掉，同頁後面上百張圖沿用同一條連線。 */}
      {ASSET_BASE_URL && (
        <link rel="preconnect" href={new URL(ASSET_BASE_URL).origin} crossOrigin="" />
      )}
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
