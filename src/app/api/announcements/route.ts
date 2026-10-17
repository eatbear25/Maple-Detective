import { SHEET_CSV_URL, parseAnnouncements } from "@/lib/announcements";

// 靜態快取 5 分鐘：不管多少人在看，Google 試算表最多每 5 分鐘被抓一次。
// 改完試算表約 5～10 分鐘後網站上才會看到（這支的快取＋fetch 自己的快取各 5 分鐘）。
export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 300 } });
    // 試算表沒開共用時 Google 可能回 401，也可能 200 但給一頁登入畫面的 HTML，
    // 兩種都當作「沒有公告」，不能把登入頁的 HTML 當 CSV 解出一堆亂碼公告。
    if (!res.ok || !res.headers.get("content-type")?.includes("text/csv")) {
      console.error(`公告試算表讀取失敗：${res.status} ${res.headers.get("content-type")}`);
      return Response.json([]);
    }
    return Response.json(parseAnnouncements(await res.text()));
  } catch (err) {
    console.error("公告試算表讀取失敗", err);
    return Response.json([]);
  }
}
