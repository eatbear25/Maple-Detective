"use client";

import { useSyncExternalStore } from "react";
import type { MerchantPool } from "@/data/merchant";
import { emptyState, fromLog, type MerchantState } from "./engine";

/**
 * 刷新紀錄存在瀏覽器裡，重新整理不會不見（2026-10-31 改版；原本是純 session、重整歸零）。
 *
 * 用 useSyncExternalStore 而不是「掛載後在 effect 裡讀 localStorage 再 setState」，理由同
 * src/app/fashion/storage.ts。不直接用那邊的 useStored：紀錄最多 30 萬格，每次 render 都去
 * localStorage 讀一次、每刷一次就整串重新解析太浪費，這裡把解析好的狀態留在記憶體，寫入延後合併。
 *
 * 格式：{ v, pool, log }，log 一格一個字元（prize key + 0x100，落在拉丁擴充區，
 * JSON 不會跳脫、一個字元就是一個 UTF-16 單位）。換期（pool 不同）的舊紀錄直接當作沒有，
 * 因為 prize key 是當期機率表的序號，跨期對不上。
 */

const KEY = "merchant-record";
const OFFSET = 0x100;
const WRITE_DELAY = 300;

/** 伺服器端與水合當下的值。引擎只改 clone 出來的狀態，這份永遠不會被改到 */
const EMPTY = emptyState();

let snap: { pool: number; state: MerchantState } | null = null;
let pending: { pool: number; state: MerchantState } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function read(pool: MerchantPool): MerchantState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const d = JSON.parse(raw) as { v?: number; pool?: number; log?: unknown };
    if (d.v !== 1 || d.pool !== pool.eventAdId || typeof d.log !== "string") return emptyState();
    const log = new Array<number>(d.log.length);
    for (let i = 0; i < d.log.length; i++) {
      const k = d.log.charCodeAt(i) - OFFSET;
      if (k < 0 || k >= pool.prizes.length) return emptyState();
      log[i] = k;
    }
    return fromLog(log, pool.slots);
  } catch {
    return emptyState();
  }
}

function encode(log: number[]): string {
  let out = "";
  // String.fromCharCode(...30 萬個參數) 會爆堆疊，切段組
  for (let i = 0; i < log.length; i += 8192) {
    out += String.fromCharCode(...log.slice(i, i + 8192).map((k) => k + OFFSET));
  }
  return out;
}

function flush() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (!pending) return;
  const { pool, state } = pending;
  pending = null;
  try {
    if (state.refreshes === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ v: 1, pool, log: encode(state.log) }));
  } catch {
    /* 存不進去（被瀏覽器擋掉、容量滿了）就只留在記憶體，這次瀏覽期間還是能用 */
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // 同一個網站開在另一個分頁刷了，這邊也跟著換成那份
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    snap = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pagehide", flush);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", flush);
  };
}

export function useRecord(pool: MerchantPool): MerchantState {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!snap || snap.pool !== pool.eventAdId) {
        snap = { pool: pool.eventAdId, state: read(pool) };
      }
      return snap.state;
    },
    () => EMPTY,
  );
}

/** 換掉整份紀錄。state 要是新的物件（先 cloneState 再改）。 */
export function setRecord(pool: MerchantPool, state: MerchantState) {
  snap = { pool: pool.eventAdId, state };
  pending = snap;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flush, WRITE_DELAY);
  for (const notify of listeners) notify();
}
