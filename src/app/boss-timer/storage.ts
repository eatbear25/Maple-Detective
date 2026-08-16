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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKills(safeParse(localStorage.getItem(KILLS_KEY), {}));
    setIntervals(safeParse(localStorage.getItem(INTERVALS_KEY), {}));
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

  /** 清掉使用者自訂的重生間隔（只有沒有官方固定值的 BOSS 才需要這個，清掉後卡片會變回「重生時間未設定」）
   *  命名避開 window.clearInterval，不然在元件裡解構出來會把倒數計時用的那個蓋掉 */
  const clearIntervalOverride = useCallback((bossId: string) => {
    setIntervals((prev) => {
      const next = { ...prev };
      delete next[bossId];
      localStorage.setItem(INTERVALS_KEY, JSON.stringify(next));
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
    loaded,
    upsertKill,
    removeKill,
    importShared,
    clearIntervalOverride,
  };
}

interface SharePayload {
  /** [bossId, channel, killedAt][] */
  k: [string, number, number][];
  /** [bossId, min, max][] */
  i: [string, number, number][];
}

/** 分享連結的 payload 全是數字/數字字串，沒有中文，直接 base64（url-safe）就好 */
export function encodeShare(kills: KillMap, intervals: IntervalMap): string {
  const payload: SharePayload = {
    k: Object.values(kills).map((r) => [r.bossId, r.channel, r.killedAt]),
    i: Object.entries(intervals).map(([id, iv]) => [id, iv.min, iv.max]),
  };
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(
  s: string,
): { kills: KillRecord[]; intervals: [string, Interval][] } | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    const payload = JSON.parse(json) as SharePayload;
    return {
      kills: payload.k.map(([bossId, channel, killedAt]) => ({
        bossId,
        channel,
        killedAt,
      })),
      intervals: payload.i.map(
        ([id, min, max]) => [id, { min, max }] as [string, Interval],
      ),
    };
  } catch {
    return null;
  }
}
