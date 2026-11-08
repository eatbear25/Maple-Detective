"use client";

import { useCallback, useEffect, useState } from "react";
import type { Interval } from "./logic";

export interface KillRecord {
  bossId: string;
  channel: number;
  killedAt: number;
}

export type IntervalMap = Record<string, Interval>;
/** key = `${bossId}:${channel}` */
export type KillMap = Record<string, KillRecord>;

const KILLS_KEY = "boss-timer-kills";
const INTERVALS_KEY = "boss-timer-intervals";
const PINNED_KEY = "boss-timer-pinned";

export function killKey(bossId: string, channel: number) {
  return `${bossId}:${channel}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** localStorage 讀寫 + 分享用的清單狀態。SSR 安全：初始為空，掛載後才讀 localStorage。 */
export function useBossTimerState() {
  const [kills, setKills] = useState<KillMap>({});
  const [intervals, setIntervals] = useState<IntervalMap>({});
  /** 釘選的 bossId，照釘選先後排；釘選是個人偏好，不進分享連結 */
  const [pinned, setPinned] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKills(safeParse(localStorage.getItem(KILLS_KEY), {}));
    setIntervals(safeParse(localStorage.getItem(INTERVALS_KEY), {}));
    const savedPinned = safeParse<unknown>(localStorage.getItem(PINNED_KEY), []);
    setPinned(Array.isArray(savedPinned) ? savedPinned.map(String) : []);
    setLoaded(true);
  }, []);

  /** 新增/更新一筆擊殺記錄；同時可以順便更新這隻 BOSS 的重生間隔設定 */
  const upsertKill = useCallback(
    (bossId: string, channel: number, killedAt: number, interval?: Interval) => {
      setKills((prev) => {
        const next = {
          ...prev,
          [killKey(bossId, channel)]: { bossId, channel, killedAt },
        };
        localStorage.setItem(KILLS_KEY, JSON.stringify(next));
        return next;
      });
      if (interval) {
        setIntervals((prev) => {
          const next = { ...prev, [bossId]: interval };
          localStorage.setItem(INTERVALS_KEY, JSON.stringify(next));
          return next;
        });
      }
    },
    [],
  );

  /** 單獨設定某隻 BOSS 的重生間隔（不用先記一筆擊殺）；會套用到這隻 BOSS 所有頻道 */
  const setIntervalOverride = useCallback(
    (bossId: string, interval: Interval) => {
      setIntervals((prev) => {
        const next = { ...prev, [bossId]: interval };
        localStorage.setItem(INTERVALS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  /** 清掉使用者自訂的重生間隔：有預設值的 BOSS 會回到預設值，沒有的會變回「未設定」
   *  命名避開 window.clearInterval，不然在元件裡解構出來會把倒數計時用的那個蓋掉 */
  const clearIntervalOverride = useCallback((bossId: string) => {
    setIntervals((prev) => {
      const next = { ...prev };
      delete next[bossId];
      localStorage.setItem(INTERVALS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const togglePin = useCallback((bossId: string) => {
    setPinned((prev) => {
      const next = prev.includes(bossId)
        ? prev.filter((id) => id !== bossId)
        : [...prev, bossId];
      localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeKill = useCallback((bossId: string, channel: number) => {
    setKills((prev) => {
      const next = { ...prev };
      delete next[killKey(bossId, channel)];
      localStorage.setItem(KILLS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** 清掉全部擊殺記錄；重生間隔設定與釘選不動 */
  const clearKills = useCallback(() => {
    setKills({});
    localStorage.setItem(KILLS_KEY, JSON.stringify({}));
  }, []);

  /** 匯入分享連結帶來的整包清單：以分享方資料覆蓋同筆(bossId+channel / bossId)記錄 */
  const importShared = useCallback(
    (sharedKills: KillRecord[], sharedIntervals: [string, Interval][]) => {
      setKills((prev) => {
        const next = { ...prev };
        for (const k of sharedKills) next[killKey(k.bossId, k.channel)] = k;
        localStorage.setItem(KILLS_KEY, JSON.stringify(next));
        return next;
      });
      setIntervals((prev) => {
        const next = { ...prev };
        for (const [bossId, iv] of sharedIntervals) next[bossId] = iv;
        localStorage.setItem(INTERVALS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  return {
    kills,
    intervals,
    pinned,
    loaded,
    upsertKill,
    togglePin,
    removeKill,
    clearKills,
    importShared,
    setIntervalOverride,
    clearIntervalOverride,
  };
}

type SharedList = { kills: KillRecord[]; intervals: [string, Interval][] };

/*
 * 分享連結（?share=）第 2 版，2026-11-08。第 1 版是 JSON 轉 base64，一筆擊殺就要 40 個字左右，
 * 追蹤十幾個頻道複製出去就是一大串。第 2 版全部用 36 進位數字、依 BOSS 分組：
 *
 *   2.<基準>-<BOSS>-<BOSS>…
 *   BOSS = <怪物 id>[.<最短>.<最長>]_<頻道>.<擊殺時間>_<頻道>.<擊殺時間>…
 *
 * - 基準 = 最早那筆擊殺的時間（秒），每筆擊殺只記跟它差幾秒，通常 3～4 個字
 * - 最短／最長是自訂的重生間隔，單位是秒（輸入框允許小數分鐘）；沒自訂就整段省略
 * - 只用英數與 . - _：網址不用跳脫，聊天軟體自動轉連結時也不會從中間切斷
 *
 * 舊連結（base64 的 JSON，一定是 eyJ 開頭）照樣讀得懂，已經貼在聊天室裡的不會失效。
 */
const SHARE_VERSION = "2";

const b36 = (n: number) => Math.round(n).toString(36);

/** 解析 36 進位整數，格式不對就丟例外（讓 decodeShare 整串當作壞掉的連結） */
function int36(s: string | undefined): number {
  if (!s || !/^[0-9a-z]+$/.test(s)) throw new Error(`分享連結格式不對：${s}`);
  return parseInt(s, 36);
}

export function encodeShare(kills: KillMap, intervals: IntervalMap): string {
  const records = Object.values(kills);
  const sec = (r: KillRecord) => Math.round(r.killedAt / 1000);
  const base = records.length ? Math.min(...records.map(sec)) : 0;
  // BOSS id 都是怪物編號（純數字），才能轉成 36 進位
  const bossIds = new Set(
    [...records.map((r) => r.bossId), ...Object.keys(intervals)].filter((id) => /^\d+$/.test(id)),
  );
  const groups = [...bossIds].map((id) => {
    const iv = intervals[id];
    const head = b36(Number(id)) + (iv ? `.${b36(iv.min * 60)}.${b36(iv.max * 60)}` : "");
    const ks = records
      .filter((r) => r.bossId === id)
      .map((r) => `_${b36(r.channel)}.${b36(sec(r) - base)}`);
    return head + ks.join("");
  });
  return [`${SHARE_VERSION}.${b36(base)}`, ...groups].join("-");
}

function decodeV2(s: string): SharedList {
  const [header, ...groups] = s.split("-");
  const base = int36(header.split(".")[1]);
  const kills: KillRecord[] = [];
  const intervals: [string, Interval][] = [];
  for (const group of groups) {
    const [head, ...ks] = group.split("_");
    const [id, min, max] = head.split(".");
    const bossId = String(int36(id));
    if (min !== undefined) {
      intervals.push([bossId, { min: int36(min) / 60, max: int36(max) / 60 }]);
    }
    for (const k of ks) {
      const [channel, at] = k.split(".");
      kills.push({ bossId, channel: int36(channel), killedAt: (base + int36(at)) * 1000 });
    }
  }
  return { kills, intervals };
}

/** 第 1 版：{ k: [bossId, channel, killedAt][], i: [bossId, min, max][] } 轉 url-safe base64 */
function decodeV1(s: string): SharedList {
  const json = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const payload = JSON.parse(json) as {
    k: [string, number, number][];
    i: [string, number, number][];
  };
  return {
    kills: payload.k.map(([bossId, channel, killedAt]) => ({ bossId, channel, killedAt })),
    intervals: payload.i.map(([id, min, max]) => [id, { min, max }] as [string, Interval]),
  };
}

export function decodeShare(s: string): SharedList | null {
  try {
    return s.startsWith(`${SHARE_VERSION}.`) ? decodeV2(s) : decodeV1(s);
  } catch {
    return null;
  }
}
