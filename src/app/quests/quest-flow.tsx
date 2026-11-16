"use client";

// 任務流程卡片：把有前後關聯的任務整串畫出來（以前叫任務鏈，照系列名切段，前後會斷掉）。
// 資料是 build-quest-data.py 排好的「主線＋分岔框」，這裡只負責畫與標出目前這一步。
// 主線每一步一個編號圓圈，圓圈之間一條直線串起來；分岔用框：
//   都要完成／擇一／各自獨立 → 框本身佔一個編號
//   另外也要完成／支線       → 不編號，縮排掛在直線旁邊
// 每個任務名底下有一行摘要（要打什麼、繳什麼 → 給什麼），整條流程不用一步一步點進去看
// （2026-11-16 加，站長拿參考站比：它一個頁面就列完整條任務線每一步的條件與獎勵）。

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Telescope } from "lucide-react";
import {
  questById,
  questItemName,
  questMobName,
  questSkillName,
  type FlowBlock,
  type FlowKind,
  type Quest,
} from "@/data/quests";

const lvLabel = (lv: number) => (lv > 0 ? `Lv.${lv}` : "無限制");

const num = (n: number) => n.toLocaleString("en-US");

/** 清單接成「甲、乙、丙」，超過 max 樣就收成「等 N 樣」（獎勵有 16 張卷軸的任務會把整列撐爆） */
function joinSome(names: string[], max: number) {
  return names.length > max
    ? `${names.slice(0, max).join("、")} 等 ${names.length} 樣`
    : names.join("、");
}

/**
 * 一步的摘要：「打 蝙蝠×40・繳 蝙蝠翅膀×50 → 經驗 2,500、紅色藥水×5」。
 * 條件全列（那是玩家要準備的東西，不能省），獎勵道具最多列 3 樣。
 * 沒有結構化資料的任務（條件與獎勵都在伺服器端腳本）回 null，那一列就只有任務名。
 */
function stepSummary(q: Quest): { todo: string; reward: string } | null {
  const todo = [
    q.kill?.length
      ? `打 ${q.kill.map((m) => `${questMobName(m.id)}×${m.n}`).join("、")}`
      : "",
    q.need.length
      ? `繳 ${q.need.map((i) => `${questItemName(i.id)}×${num(i.n)}`).join("、")}`
      : "",
    q.cost ? `付 ${num(q.cost)} 楓幣` : "",
  ]
    .filter(Boolean)
    .join("・");
  const reward = [
    q.exp ? `經驗 ${num(q.exp)}` : "",
    q.money ? `${num(q.money)} 楓幣` : "",
    q.pop ? `名聲 +${q.pop}` : "",
    // 同名的只留一個：男女版、各職業版的獎勵是不同 id 但名字一樣
    // （#2084 轉達飛天藥水會印成三件「伊卡路斯披風」）
    joinSome(
      [
        ...new Set([
          ...(q.skills ?? []).map((s) => questSkillName(s.id)),
          ...q.rewards.map((i) => `${questItemName(i.id)}${i.n > 1 ? `×${num(i.n)}` : ""}`),
        ]),
      ],
      3,
    ),
  ]
    .filter(Boolean)
    .join("、");
  return todo || reward ? { todo, reward } : null;
}

/** 任務名底下那行摘要。可以換行、不截斷：截掉的話又得點進去看，等於沒做 */
function Summary({ q }: { q: Quest }) {
  const s = stepSummary(q);
  if (!s) return null;
  return (
    <span className="mt-0.5 block text-xs font-normal leading-snug text-[var(--text-muted)]">
      {s.todo}
      {s.todo && s.reward ? " → " : s.reward ? "→ " : ""}
      {s.reward}
    </span>
  );
}

const KIND_LABEL: Record<FlowKind, (n: number) => string> = {
  all: () => "都要完成，順序不拘",
  one: () => "擇一",
  split: (n) => `分成 ${n} 條，各自獨立`,
  also: () => "另外也要完成",
  side: () => "支線",
};

const isStep = (b: FlowBlock) => typeof b === "string" || !["also", "side"].includes(b.k);

function idsOf(blocks: FlowBlock[]): string[] {
  return blocks.flatMap((b) => (typeof b === "string" ? [b] : b.lines.flatMap(idsOf)));
}

/** 目前任務在主線的第幾步；在支線框裡回 null */
function stepOf(flow: FlowBlock[], id: string): number | null {
  let n = 0;
  for (const b of flow) {
    if (isStep(b)) n++;
    if (idsOf([b]).includes(id)) {
      return isStep(b) ? n : null;
    }
  }
  return null;
}

export function QuestFlowCard({
  flow,
  q,
  onPick,
}: {
  flow: FlowBlock[];
  q: Quest;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const boxRef = useRef<HTMLOListElement>(null);
  const steps = flow.filter(isStep).length;
  const total = idsOf(flow).length;
  const step = stepOf(flow, q.id);

  /* 長流程（萬聖節 74 個任務）會捲動，切換任務時把目前這步捲到框的中間。
     不用 scrollIntoView：它會連整頁一起捲。 */
  useEffect(() => {
    const box = boxRef.current;
    const el = box?.querySelector<HTMLElement>("[data-current]");
    if (!box || !el || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
  }, [q.id, open]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent-soft)]/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{q.series ?? "任務流程"}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {step != null ? `第 ${step} / ${steps} 步` : "支線"}
            {total > steps && `・共 ${total} 個任務`}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <ol
          ref={boxRef}
          className="themed-scroll max-h-[60vh] space-y-1.5 overflow-y-auto border-t border-[var(--border)] p-3"
        >
          {(() => {
            let n = 0;
            return flow.map((b, i) => {
              const num = isStep(b) ? ++n : null;
              return (
                <li key={typeof b === "string" ? b : `g${i}`} className="relative">
                  {/* 主線的直線：穿過每個編號圓圈的中心（x = 邊框 1 + 內距 12 + 半徑 12），
                      往上蓋住跟前一塊之間的空隙；第一塊從圓圈開始、最後一塊停在圓圈。
                      小卡與圓圈都有底色，會蓋住線，所以框旁邊才看得到線經過 */}
                  <span
                    className="absolute left-[24px] w-px bg-[var(--border)]"
                    style={{
                      top: i === 0 ? 18 : -6,
                      bottom: i === flow.length - 1 ? "calc(100% - 18px)" : 0,
                    }}
                  />
                  {typeof b === "string" ? (
                    <MainRow id={b} num={num!} cur={q} onPick={onPick} />
                  ) : num != null ? (
                    <div className="flex items-start gap-3 pl-[13px]">
                      <StepDot num={num} active={idsOf([b]).includes(q.id)} />
                      <FlowBox block={b} cur={q} onPick={onPick} />
                    </div>
                  ) : (
                    <div className="pl-[49px]">
                      <FlowBox block={b} cur={q} onPick={onPick} />
                    </div>
                  )}
                </li>
              );
            });
          })()}
        </ol>
      )}
    </div>
  );
}

function StepDot({ num, active }: { num: number; active: boolean }) {
  return (
    <span
      className="relative mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
      style={
        active
          ? { background: "var(--accent)", color: "var(--on-accent)" }
          : { background: "var(--accent-soft)", color: "var(--accent-text)" }
      }
    >
      {num}
    </span>
  );
}

/** 跟目前任務互斥（接過一個就不能接另一個） */
const exclusiveWith = (a: Quest, b: Quest) =>
  !!(a.exclude?.includes(b.id) || b.exclude?.includes(a.id));

function Badges({ q, cur, inChoice }: { q: Quest; cur: Quest; inChoice?: boolean }) {
  return (
    <>
      {/* 擇一框裡已經寫了「擇一」，每列再標一次是重複 */}
      {!inChoice && q.id !== cur.id && exclusiveWith(q, cur) && (
        <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 text-[10px] font-normal text-[var(--text-muted)]">
          擇一
        </span>
      )}
      {!q.released && <Telescope size={11} className="shrink-0 text-[var(--text-muted)]" />}
    </>
  );
}

/** 主線上的一步：跟以前任務鏈的節點長得一樣（編號圓圈＋小卡） */
function MainRow({
  id,
  num,
  cur,
  onPick,
}: {
  id: string;
  num: number;
  cur: Quest;
  onPick: (id: string) => void;
}) {
  const q = questById(id);
  if (!q) return null;
  const isCur = q.id === cur.id;
  return (
    <button
      onClick={() => onPick(q.id)}
      data-current={isCur || undefined}
      className={`cursor-pointer relative flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        isCur
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)]"
      }`}
    >
      {/* -mt-0.5：列改成靠上對齊後，圓圈中心要留在離頂端 18px（主線直線算的就是這個位置） */}
      <span
        className="-mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={
          isCur
            ? { background: "var(--accent)", color: "var(--on-accent)" }
            : { background: "var(--accent-soft)", color: "var(--accent-text)" }
        }
      >
        {num}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-1 text-sm ${isCur ? "font-semibold" : ""}`}>
          <span className="truncate">{q.name}</span>
          <Badges q={q} cur={cur} />
        </span>
        <Summary q={q} />
      </span>
      <span className="mt-0.5 shrink-0 text-xs text-[var(--text-muted)]">{lvLabel(q.lv)}</span>
    </button>
  );
}

/**
 * 分岔框。框裡每一條線一段，線與線之間細線隔開；
 * 同一條線裡的任務用小圓點＋細直線串起來（有先後順序）。
 * 支線框（also／side）用虛線框，視覺上比主線輕一階。
 */
function FlowBox({
  block,
  cur,
  onPick,
}: {
  block: Exclude<FlowBlock, string>;
  cur: Quest;
  onPick: (id: string) => void;
}) {
  const aside = block.k === "also" || block.k === "side";
  return (
    <div
      className={`min-w-0 flex-1 rounded-lg border bg-[var(--bg)] px-2 py-1.5 ${
        aside ? "border-dashed border-[var(--border)]" : "border-[var(--border)]"
      }`}
    >
      <div className="px-1 pb-1 text-[11px] font-semibold text-[var(--text-muted)]">
        {KIND_LABEL[block.k](block.lines.length)}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {block.lines.map((line, i) => (
          <div key={i} className="py-0.5">
            <FlowLine line={line} cur={cur} onPick={onPick} inChoice={block.k === "one"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowLine({
  line,
  cur,
  onPick,
  inChoice,
}: {
  line: FlowBlock[];
  cur: Quest;
  onPick: (id: string) => void;
  inChoice?: boolean;
}) {
  return (
    <div>
      {line.map((b, i) =>
        typeof b === "string" ? (
          <SubRow
            key={b}
            id={b}
            cur={cur}
            onPick={onPick}
            inChoice={inChoice}
            joinUp={i > 0}
            joinDown={i < line.length - 1}
          />
        ) : (
          // 框裡又分岔（目前只有食人花果汁那條）：縮一格再畫一個框
          <div key={`g${i}`} className="py-1 pl-4">
            <FlowBox block={b} cur={cur} onPick={onPick} />
          </div>
        ),
      )}
    </div>
  );
}

function SubRow({
  id,
  cur,
  onPick,
  inChoice,
  joinUp,
  joinDown,
}: {
  id: string;
  cur: Quest;
  onPick: (id: string) => void;
  inChoice?: boolean;
  joinUp: boolean;
  joinDown: boolean;
}) {
  const q = questById(id);
  if (!q) return null;
  const isCur = q.id === cur.id;
  return (
    <button
      onClick={() => onPick(q.id)}
      data-current={isCur || undefined}
      className={`cursor-pointer relative flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors ${
        isCur ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]/40"
      }`}
    >
      {/* 同一條線裡前後兩個任務之間的細直線。列高會隨摘要變動，所以線以小圓點的中心
          （上內距 6 + 第一行行高 20 的一半 = 16px）為界，不能再用 50% */}
      {joinUp && <span className="absolute left-[9px] top-0 h-4 w-px bg-[var(--border)]" />}
      {joinDown && <span className="absolute bottom-0 left-[9px] top-4 w-px bg-[var(--border)]" />}
      <span
        className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: isCur ? "var(--accent)" : "var(--text-muted)", opacity: isCur ? 1 : 0.45 }}
      />
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-1 text-sm ${isCur ? "font-semibold" : ""}`}>
          <span className="truncate">{q.name}</span>
          <Badges q={q} cur={cur} inChoice={inChoice} />
        </span>
        <Summary q={q} />
      </span>
      <span className="mt-0.5 shrink-0 text-xs text-[var(--text-muted)]">{lvLabel(q.lv)}</span>
    </button>
  );
}
