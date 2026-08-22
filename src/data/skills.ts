// 真實技能資料（來源：遊戲用戶端 Skill/*.wzjson + 中文名稱表）。
// 產生流程：extract-skill.py → build-skill-data.py → generated/skills.json
// 圖示：public/icons/skill/<skillId>.png（來源見 reference-data/skill-icon-source.json）
import data from "./generated/skills.json";

export interface Job {
  id: string;
  name: string;
  /** 轉職階段：1~4。現行版本只到 2 轉，3/4 轉進「未來視」。 */
  tier: number;
  group: string;
  groupName: string;
  /** 前一階段職業 id，1 轉為 null */
  from: string | null;
}

/** 每級數值。欄位名沿用 wz 原始名稱，中文標籤見 LEVEL_LABELS。 */
export interface SkillLevel {
  mpCon?: number;
  hpCon?: number;
  damage?: number;
  attackCount?: number;
  mobCount?: number;
  time?: number;
  cooltime?: number;
  prop?: number;
  mastery?: number;
}

export interface Skill {
  id: string;
  job: string;
  name: string;
  /** 技能總說明（含「[等級上限：N]」開頭那行） */
  desc: string;
  /** 帶 #x 佔位符的效果總述，沒有逐級敘述時當備援 */
  h: string;
  maxLevel: number;
  /** 出廠上限（只有 4 轉精通技能有，要吃精通書才能點到 maxLevel） */
  masterLevel?: number;
  /** 前置技能 → 需要的等級 */
  req?: Record<string, number>;
  /** 每級敘述，index 0 = 1 級 */
  levelDesc: string[];
  /** 每級數值，index 0 = 1 級 */
  levels: SkillLevel[];
}

export const jobs: Job[] = data.jobs;
export const skills: Skill[] = data.skills as Skill[];

/** 現行版本 = 1 轉與 2 轉（3 轉尚未開放，見 build-skill-data.py 的說明）。 */
export const RELEASED_TIERS = [1, 2];

export const jobById: Record<string, Job> = Object.fromEntries(
  jobs.map((j) => [j.id, j]),
);
export const skillById: Record<string, Skill> = Object.fromEntries(
  skills.map((s) => [s.id, s]),
);

export function isReleased(job: string) {
  return RELEASED_TIERS.includes(jobById[job]?.tier ?? 0);
}

export function skillsOf(jobId: string) {
  return skills.filter((s) => s.job === jobId);
}

/** 該職業從 1 轉到自己的完整路線（例：112 → [100, 110, 111, 112]）。 */
export function jobPath(jobId: string): Job[] {
  const path: Job[] = [];
  let cur: Job | undefined = jobById[jobId];
  while (cur) {
    path.unshift(cur);
    cur = cur.from ? jobById[cur.from] : undefined;
  }
  return path;
}

export function skillIconSrc(id: string) {
  return `/icons/skill/${id}.png`;
}

export const LEVEL_LABELS: { key: keyof SkillLevel; label: string; unit?: string }[] = [
  { key: "mpCon", label: "MP 消耗" },
  { key: "hpCon", label: "HP 消耗" },
  { key: "damage", label: "傷害", unit: "%" },
  { key: "attackCount", label: "攻擊次數" },
  { key: "mobCount", label: "攻擊怪數" },
  { key: "time", label: "持續", unit: " 秒" },
  { key: "cooltime", label: "冷卻", unit: " 秒" },
  { key: "prop", label: "發動率", unit: "%" },
  { key: "mastery", label: "熟練度", unit: "%" },
];

/**
 * 該級要顯示的敘述。LevelDesc 缺的時候退回 H（帶 #x 佔位符的總述）——
 * 少數技能（多為 1 級技能）沒有逐級敘述。
 */
export function levelText(skill: Skill, level: number) {
  return skill.levelDesc[level - 1] || skill.h || "";
}

/** 技能說明開頭的「[等級上限：N]」在 UI 另外用徽章顯示，本文不重複。 */
export function cleanDesc(desc: string) {
  return desc.replace(/^\[[^\]]*\]\s*/, "").trim();
}
