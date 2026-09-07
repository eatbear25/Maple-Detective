import type { Metadata } from "next";

// 這個資料夾是任務頁的樣式原型（見 page.tsx 檔頭：定案後整個刪掉），裡面是假任務資料。
// 沒掛在 nav 上、也不在 sitemap 裡，但網址仍然對外開放，所以明確擋掉索引：
// 假資料被索引本身就是扣分，而且它會跟真的 /quests 互相競爭同一批查詢。
//
// 用 layout 而不是改 page.tsx，是因為那頁是 "use client"（client component 不能
// export metadata），而這頁是要被刪掉的原型，不值得為它多拆一層 server wrapper。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: LayoutProps<"/quests/sample">) {
  return children;
}
