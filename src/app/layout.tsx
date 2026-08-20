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

export const metadata: Metadata = {
  title: "楓探 | 新楓之谷：經典版工具箱",
  description: "楓之谷攻略工具箱：怪物掉落查詢、時裝搭配等",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${baloo2.variable} ${pressStart2P.variable} ${rajdhani.variable} ${notoSansTC.variable} h-full overflow-x-hidden antialiased`}
      // 瀏覽器擴充功能會在 hydrate 前往 <html> 塞自訂屬性（speedupyoutubeads 等），只抑制此元素的屬性比對
      suppressHydrationWarning
    >
      {/* overflow-x-hidden：手機選單抽屜是 position:fixed + translate-x-full 藏到畫面外，
          但部分瀏覽器排版時還是把它算進水平捲動範圍，縮小視窗會多出一截 X 軸可以捲、
          把抽屜內容露出來。這裡直接在根層擋掉，不管哪個 fixed 元件犯規都跑不出去。 */}
      <body
        className="min-h-full flex flex-col overflow-x-hidden"
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
