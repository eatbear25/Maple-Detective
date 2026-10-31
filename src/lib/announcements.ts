/**
 * 網站頂部的公告列，內容來自 Google 試算表「楓探公告」，改試算表就好、不用重新部署。
 *
 * 試算表格式（第 1 列是標題，從第 2 列開始讀，由上往下＝顯示順序，新的寫最上面）：
 *   A 日期   例 2026/10/17，畫面上只印「10/17」；看不懂的格式照原樣印
 *   B 內容   必填，空白的列整列跳過
 *   C 連結   選填。站內頁面寫 /skills 這種斜線開頭的路徑，站外寫完整的 https:// 網址；
 *            其他寫法一律當作沒有連結（擋掉 javascript: 之類的東西）
 *   D 顯示   核取方塊，沒打勾（FALSE）就不顯示；整欄空白＝全部顯示
 *
 * 試算表的共用設定要是「知道連結的任何人＝檢視者」，否則讀不到（Google 回 401），
 * 公告列就整條不出現，不會讓頁面壞掉。
 *
 * 為什麼不在 layout 直接抓：layout 一抓，全站幾千個 /items/[id]、/monsters/[id] 靜態頁
 * 全部會變成每 5 分鐘重新產生一次。所以頁面維持純靜態，瀏覽器載入後再直接向 Google 拿
 * （見 src/app/announcement-bar.tsx；Google 的 CSV 匯出有開 CORS，跨網域讀得到）。
 *
 * 以前中間隔一支 /api/announcements 幫忙快取，2026-10-31 拿掉：每開一頁就打本站一次，
 * 12 小時上千次 Vercel CDN Request，而 Hobby 一個月只有 100 萬次。
 */

const SHEET_ID = "14Pbc61eMJj_goQ18XEAt6p95CC8w4CvQH9yxWPtx3vs";
const SHEET_GID = "0";
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

export interface Announcement {
  /** 已經整理成畫面要印的樣子（10/17），沒填就是空字串 */
  date: string;
  text: string;
  /** 站內路徑（/ 開頭）或 https 網址；沒有或不合法就是 null */
  href: string | null;
}

/** 最基本的 CSV 解析：吃引號包住的欄位（內容裡有逗號、換行、雙引號都行） */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function formatDate(raw: string): string {
  const m = raw.match(/^\d{4}[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : raw;
}

function safeHref(raw: string): string | null {
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

export function parseAnnouncements(csv: string): Announcement[] {
  return parseCsv(csv)
    .slice(1)
    .map((cols) => cols.map((c) => c.trim()))
    .filter(([, text, , show]) => text && show?.toUpperCase() !== "FALSE")
    .map(([date = "", text, link = ""]) => ({
      date: formatDate(date),
      text,
      href: safeHref(link),
    }));
}
