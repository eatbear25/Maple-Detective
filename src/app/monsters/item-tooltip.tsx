"use client";

// 道具 hover 彈窗，套用楓探主題色（跟著 layout.tsx 設的 CSS var 走）。
// 非裝備 → 名稱 + 說明文字（含 #c...# 強調色）；
// 裝備   → 名稱 + 需求值 + 可用職業 + 分類/攻速/能力加成/捲軸次數。

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { itemName, itemInfo, itemIconSrc, type EquipStats, type ItemInfo } from "@/data/drops";
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

/**
 * hover 狀態 + 定位（不觸發 re-render，直接改 style）。
 * 錨定在被 hover 的格子本身（進入時量一次 rect），不跟著游標跑——
 * 游標貼著視窗邊緣時跟隨式定位會在「翻到另一側」的臨界點來回跳動，
 * 導致彈窗瘋狂開關；改成只在滑入當下算一次位置就不會再觸發。
 *
 * 觸控裝置沒有 hover，改用 tap 開關（hasHover 用 matchMedia 偵測）：
 * 有 hover 的裝置維持「hover 顯示 + click 觸發搜尋」；沒有 hover 的裝置
 * 「tap 開/關彈窗」，原本的搜尋功能移到彈窗內的按鈕。
 */
export function useItemTooltip() {
  const [id, setId] = useState<number | null>(null);
  // 惰性初始化直接讀 matchMedia(SSR 時 window 不存在,先假設有 hover;
  // client 端第一次 render 就會讀到真實值,不需要額外的 effect)
  const [hasHover] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<DOMRect | null>(null);

  const place = useCallback(() => {
    const el = panelRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor) return;
    const gap = 10;
    const pad = 8;
    const { innerWidth: vw, innerHeight: vh } = window;

    let x = anchor.right + gap;
    if (x + el.offsetWidth + pad > vw) x = Math.max(pad, anchor.left - el.offsetWidth - gap);

    let y = anchor.top;
    if (y + el.offsetHeight + pad > vh) y = Math.max(pad, vh - el.offsetHeight - pad);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  useLayoutEffect(() => {
    // 觸控裝置(!hasHover)固定置中顯示,不需要錨定定位
    if (id != null && hasHover) place();
  }, [id, hasHover, place]);

  const close = useCallback(() => setId(null), []);

  return {
    id,
    hasHover,
    panelRef,
    close,
    /** 綁在每個道具格子上；onSearch 是有 hover 時 click 要做的「查誰掉這個道具」 */
    handlers: (iid: number, onSearch?: () => void) => ({
      onMouseEnter: (e: React.MouseEvent) => {
        if (!hasHover) return;
        anchorRef.current = e.currentTarget.getBoundingClientRect();
        setId(iid);
      },
      onMouseLeave: () => {
        if (!hasHover) return;
        setId(null);
      },
      onClick: (e: React.MouseEvent) => {
        if (hasHover) {
          onSearch?.();
          return;
        }
        if (id === iid) {
          setId(null);
          return;
        }
        anchorRef.current = e.currentTarget.getBoundingClientRect();
        setId(iid);
      },
    }),
  };
}

/** 說明文字：#c...# → 強調色，\n → 換行 */
function Desc({ text }: { text: string }) {
  const parts = text.split(/#c([^#]*)#/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} style={{ color: "var(--accent)" }}>
            {p}
          </span>
        ) : (
          p
        )
      )}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <li>
      <span className="text-[var(--text-muted)]">・{label} : </span>
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
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[var(--accent-soft)] p-1.5">
          <GameIcon
            src={itemIconSrc(id)}
            alt=""
            fallback="📦"
            className="h-11 w-11 [image-rendering:pixelated]"
          />
        </div>
        <div className="text-[11px] leading-[1.6] text-[var(--text-muted)]">
          <div>裝備等級 : <span className="text-[var(--text)]">{eq.reqLevel ?? 0}</span></div>
          <div>需要力量 : <span className="text-[var(--text)]">{eq.reqSTR ?? 0}</span></div>
          <div>需要敏捷 : <span className="text-[var(--text)]">{eq.reqDEX ?? 0}</span></div>
          <div>需要智力 : <span className="text-[var(--text)]">{eq.reqINT ?? 0}</span></div>
          <div>需要幸運 : <span className="text-[var(--text)]">{eq.reqLUK ?? 0}</span></div>
        </div>
      </div>

      <div className="mt-2 flex justify-center gap-2 text-[11px]">
        {CLASSES.map(([label, bit]) => {
          const usable = reqJob === 0 || (bit !== 0 && (reqJob & bit) !== 0);
          return (
            <span key={label} className={usable ? "text-[var(--text)]" : "text-[var(--text-muted)] opacity-50"}>
              {label}
            </span>
          );
        })}
      </div>

      <div className="my-2 border-t border-dashed border-[var(--border)]" />

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

/**
 * 浮動彈窗本體：由 useItemTooltip 定位。
 * hover 裝置(modal=false)：pointer-events 關閉避免搶滑鼠。
 * 觸控裝置(modal=true)：改成可互動的小彈窗,加半透明背景(點背景關閉)與關閉鈕、
 * 「查看誰掉這個」按鈕(取代原本 hover 裝置上用 click 觸發的搜尋)。
 */
export function ItemTooltip({
  id,
  panelRef,
  modal = false,
  onClose,
  onSearch,
  searchLabel = "查看誰掉這個道具",
  name: nameOverride,
  info: infoOverride,
}: {
  id: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  modal?: boolean;
  onClose?: () => void;
  onSearch?: () => void;
  /** 觸控裝置彈窗底部按鈕的文字（任務頁用的是「哪些任務會給這個」） */
  searchLabel?: string;
  /** 名稱／說明覆寫：任務道具不在怪物掉落資料裡，由呼叫端自帶 */
  name?: string;
  info?: ItemInfo;
}) {
  const info = infoOverride ?? itemInfo(id);
  const name = nameOverride ?? itemName(id);
  const panelStyle: React.CSSProperties = {
    background: "var(--surface)",
    borderColor: "var(--border)",
    color: "var(--text)",
    boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.18)",
  };
  const panel = (
      <div
        ref={panelRef}
        onClick={(e) => modal && e.stopPropagation()}
        className={
          modal
            ? "relative w-max max-w-[280px] rounded-xl border px-3.5 py-3 shadow-xl"
            : "fixed left-0 top-0 z-50 w-max max-w-[280px] rounded-xl border px-3.5 py-3 shadow-xl pointer-events-none"
        }
        style={panelStyle}
      >
      {modal && (
        <button
          onClick={onClose}
          aria-label="關閉"
          className="cursor-pointer absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      )}
      <div className="text-center text-[13px] font-semibold leading-tight">{name}</div>
      {info?.eq ? (
        <EquipBody id={id} eq={info.eq} />
      ) : (
        <div className="mt-2 flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--accent-soft)] p-1.5">
            <GameIcon
              src={itemIconSrc(id)}
              alt=""
              fallback="📦"
              className="h-9 w-9 [image-rendering:pixelated]"
            />
          </div>
          {info?.desc && (
            <div className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              <Desc text={info.desc} />
            </div>
          )}
        </div>
      )}
      {info?.eq && info.desc && (
        <div className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          <Desc text={info.desc} />
        </div>
      )}
      {modal && onSearch && (
        <button
          onClick={onSearch}
          className="cursor-pointer mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
        >
          <Search size={12} />
          {searchLabel}
        </button>
      )}
      </div>
  );
  // portal 到 body：fixed 定位不受版面 transform/overflow 影響，也絕不會撐高頁面
  // 觸控裝置(modal)固定用 flex 置中顯示,不用錨定座標,避免不同螢幕位置跑版
  return createPortal(
    modal ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        onClick={onClose}
      >
        {panel}
      </div>
    ) : (
      panel
    ),
    document.body
  );
}
