"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 試衣間存在瀏覽器裡的個人設定（每頁幾件、最愛清單、存下來的整身搭配）。
 *
 * 用 useSyncExternalStore 而不是「掛載後在 effect 裡讀 localStorage 再 setState」：
 * 伺服器端與水合當下一律拿 fallback，水合完 React 自己會用真值重畫一次，
 * 不會 hydration 不一致，也不必在 effect 裡改 state。
 */

export const PAGE_SIZE_KEY = "fashion-page-size";
export const FAVORITES_KEY = "fashion-favorites";
export const OUTFITS_KEY = "fashion-outfits";

const listeners = new Set<() => void>();
/** localStorage 不能用（被瀏覽器設定擋掉、容量滿了）時退而存在記憶體，至少這次瀏覽期間還能用 */
const memory = new Map<string, string>();
/** getSnapshot 要回傳穩定的參照，否則 React 會無限重畫——同一段原始字串只解析一次 */
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  const kept = memory.get(key);
  if (kept !== undefined) return kept;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // 同一個網站開在另一個分頁改了，這邊也跟著更新
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * 讀寫一筆存在瀏覽器裡的設定。
 * @param fallback 沒存過、資料壞掉、或伺服器端渲染時的值（要傳固定的參照，別在 render 裡現做）
 * @param parse 把 JSON 解出來的東西驗成 T；格式不對就回 null，會改用 fallback
 */
export function useStored<T>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T | null,
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const raw = readRaw(key);
      const hit = cache.get(key);
      if (hit && hit.raw === raw) return hit.value as T;
      let parsed = fallback;
      if (raw !== null) {
        try {
          parsed = parse(JSON.parse(raw)) ?? fallback;
        } catch {
          /* 存壞的資料當作沒存過 */
        }
      }
      cache.set(key, { raw, value: parsed });
      return parsed;
    },
    () => fallback,
  );

  const set = useCallback(
    (next: T) => {
      const raw = JSON.stringify(next);
      try {
        localStorage.setItem(key, raw);
        memory.delete(key);
      } catch {
        memory.set(key, raw);
      }
      for (const notify of listeners) notify();
    },
    [key],
  );

  return [value, set];
}
