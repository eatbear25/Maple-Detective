// 女神之塔．封印房解算。
//
// 規則：房間有 3 個平台（左/中/右），正確答案是「每個平台該站幾個人」，
// 三個數字加起來固定是 4。NPC 每次只回一個數字：目前站法有「幾個平台
// 的人數是對的」（0 / 1 / 2，不會是 3，否則就直接過關了）。
//
// 常見開法是先做 4 次探測：全空 → 只有 1 人站左 → 只有 1 人站中 →
// 只有 1 人站右，把 4 個回應查表就得到答案。這裡不查表，直接把 15 種
// 可能解全部列出來、用回應反推，好處是：
//   1. 不用維護 15 列的 cheat sheet，也不會抄錯。
//   2. 常常不用問滿 4 次就能唯一確定（例如全空=2、站左=2 就只剩一解），
//      可以提早收工。
// （對照過玩家流傳的 cheat sheet 15 列，輸出完全一致。）

/** 平台總人數 */
export const TOTAL_PEOPLE = 4;

/** 一次探測：分別代表 4 種站法 */
export type ProbeKey = "empty" | "left" | "mid" | "right";

export const PROBES: { key: ProbeKey; label: string }[] = [
  { key: "empty", label: "全部不站" },
  { key: "left", label: "只站左" },
  { key: "mid", label: "只站中" },
  { key: "right", label: "只站右" },
];

/** NPC 的回應值 */
export type Response = 0 | 1 | 2;
export const RESPONSES: Response[] = [0, 1, 2];

export interface Solution {
  left: number;
  mid: number;
  right: number;
}

/** 某個解在指定站法下，NPC 會回幾（＝人數正確的平台數） */
function responseFor(sol: Solution, probe: ProbeKey): Response {
  const stand: Record<ProbeKey, Solution> = {
    empty: { left: 0, mid: 0, right: 0 },
    left: { left: 1, mid: 0, right: 0 },
    mid: { left: 0, mid: 1, right: 0 },
    right: { left: 0, mid: 0, right: 1 },
  };
  const s = stand[probe];
  const n =
    (s.left === sol.left ? 1 : 0) +
    (s.mid === sol.mid ? 1 : 0) +
    (s.right === sol.right ? 1 : 0);
  return n as Response;
}

/** 15 種可能的答案（三個非負整數，和為 4） */
export const ALL_SOLUTIONS: Solution[] = (() => {
  const out: Solution[] = [];
  for (let left = 0; left <= TOTAL_PEOPLE; left++) {
    for (let mid = 0; mid <= TOTAL_PEOPLE - left; mid++) {
      out.push({ left, mid, right: TOTAL_PEOPLE - left - mid });
    }
  }
  return out;
})();

export type Answers = Partial<Record<ProbeKey, Response>>;

/** 依已填的回應篩出還可能的答案；長度 1 = 已確定，0 = 回應有矛盾 */
export function candidates(answers: Answers): Solution[] {
  return ALL_SOLUTIONS.filter((sol) =>
    PROBES.every(({ key }) => {
      const a = answers[key];
      return a === undefined || responseFor(sol, key) === a;
    }),
  );
}

/** 這一列還沒填時，哪些回應值填下去有解（其餘按鈕標成不可能） */
export function feasibleResponses(
  answers: Answers,
  probe: ProbeKey,
): Set<Response> {
  const pool = candidates({ ...answers, [probe]: undefined });
  return new Set(pool.map((sol) => responseFor(sol, probe)));
}

export const formatSolution = (s: Solution) => `${s.left}-${s.mid}-${s.right}`;
