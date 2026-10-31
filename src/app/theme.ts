"use client";

// 楓探配色定案：琥珀偵探 Amber & Ink。淺色預設、深色配對，
// 手動切換 + 預設跟隨系統（決策脈絡見 2026-08-16 對話）。

import { useEffect, useState } from "react";

export interface ColorTokens {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  /** 比 border 深一階的框線：首頁搜尋框與常用 chip 這種要「看得出是個框」的地方 */
  borderStrong: string;
  /** 圖示、框線、實心底用的琥珀色 */
  accent: string;
  /** 琥珀色的「字」。淺色版的 accent 對底色只有 3.5，小字讀起來吃力，字另外調深一階 */
  accentText: string;
  accentSoft: string;
  /** 實心 accent 底上的字色（按鈕、選中的 chip、數字徽章）。淺色是白字；深色的
   *  accent 比較亮，白字只有 2 左右的對比，要換成深色字 */
  onAccent: string;
}

// 2026-10-31 調高文字對比（首頁改版時一起做）：textMuted 原本 #8A8272，對底色只有 3.6，
// 11–13px 的說明字很吃力，改成 #6E6757（對 bg 5.4／對 accentSoft 4.8）；
// 琥珀色的字另開 accentText #8F5C17（5.4／4.9），accent 本身留給圖示與框線
export const LIGHT_TOKENS: ColorTokens = {
  bg: "#FCFAF6",
  surface: "#FFFFFF",
  text: "#211F1B",
  textMuted: "#6E6757",
  border: "#EDE6D6",
  borderStrong: "#E3D9C4",
  accent: "#B8791F",
  accentText: "#8F5C17",
  accentSoft: "#F6EDDC",
  onAccent: "#FFFFFF",
};

// 2026-10-22 調高對比（使用者回報深色模式有些地方看不清楚）：底色壓深、卡片抬亮，
// 卡片才分得出層次；邊框與次要文字調亮。目前的對比：text 17／textMuted 9.7（對 bg）、
// 8.3（對 surface）、accent 10.5、border 對 surface 1.8（舊版分別是 15／6.5／6.0／7.7／1.3）
export const DARK_TOKENS: ColorTokens = {
  bg: "#121110",
  surface: "#23201D",
  text: "#F8F4EC",
  textMuted: "#C2B9A8",
  border: "#4F4940",
  borderStrong: "#5E574C",
  accent: "#EDB86A",
  accentText: "#EDB86A",
  accentSoft: "#46381F",
  onAccent: "#1A1408",
};

const STORAGE_KEY = "maple-detective-theme-mode";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setIsDark(stored === "dark");
    } else {
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  // 同步寫到 documentElement：portal 到 document.body 的元件（例如道具 tooltip）
  // 在 DOM 樹上不是 layout.tsx 那個 themed div 的後代，讀不到只掛在該 div 上的
  // CSS 變數，背景色會直接掉成透明、露出背後內容。掛在 root 上讓全站都能繼承。
  useEffect(() => {
    const tokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;
    const vars = themeVars(tokens);
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value as string);
    }
    // data-theme 給 globals.css 的 Tailwind `dark:` 變體用（跟這個開關同步，不認系統設定）；
    // color-scheme 讓原生的下拉選單、捲軸、數字輸入框也跟著變深色
    root.dataset.theme = isDark ? "dark" : "light";
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  };

  return { isDark, toggle };
}

export function themeVars(tokens: ColorTokens): React.CSSProperties {
  return {
    "--bg": tokens.bg,
    "--surface": tokens.surface,
    "--text": tokens.text,
    "--text-muted": tokens.textMuted,
    "--border": tokens.border,
    "--border-strong": tokens.borderStrong,
    "--accent": tokens.accent,
    "--accent-text": tokens.accentText,
    "--accent-soft": tokens.accentSoft,
    "--on-accent": tokens.onAccent,
  } as React.CSSProperties;
}
