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
  accent: string;
  accentSoft: string;
}

export const LIGHT_TOKENS: ColorTokens = {
  bg: "#FCFAF6",
  surface: "#FFFFFF",
  text: "#211F1B",
  textMuted: "#8A8272",
  border: "#EDE6D6",
  accent: "#B8791F",
  accentSoft: "#F6EDDC",
};

export const DARK_TOKENS: ColorTokens = {
  bg: "#1C1B1A",
  surface: "#242220",
  text: "#F5F1E8",
  textMuted: "#A79E8E",
  border: "#38352F",
  accent: "#D9A45C",
  accentSoft: "#3A2F1E",
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
    "--accent": tokens.accent,
    "--accent-soft": tokens.accentSoft,
  } as React.CSSProperties;
}
