# 05 — 抽卡引擎與目標判定（純邏輯）

Status: done（2026-08-20 實作完成）
Blocked by: 04

`src/app/gacha/engine.ts` — **不碰 DOM 的純函式**，方便單獨驗證。

## 抽一次

依 `prize.rate` 加權隨機選一筆。累積權重表**建一次就好**（101 筆，不要每抽都重算）。

注意：官方機率總和是 **99.97%** 不是 100%。做法是**按實際權重正規化**
（除以總和 99.97），不要補一個 0.03% 的「什麼都沒有」。理由：那 0.03% 是官方四捨五入誤差，
不是真的有空獎。

## 狀態

```ts
interface GachaState {
  pulls: number;              // 已抽次數
  spent: number;              // 已花費（NT$）
  counts: Map<number, number> // itemId → 抽到幾個
  log: number[];              // 依序記錄每次抽到的 itemId（結算用，不對外顯示逐筆）
}
```

**純 session**（Q8=A）：不寫 localStorage，不做序列化。

## 計價（Q13=B，依實際操作）

- 單抽：`+20`
- 10 連：`+180`
- 自動模式：內部以 10 連為批次，`+180`/批

## 目標判定

```ts
function goalProgress(state, goal): { done: boolean; groups: { done: boolean; have: number; need: number }[] }
```

每個 `GoalGroup` 是「`any` 裡任一 itemId 的持有量**加總** ≥ `count`」，
全部 group 都 done 才算達成。神秘任務的第 7 個 group 是 `any: [4001116, 4001115]`，
所以項鍊或衣料任一即可——這就是 OR 的實作。

## 自動模式

```ts
function autoRun(state, goal, budget): { reason: "achieved" | "budget" | "cap"; ... }
```

- 一路抽到 **達成目標** 或 **花費超過 budget** 為止
- **10,000 抽安全煞車**（`reason: "cap"`）
- 這是同步純計算（700 抽 <1ms）。**播放動畫是 06 的事**，引擎只負責一次算完並回傳結果，
  UI 再把過程「快轉播放」出來（Q10=B）。

## 明確不做（Q17=A）

**沒有任何機率計算**：不算期望值、不算 CDF、不算分佈、不算百分位。
引擎只回答「實際發生了什麼」，不回答「應該會發生什麼」。

> 未來若要加回來：驗證方法是容斥閉式 `P(n)=Σ(-1)^|S|(1-Σp)ⁿ` 對照 10 萬次蒙地卡羅，
> 小數點後三位一致即證明兩邊都對。這段留著備查，**現在不要實作**。
