// 女神之塔．封印之室（跟易克對話那關）。
//
// 規則出自客戶端 String/TW/ScriptString/party3.wzjson 的易克對白：
//   - 三個踏板（左/中/右），要「剛好 5 人」站上去（#148）。隊長不站，負責跟易克講話。
//   - 正確答案是每個踏板該站幾人，加起來是 5，所以有 21 種可能。
//   - 易克只回「幾個踏板的重量正確」：0（遊戲裡的字是「所有踏板的重量都不相同」，#150/#154）
//     或 1（「1 個踏板上所承載的重量正確」，#152/#155），不然就是直接答對（#156）。
//     不會有 2——兩個踏板對了，剩下那個的人數也一定對。
//   - 7 次內沒解開會被趕出去，答案也會換（#110）。
//
// 站法照玩家流傳的那棵解法樹（巴哈、影片都是同一棵）：最多 6 次一定解開，而且每一步
// 只要動 1～2 個人，好喊。樹是寫死的，但「這一步易克可能回什麼」是拿 21 種答案逐一
// 篩出來的；樹有沒有漏分支、有沒有寫錯站法，模組載入時用同一套篩法檢查（見 build）。

/** 三個踏板的名字，順序＝左中右 */
export const PLATFORMS = ["左", "中", "右"] as const;

/** 踏板上總共要站的人數 */
export const PEOPLE = 5;

/** 幾次內要解開，超過就被趕出去 */
export const ATTEMPT_LIMIT = 7;

/** 左/中/右各站幾人 */
export type Stand = readonly [number, number, number];

/** 易克的回應：幾個踏板的重量正確（答對的話就過關了，不需要記） */
export type Reply = 0 | 1;
export const REPLIES: Reply[] = [0, 1];

export interface PlanNode {
  /** "4/1/0"，同時當 id 用（21 種站法在樹上剛好各出現一次） */
  key: string;
  stand: Stand;
  /** 第幾次嘗試，1 起算（遊戲會說「這是第 N 次嘗試」） */
  step: number;
  /** 上一步易克回了什麼才走到這裡；第一步是 null */
  via: Reply | null;
  parent: PlanNode | null;
  /** 這一步沒答對時，易克回 0 / 回 1 各該換成哪個站法；回不出來的那個就沒有 */
  next: Partial<Record<Reply, PlanNode>>;
  /** 走到這一步時還可能的答案（含這一步本身） */
  candidates: Stand[];
}

export const formatStand = (s: Stand) => s.join("/");

/** 站法 guess 對上答案 answer 時，易克會說幾個踏板正確（3 = 答對） */
function score(guess: Stand, answer: Stand) {
  return guess.filter((n, i) => n === answer[i]).length;
}

const ALL_ANSWERS: Stand[] = (() => {
  const out: Stand[] = [];
  for (let l = PEOPLE; l >= 0; l--) {
    for (let m = PEOPLE - l; m >= 0; m--) out.push([l, m, PEOPLE - l - m]);
  }
  return out;
})();

// [站法, { 易克回 0 時的下一步, 回 1 時的下一步 }]
type Plan = readonly [string, Partial<Record<Reply, Plan>>?];

const PLAN: Plan = [
  "5/0/0",
  {
    0: [
      "3/1/1",
      {
        0: ["1/2/2", { 1: ["0/3/2", { 1: ["0/2/3"] }] }],
        1: [
          "2/2/1",
          {
            0: ["1/1/3", { 1: ["0/1/4"] }],
            1: ["1/3/1", { 0: ["2/1/2"], 1: ["0/4/1"] }],
          },
        ],
      },
    ],
    1: [
      "4/1/0",
      {
        0: ["3/0/2", { 1: ["2/0/3", { 1: ["1/0/4", { 1: ["0/0/5"] }] }] }],
        1: [
          "3/2/0",
          {
            0: ["4/0/1"],
            1: ["2/3/0", { 1: ["1/4/0", { 1: ["0/5/0"] }] }],
          },
        ],
      },
    ],
  },
];

function build(
  plan: Plan,
  candidates: Stand[],
  parent: PlanNode | null,
  via: Reply | null,
): PlanNode {
  const [key, branches = {}] = plan;
  const stand = key.split("/").map(Number) as unknown as Stand;
  if (!candidates.some((c) => formatStand(c) === key)) {
    throw new Error(`封印房解法樹：${key} 在這一步已經不可能是答案`);
  }
  const node: PlanNode = {
    key,
    stand,
    step: parent ? parent.step + 1 : 1,
    via,
    parent,
    next: {},
    candidates,
  };
  for (const reply of REPLIES) {
    const rest = candidates.filter((c) => score(stand, c) === reply);
    const branch = branches[reply];
    if (rest.length > 0 && !branch) {
      throw new Error(
        `封印房解法樹：${key} 回 ${reply} 的分支沒寫（還有 ${rest.length} 種可能）`,
      );
    }
    if (rest.length === 0 && branch) {
      throw new Error(`封印房解法樹：${key} 不可能回 ${reply}，但寫了分支`);
    }
    if (branch) node.next[reply] = build(branch, rest, node, reply);
  }
  return node;
}

export const ROOT = build(PLAN, ALL_ANSWERS, null, null);

/** 所有站法，key → 節點 */
export const NODES = new Map<string, PlanNode>();
(function index(n: PlanNode) {
  NODES.set(n.key, n);
  REPLIES.forEach((r) => n.next[r] && index(n.next[r]));
})(ROOT);

if (NODES.size !== ALL_ANSWERS.length) {
  throw new Error(
    `封印房解法樹只涵蓋 ${NODES.size} / ${ALL_ANSWERS.length} 種答案`,
  );
}

/** 這棵樹最多要試幾次 */
export const MAX_STEPS = Math.max(...[...NODES.values()].map((n) => n.step));

/** 從第一步走到 node 的每一步（含 node） */
export function pathTo(node: PlanNode): PlanNode[] {
  const out: PlanNode[] = [];
  for (let n: PlanNode | null = node; n; n = n.parent) out.unshift(n);
  return out;
}

/** a 是不是 b 自己或 b 的祖先 */
export function isAncestor(a: PlanNode, b: PlanNode) {
  for (let n: PlanNode | null = b; n; n = n.parent) if (n === a) return true;
  return false;
}
