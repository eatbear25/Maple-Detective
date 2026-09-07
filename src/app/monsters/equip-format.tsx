// 裝備數值的對照表與說明文字渲染，從 item-tooltip.tsx 抽出來共用。
// 刻意「不」標 "use client"：這裡全是純資料與純函式，所以 hover 彈窗（client）
// 與 /items/[id] 詳情頁（server，內容要真的印進 HTML 給爬蟲看）能用同一份。
// 要加 state 或事件處理請加在 item-tooltip.tsx，不要加在這裡。


export const WEAPON_CATS: Record<number, string> = {
  130: "單手劍",
  131: "單手斧",
  132: "單手棍",
  133: "短劍",
  137: "短杖",
  138: "長杖",
  140: "雙手劍",
  141: "雙手斧",
  142: "雙手棍",
  143: "槍",
  144: "矛",
  145: "弓",
  146: "弩",
  147: "拳套",
  148: "指虎",
  149: "火槍",
};

export const ARMOR_CATS: Record<number, string> = {
  100: "帽子",
  101: "臉部裝飾",
  102: "眼部裝飾",
  103: "耳環",
  104: "上衣",
  105: "套服",
  106: "褲子/裙子",
  107: "鞋子",
  108: "手套",
  109: "盾牌",
  110: "披風",
  111: "戒指",
  112: "墜飾",
};

// 舊 wz attackSpeed 數值 → 遊戲內文字
export const SPEED_LABELS: Record<number, string> = {
  2: "最快",
  3: "較快",
  4: "快",
  5: "快",
  6: "普通",
  7: "慢",
  8: "較慢",
  9: "最慢",
};

// reqJob bitmask（0 = 全職業可用）
export const CLASSES: [string, number][] = [
  ["初心者", 0],
  ["劍士", 1],
  ["法師", 2],
  ["弓箭手", 4],
  ["盜賊", 8],
  ["海盜", 16],
];

// 能力加成顯示順序與遊戲內名稱
export const STAT_ROWS: [string, string][] = [
  ["incSTR", "力量"],
  ["incDEX", "敏捷"],
  ["incINT", "智力"],
  ["incLUK", "幸運"],
  ["incMHP", "HP"],
  ["incMMP", "MP"],
  ["incPAD", "攻擊力"],
  ["incMAD", "魔法攻擊力"],
  ["incPDD", "防禦力"],
  ["incMDD", "魔法防禦力"],
  ["incACC", "命中率"],
  ["incEVA", "迴避率"],
  ["incSpeed", "移動速度"],
  ["incJump", "跳躍力"],
];

/** 說明文字：#c...# → 強調色，
 → 換行 */
export function Desc({ text }: { text: string }) {
  const parts = text.split(/#c([^#]*)#/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} style={{ color: "var(--accent)" }}>
            {p}
          </span>
        ) : (
          p
        )
      )}
    </span>
  );
}
