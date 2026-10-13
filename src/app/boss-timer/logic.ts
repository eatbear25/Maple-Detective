import type { BossDef } from "@/data/bosses";
import type { IntervalMap } from "./storage";

export interface Interval {
  min: number;
  max: number;
}

/** 有效重生間隔：使用者自訂覆蓋優先，沒有的話退回 BOSS 預設值，兩者都沒有就回傳 null */
export function effectiveInterval(
  bossId: string,
  intervals: IntervalMap,
  defsById: Record<string, BossDef>,
): Interval | null {
  const override = intervals[bossId];
  if (override) return override;
  const def = defsById[bossId];
  if (def?.defaultRespawnMin != null) {
    return {
      min: def.defaultRespawnMin,
      max: def.defaultRespawnMax ?? def.defaultRespawnMin,
    };
  }
  return null;
}

/** 重生時間能不能讓使用者改：有固定重生時間的 BOSS 不開放（畫面上不出現筆）。
 *  例外是舊版留下、跟預設值不一樣的自訂值——要留一條路讓人按「恢復預設」，不然會卡死在舊值 */
export function canEditInterval(boss: BossDef, intervals: IntervalMap): boolean {
  if (boss.defaultRespawnMin == null) return true;
  const override = intervals[boss.id];
  if (!override) return false;
  const defaultMax = boss.defaultRespawnMax ?? boss.defaultRespawnMin;
  return override.min !== boss.defaultRespawnMin || override.max !== defaultMax;
}

export function respawnRange(killedAt: number, interval: Interval) {
  return {
    minTime: killedAt + interval.min * 60_000,
    maxTime: killedAt + interval.max * 60_000,
  };
}

/** ms 差距 → "1:23:45" 或 "23:45" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** <input type="datetime-local"> 用的本地時間字串 */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(s: string): number {
  return new Date(s).getTime();
}
