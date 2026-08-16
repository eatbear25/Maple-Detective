"use client";

// 遊戲風格的道具 hover 彈窗：模仿楓之谷道具提示視窗（深藍底、白字）。
// 非裝備 → 名稱 + 說明文字（含 #c...# 橘色強調）；
// 裝備   → 名稱 + 需求值 + 可用職業 + 分類/攻速/能力加成/捲軸次數。

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { itemName, itemInfo, itemIconSrc, type EquipStats } from "@/data/drops";
import { GameIcon } from "./game-icon";

const WEAPON_CATS: Record<number, string> = {
  130: "單手劍",
  131: "單手斧",
  132: "單手棍",
  133: "短劍",
  137: "短杖",
  138: "長杖",
  140: "雙手劍",
  141: "雙手斧",
  142: "雙手棍",
  143: "槍",
  144: "矛",
  145: "弓",
  146: "弩",
  147: "拳套",
  148: "指虎",
  149: "火槍",
};

const ARMOR_CATS: Record<number, string> = {
  100: "帽子",
  101: "臉部裝飾",
  102: "眼部裝飾",
  103: "耳環",
  104: "上衣",
  105: "套服",
  106: "褲子/裙子",
  107: "鞋子",
  108: "手套",
  109: "盾牌",
  110: "披風",
  111: "戒指",
  112: "墜飾",
};

// 舊 wz attackSpeed 數值 → 遊戲內文字
const SPEED_LABELS: Record<number, string> = {
  2: "最快",
  3: "較快",
  4: "快",
  5: "快",
  6: "普通",
  7: "慢",
  8: "較慢",
  9: "最慢",
};

// reqJob bitmask（0 = 全職業可用）
const CLASSES: [string, number][] = [
  ["初心者", 0],
  ["劍士", 1],
  ["法師", 2],
  ["弓箭手", 4],
  ["盜賊", 8],
  ["海盜", 16],
];

// 能力加成顯示順序與遊戲內名稱
const STAT_ROWS: [string, string][] = [
  ["incSTR", "力量"],
  ["incDEX", "敏捷"],
  ["incINT", "智力"],
  ["incLUK", "幸運"],
  ["incMHP", "HP"],
  ["incMMP", "MP"],
  ["incPAD", "攻擊力"],
  ["incMAD", "魔法攻擊力"],
  ["incPDD", "防禦力"],
  ["incMDD", "魔法防禦力"],
  ["incACC", "命中率"],
  ["incEVA", "迴避率"],
  ["incSpeed", "移動速度"],
  ["incJump", "跳躍力"],
];

/** hover 狀態 + 跟隨滑鼠定位（不觸發 re-render，直接改 style） */
export function useItemTooltip() {
  const [id, setId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  const place = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const pad = 8;
    const { innerWidth: vw, innerHeight: vh } = window;
    let x = pos.current.x + 14;
    let y = pos.current.y + 18;
    if (x + el.offsetWidth + pad > vw) x = Math.max(pad, vw - el.offsetWidth - pad);
    if (y + el.offsetHeight + pad > vh) y = pos.current.y - el.offsetHeight - 10;
    if (y < pad) y = pad;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  useLayoutEffect(() => {
    if (id != null) place();
  }, [id, place]);

  return {
    id,
    panelRef,
    /** 綁在每個道具格子上 */
    handlers: (iid: number) => ({
      onMouseEnter: (e: React.MouseEvent) => {
        pos.current = { x: e.clientX, y: e.clientY };
        setId(iid);
      },
      onMouseMove: (e: React.MouseEvent) => {
        pos.current = { x: e.clientX, y: e.clientY };
        place();
      },
      onMouseLeave: () => setId(null),
    }),
  };
}

/** 說明文字：#c...# → 橘色強調，\n → 換行 */
function Desc({ text }: { text: string }) {
  const parts = text.split(/#c([^#]*)#/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((p, i) => (i % 2 ? <span key={i} className="text-[#ffb648]">{p}</span> : p))}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <li>
      <span className="text-[#a8b8e8]">・{label} : </span>
      {value}
    </li>
  );
}

function EquipBody({ id, eq }: { id: number; eq: EquipStats }) {
  const cat = Math.floor(id / 10000);
  const weaponCat = WEAPON_CATS[cat];
  const armorCat = ARMOR_CATS[cat];
  const reqJob = eq.reqJob ?? 0;
  return (
    <>
      <div className="mt-2 flex gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-white/10 p-1.5">
          <GameIcon
            src={itemIconSrc(id)}
            alt=""
            fallback="📦"
            className="h-11 w-11 [image-rendering:pixelated]"
          />
        </div>
        <div className="text-[11px] leading-[1.6] text-[#a8b8e8]">
          <div>裝備等級 : <span className="text-white">{eq.reqLevel ?? 0}</span></div>
          <div>需要力量 : <span className="text-white">{eq.reqSTR ?? 0}</span></div>
          <div>需要敏捷 : <span className="text-white">{eq.reqDEX ?? 0}</span></div>
          <div>需要智力 : <span className="text-white">{eq.reqINT ?? 0}</span></div>
          <div>需要幸運 : <span className="text-white">{eq.reqLUK ?? 0}</span></div>
        </div>
      </div>

      <div className="mt-2 flex justify-center gap-2 text-[11px]">
        {CLASSES.map(([label, bit]) => {
          const usable = reqJob === 0 || (bit !== 0 && (reqJob & bit) !== 0);
          return (
            <span key={label} className={usable ? "text-white" : "text-[#e05d6f]"}>
              {label}
            </span>
          );
        })}
      </div>

      <div className="my-2 border-t border-dashed border-white/25" />

      <ul className="space-y-0.5 text-[12px]">
        {weaponCat && <Row label="武器分類" value={weaponCat} />}
        {armorCat && <Row label="裝備分類" value={armorCat} />}
        {eq.attackSpeed !== undefined && (
          <Row label="攻擊速度" value={SPEED_LABELS[eq.attackSpeed] ?? `${eq.attackSpeed}`} />
        )}
        {STAT_ROWS.map(([key, label]) => {
          const v = eq[key];
          return v ? <Row key={key} label={label} value={v > 0 ? `+${v}` : `${v}`} /> : null;
        })}
        {eq.tuc !== undefined && <Row label="可使用捲軸次數" value={eq.tuc} />}
      </ul>
    </>
  );
}

/** 浮動彈窗本體：由 useItemTooltip 定位，pointer-events 關閉避免搶滑鼠 */
export function ItemTooltip({
  id,
  panelRef,
}: {
  id: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const info = itemInfo(id);
  return (
    <div
      ref={panelRef}
      className="pointer-events-none fixed left-0 top-0 z-50 w-max max-w-[280px] rounded-lg border border-[#8fa3d9]/60 bg-[#131c43]/95 px-3.5 py-3 text-white shadow-xl shadow-slate-900/40"
    >
      <div className="text-center text-[13px] font-semibold leading-tight">{itemName(id)}</div>
      {info?.eq ? (
        <EquipBody id={id} eq={info.eq} />
      ) : (
        <div className="mt-2 flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/10 p-1.5">
            <GameIcon
              src={itemIconSrc(id)}
              alt=""
              fallback="📦"
              className="h-9 w-9 [image-rendering:pixelated]"
            />
          </div>
          {info?.desc && (
            <div className="text-[12px] leading-relaxed text-slate-200">
              <Desc text={info.desc} />
            </div>
          )}
        </div>
      )}
      {info?.eq && info.desc && (
        <div className="mt-2 text-[11px] leading-relaxed text-slate-300">
          <Desc text={info.desc} />
        </div>
      )}
    </div>
  );
}
