# 04 — src/data/gacha.ts

Status: done（2026-08-20 實作完成）
Blocked by: 02

型別 + 查名 helper，對照 `src/data/drops.ts` 的寫法。

## 型別

```ts
type Tier = "emote" | "chair" | "bag" | "morph" | "reset" | "scroll" | "slot" | "rare";

interface Prize { itemId: number; name: string; rate: number; tier: Tier }
interface GoalGroup { any: number[]; count: number }
interface Goal { id: string; label: string; reward: string | null; groups: GoalGroup[] }
interface Ticket { itemId: number; single: number; bundle10: number }
interface GachaPool {
  eventAdId: number; title: string;
  startDate: string; endDate: string; capturedAt: string;
  ticket: Ticket; prizes: Prize[]; goals: Goal[];
}
```

## Helper

- `pools` 陣列、`currentPool()`（取 `endDate` 最新的一期）
- `prizeIcon(itemId)` → `/icons/item/<id>.png`（跟 drops.ts 共用路徑慣例）
- `TIER_META: Record<Tier, { label: string; color: string; order: number }>`
  ——稀有度的顯示名稱、翻卡光效顏色、分群排序，**單一事實來源**，UI 各處都從這裡拿
- `isExpired(pool)` → 用 `endDate` 判斷，UI 標「已結束」用

## 不要做

- 不要在這層放抽卡邏輯（那是 05）
- 不要放任何機率計算（Q17=A 全砍）
