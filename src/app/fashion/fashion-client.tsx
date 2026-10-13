"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  FlipHorizontal2,
  Play,
  Search,
  Square,
  X,
} from "lucide-react";
import {
  fashionItems,
  fashionItem,
  fashionEffects,
  fashionEffect,
  fashionIconSrcs,
  itemImgPath,
  SLOT_LABELS,
  SLOT_CONFLICTS,
  GROUPED_SLOTS,
  HAIR_COLORS,
  FACE_COLORS,
  hairGroups,
  faceGroups,
  styleGroupOf,
  styleBaseId,
  type FashionItem,
  type FashionEffect,
  type FashionSlot,
} from "@/data/fashion";
import {
  ACTIONS,
  EXPRESSIONS,
  SKINS,
  BACKGROUNDS,
  DEFAULT_LOOK,
  type CharacterLook,
  type EquippedItem,
} from "@/lib/fashion/config";
import { effectIconUrl } from "@/lib/fashion/msio";
import CharacterCanvas, {
  type CharacterCanvasHandle,
} from "./character-canvas";
import PreviewStage from "./preview-stage";

const PAGE_SIZE = 60;

/** 右欄分頁：「全部」＋ 12 個部位，外加不佔部位的「特效」 */
type Tab = FashionSlot | "all" | "effect";

/** 特效分頁卡片上的一行說明 */
const EFFECT_KIND_LABELS: Record<FashionEffect["kind"], string> = {
  follow: "跟在身後",
  action: "隨動作變化",
  simple: "循環播放",
};

/** 依部位先分好組，避免每次篩選都掃全部 5000 筆 */
const BY_SLOT = new Map<FashionSlot, FashionItem[]>();
for (const item of fashionItems) {
  const list = BY_SLOT.get(item.slot);
  if (list) list.push(item);
  else BY_SLOT.set(item.slot, [item]);
}

/** 部位分頁 chip 上的數字：髮型／臉型算「造型組數」（顏色已合併），其他算件數 */
const SLOT_COUNTS = new Map<FashionSlot, number>(
  SLOT_LABELS.map(({ slot }) => [
    slot,
    slot === "hair"
      ? hairGroups.length
      : slot === "face"
        ? faceGroups.length
        : (BY_SLOT.get(slot) ?? []).length,
  ]),
);

/** 「全部」chip 上的數字＝各部位 chip 的加總（髮型／臉型一樣算造型組數） */
const TOTAL_COUNT = [...SLOT_COUNTS.values()].reduce((a, b) => a + b, 0);

const SLOT_NAMES = new Map(SLOT_LABELS.map(({ slot, label }) => [slot, label]));

/** 清單格子的統一形狀：一般部位一件＝一格；髮型／臉型一組造型＝一格 */
interface GridEntry {
  key: number;
  name: string;
  /** 點下去要穿的那件（髮型／臉型已依選色解析成對應色的 variant） */
  item: FashionItem;
  /** 這組造型沒有目前選的顏色（退回其他色） */
  colorMissing?: boolean;
  /** 素材庫沒有圖，畫不出來（清單上照樣列出，但不能穿） */
  unavailable: boolean;
}

/** 畫不出來的排到最後面（穩定排序，其餘維持 id 順序），翻頁時不會整頁都是灰的 */
const availableFirst = (entries: GridEntry[]) => [
  ...entries.filter((e) => !e.unavailable),
  ...entries.filter((e) => e.unavailable),
];

/**
 * 某個部位符合搜尋字的清單格子。髮型／臉型一組造型收成一格，
 * color 是要挑的顏色碼（其他部位用不到）。
 */
function slotEntries(slot: FashionSlot, q: string, color: number): GridEntry[] {
  if (!GROUPED_SLOTS.has(slot)) {
    return (BY_SLOT.get(slot) ?? [])
      .filter((it) => !q || it.name.includes(q) || String(it.id) === q)
      .map((it) => ({
        key: it.id,
        name: it.name,
        item: it,
        unavailable: it.preview === "none",
      }));
  }
  const entries: GridEntry[] = [];
  for (const g of slot === "hair" ? hairGroups : faceGroups) {
    if (
      q &&
      !g.name.includes(q) &&
      !g.variants.some((v) => v.item.name.includes(q) || String(v.item.id) === q)
    ) {
      continue;
    }
    // 只在畫得出來的顏色裡挑；整組都沒圖才標成無法預覽
    const usable = g.variants.filter((v) => v.item.preview !== "none");
    const variant =
      usable.find((v) => v.color === color) ?? usable[0] ?? g.variants[0];
    entries.push({
      key: g.key,
      name: g.name,
      item: variant.item,
      colorMissing: usable.length > 0 && variant.color !== color,
      unavailable: usable.length === 0,
    });
  }
  return entries;
}

const toEquipped = (item: FashionItem): EquippedItem => ({
  id: item.id,
  name: item.name,
  path: itemImgPath(item),
  ...(item.preview === "blank" ? { blank: true } : {}),
});

/** 頁碼列表：頁數多時只顯示目前頁附近＋首尾，中間用 "…" 省略 */
function pageNumbers(current: number, count: number): (number | "…")[] {
  const window = 1;
  const pages = new Set<number>([0, count - 1, current]);
  for (let d = 1; d <= window; d++) {
    if (current - d >= 0) pages.add(current - d);
    if (current + d <= count - 1) pages.add(current + d);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

function ItemIcon({
  srcs,
  alt,
  size = "h-8 w-8",
}: {
  srcs: string[];
  alt: string;
  /** 尺寸的 Tailwind class（清單 32px；「目前穿著」那欄列數多，用小一號的） */
  size?: string;
}) {
  // 依序試候選網址，全部失敗（或根本沒有縮圖）才顯示空位；呼叫端用 key 讓換色時重置
  const [index, setIndex] = useState(0);
  if (index >= srcs.length) {
    return (
      <div
        className={`${size} shrink-0 rounded bg-[var(--accent-soft)]`}
        aria-hidden
      />
    );
  }
  return (
    // 縮圖尺寸不定又是像素圖，用原生 img 免去 next/image 的最佳化
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={srcs[index]}
      alt={alt}
      className={`${size} shrink-0 object-contain`}
      style={{ imageRendering: "pixelated" }}
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export default function FashionPage() {
  const [look, setLook] = useState<CharacterLook>(DEFAULT_LOOK);
  const [tab, setTab] = useState<Tab>("hair");
  const [query, setQuery] = useState("");
  // 髮色／瞳色各自記住（DEFAULT_LOOK 是黑髮黑眼，跟 0 對齊）
  const [hairColor, setHairColor] = useState(0);
  const [faceColor, setFaceColor] = useState(0);
  const [page, setPage] = useState(0);

  const [action, setAction] = useState("stand1");
  const [expression, setExpression] = useState("default");
  const [animated, setAnimated] = useState(true);
  const [flipX, setFlipX] = useState(false);
  // 舞台底色：存 CSS 值本身，色票與自訂選色器共用同一個 state
  const [background, setBackground] = useState(BACKGROUNDS[0].value);
  // 放大試衣間：左欄加寬、舞台變高，右邊的清單照樣能點（不是蓋住整頁的燈箱）
  const [expanded, setExpanded] = useState(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState<number[]>([]);
  // 畫出過第一隻之後，換裝時舊的那隻會留在畫面上，不必再整片蓋住
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<CharacterCanvasHandle>(null);

  const onStatusChange = useCallback(
    (s: "loading" | "ready" | "error", err?: unknown) => {
      setStatus(s);
      setError(err ?? null);
      if (s === "ready") setHasDrawn(true);
      if (s === "error") setHasDrawn(false);
    },
    [],
  );
  const onMissing = useCallback((ids: number[]) => setMissing(ids), []);

  /** 「全部」與特效分頁沒有「目前部位」，底下用到部位的地方都要先擋掉 */
  const slot: FashionSlot | null =
    tab === "effect" || tab === "all" ? null : tab;
  const grouped = slot !== null && GROUPED_SLOTS.has(slot);
  const palette = slot === "hair" ? HAIR_COLORS : FACE_COLORS;
  const selectedColor = slot === "hair" ? hairColor : faceColor;

  const q = query.trim();
  const list = useMemo<GridEntry[]>(() => {
    if (tab === "effect") return [];
    // 「全部」照分頁順序把每個部位接起來；髮型／臉型沿用各自記住的顏色
    const slots = tab === "all" ? SLOT_LABELS.map((l) => l.slot) : [tab];
    return availableFirst(
      slots.flatMap((s) =>
        slotEntries(s, q, s === "hair" ? hairColor : faceColor),
      ),
    );
  }, [tab, q, hairColor, faceColor]);

  const effectList = useMemo(
    () =>
      fashionEffects.filter(
        (e) => !q || e.name.includes(q) || String(e.id) === q,
      ),
    [q],
  );

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = list.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(0);
  };

  /** 換髮色／瞳色：更新色票選取，若身上已穿同部位造型，直接換成對應色（即時預覽） */
  const changeColor = (digit: number) => {
    if (slot === null) return;
    if (slot === "hair") setHairColor(digit);
    else setFaceColor(digit);
    setLook((prev) => {
      const current = prev.equips[slot];
      if (!current) return prev;
      const variant = styleGroupOf(slot, current.id)?.variants.find(
        (v) => v.color === digit && v.item.preview !== "none",
      );
      if (!variant || variant.item.id === current.id) return prev;
      return {
        ...prev,
        equips: { ...prev.equips, [slot]: toEquipped(variant.item) },
      };
    });
  };

  const equip = (item: FashionItem) => {
    if (item.preview === "none") return;
    setLook((prev) => {
      const equips = { ...prev.equips };
      if (equips[item.slot]?.id === item.id) {
        delete equips[item.slot];
        return { ...prev, equips };
      }
      for (const conflict of SLOT_CONFLICTS[item.slot] ?? [])
        delete equips[conflict];
      equips[item.slot] = toEquipped(item);
      return { ...prev, equips };
    });
  };

  /** 特效同時只能開一個（遊戲裡也是），再點一次就關掉 */
  const toggleEffect = (effect: FashionEffect) =>
    setLook((prev) => ({
      ...prev,
      effect:
        prev.effect?.id === effect.id
          ? undefined
          : {
              id: effect.id,
              name: effect.name,
              kind: effect.kind,
              z: effect.z,
              trail: effect.trail,
              zOverride: effect.zOverride,
            },
    }));

  const unequip = (s: FashionSlot) =>
    setLook((prev) => {
      const equips = { ...prev.equips };
      delete equips[s];
      return { ...prev, equips };
    });

  const download = async () => {
    const blob = await canvasRef.current?.toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `楓探時裝-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const equippedRows = SLOT_LABELS.filter(({ slot: s }) => look.equips[s]);
  const customBackground = !BACKGROUNDS.some((b) => b.value === background);
  // 放大模式左欄吃掉 160px，清單少排一欄，卡片才不會窄到名稱只剩三個字
  const gridCols = expanded
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
    : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">時裝搭配</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          圖取自 maplestory.io，少數道具素材庫沒有、無法預覽（排在清單最後）。
        </p>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          expanded ? "lg:grid-cols-[480px_1fr]" : "lg:grid-cols-[320px_1fr]"
        }`}
      >
        {/* ===== 左：角色預覽 ===== */}
        <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <PreviewStage
              background={background}
              expanded={expanded}
              onToggleExpanded={() => setExpanded((v) => !v)}
              overlay={
                <>
                  {status === "loading" &&
                    (hasDrawn ? (
                      // 換裝：舊的那隻留著，角落亮個小點就好（素材是靜態檔，通常一閃就過）
                      <div
                        className="fashion-busy absolute right-2 top-2"
                        role="status"
                        aria-label="載入中"
                      >
                        <div className="maple-loader" style={{ width: 30 }} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="maple-loader" />
                        <span className="text-sm text-[var(--text-muted)]">
                          載入中…
                        </span>
                      </div>
                    ))}
                  {status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                      {error instanceof Error
                        ? error.message
                        : "這個組合畫不出來"}
                    </div>
                  )}
                </>
              }
            >
              <CharacterCanvas
                ref={canvasRef}
                look={look}
                action={action}
                expression={expression}
                animated={animated}
                flipX={flipX}
                scale={2}
                onStatusChange={onStatusChange}
                onMissing={onMissing}
              />
            </PreviewStage>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setAnimated((v) => !v)}
                className={`cursor-pointer flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                  animated
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
              >
                {animated ? <Square size={12} /> : <Play size={12} />}
                {animated ? "停止" : "播放"}
              </button>
              <button
                onClick={() => setFlipX((v) => !v)}
                className={`cursor-pointer flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                  flipX
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
              >
                <FlipHorizontal2 size={12} />
                翻轉
              </button>
              <button
                onClick={download}
                disabled={status !== "ready"}
                className="cursor-pointer flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] disabled:opacity-40"
              >
                <Download size={12} />
                下載 PNG
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <label className="space-y-1">
                <span className="text-[var(--text-muted)]">動作</span>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[var(--text-muted)]">表情</span>
                <select
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
                >
                  {EXPRESSIONS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-[var(--text-muted)]">膚色</span>
                <select
                  value={look.skinId}
                  onChange={(e) =>
                    setLook((p) => ({ ...p, skinId: Number(e.target.value) }))
                  }
                  className="w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
                >
                  {SKINS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="col-span-2">
                <span className="text-[var(--text-muted)]">背景</span>
                {/* 選中的色票會放大再加一圈外框，四周要留位置才不會壓到上面的字 */}
                <div className="mt-2 flex flex-wrap items-center gap-2 px-1 pb-1">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBackground(b.value)}
                      title={b.label}
                      aria-label={b.label}
                      aria-pressed={background === b.value}
                      className={`h-6 w-6 cursor-pointer rounded-full transition-transform ${
                        background === b.value
                          ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                          : "ring-1 ring-[var(--border)] hover:scale-110"
                      }`}
                      style={{ background: b.value }}
                    />
                  ))}
                  {/* 色票以外的顏色：整顆圓就是原生選色器，選了之後圓會變成那個顏色 */}
                  <label
                    title="自訂顏色"
                    className={`relative h-6 w-6 cursor-pointer overflow-hidden rounded-full transition-transform ${
                      customBackground
                        ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                        : "ring-1 ring-[var(--border)] hover:scale-110"
                    }`}
                    style={{
                      background: customBackground
                        ? background
                        : "conic-gradient(#f87171, #fbbf24, #a3e635, #22d3ee, #818cf8, #e879f9, #f87171)",
                    }}
                  >
                    <input
                      type="color"
                      aria-label="自訂背景顏色"
                      value={customBackground ? background : "#ffffff"}
                      onChange={(e) => setBackground(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {missing.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3 text-xs">
              <AlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-[var(--accent)]"
              />
              <div>
                <div className="font-medium">這幾件沒載入成功</div>
                <div className="mt-0.5 text-[var(--text-muted)]">
                  {missing
                    .map(
                      (id) =>
                        fashionItem(id)?.name ??
                        fashionEffect(id)?.name ??
                        `#${id}`,
                    )
                    .join("、")}
                  —— 多半是網路不穩，重新整理再試一次。
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
              目前穿著
            </div>
            {equippedRows.length === 0 && !look.effect ? (
              <div className="text-xs text-[var(--text-muted)]">
                還沒穿任何東西
              </div>
            ) : (
              // 縮圖排在最左邊對成一直欄——用圖認比讀名字快；名字靠右的話縮圖會跟著參差
              <div className="space-y-1">
                {look.effect && (
                  <div className="flex items-center gap-2 text-xs">
                    <ItemIcon
                      key={look.effect.id}
                      srcs={[effectIconUrl(look.effect.id)]}
                      alt=""
                      size="h-7 w-7"
                    />
                    <span className="shrink-0 text-[var(--text-muted)]">
                      特效
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={look.effect.name}
                    >
                      {look.effect.name}
                    </span>
                    <button
                      onClick={() =>
                        setLook((p) => ({ ...p, effect: undefined }))
                      }
                      aria-label="關掉特效"
                      className="shrink-0 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                {equippedRows.map(({ slot: s, label }) => {
                  const worn = look.equips[s]!;
                  return (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <ItemIcon
                        key={worn.id}
                        srcs={
                          fashionItem(worn.id)?.hasIcon
                            ? fashionIconSrcs(worn.id)
                            : []
                        }
                        alt=""
                        size="h-7 w-7"
                      />
                      <span className="shrink-0 text-[var(--text-muted)]">
                        {label}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={worn.name}
                      >
                        {worn.name}
                      </span>
                      <button
                        onClick={() => unequip(s)}
                        aria-label={`脫掉${label}`}
                        className="shrink-0 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== 右：道具選擇 ===== */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => changeTab("all")}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                tab === "all"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
              }`}
            >
              全部
              <span className="ml-1 opacity-60">{TOTAL_COUNT}</span>
            </button>
            {SLOT_LABELS.map(({ slot: s, label }) => (
              <button
                key={s}
                onClick={() => changeTab(s)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                  tab === s
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
              >
                {label}
                <span className="ml-1 opacity-60">{SLOT_COUNTS.get(s)}</span>
              </button>
            ))}
            {/* <button
              onClick={() => changeTab("effect")}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                tab === "effect"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
              }`}
            >
              特效
              <span className="ml-1 opacity-60">{fashionEffects.length}</span>
            </button> */}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={tab === "effect" ? "搜尋特效名稱" : "搜尋道具名稱"}
                className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="清除搜尋"
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {grouped && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <span className="text-xs text-[var(--text-muted)]">
                {slot === "hair" ? "髮色" : "瞳色"}
              </span>
              <div className="flex flex-wrap gap-2">
                {palette.map((c) => (
                  <button
                    key={c.digit}
                    onClick={() => changeColor(c.digit)}
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={selectedColor === c.digit}
                    className={`h-6 w-6 cursor-pointer rounded-full transition-transform ${
                      selectedColor === c.digit
                        ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                        : "ring-1 ring-[var(--border)] hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {palette.find((c) => c.digit === selectedColor)?.label}
                ・點清單直接以此色試穿
              </span>
            </div>
          )}

          {/* <div className="text-xs text-[var(--text-muted)]">
            {list.length} {grouped ? "款造型" : "件"}
          </div> */}

          {tab !== "effect" && (
            <div className={`grid gap-2 ${gridCols}`}>
              {shown.map((entry) => {
                // 「全部」分頁各部位混在一起，部位要看格子自己的
                const entrySlot = entry.item.slot;
                const equipped = look.equips[entrySlot];
                // 髮型／臉型：身上那件是同組任一顏色就算選中（換色前後都亮）
                const active = GROUPED_SLOTS.has(entrySlot)
                  ? equipped !== undefined &&
                    styleBaseId(entrySlot, equipped.id) === entry.key
                  : equipped?.id === entry.item.id;
                // 名稱底下那行小字。「全部」分頁多標一個部位——不然分不出是帽子還是飾品
                const notes = [
                  tab === "all" && SLOT_NAMES.get(entrySlot),
                  // 透明帽、技能效果這類：遊戲裡它本來就什麼都不畫，
                  // 不先講的話點了沒反應會以為壞掉
                  entry.item.preview === "blank" && "穿上不會顯示",
                  entry.colorMissing && "無此色，以現有色代替",
                  entry.unavailable && "無法預覽",
                ].filter(Boolean);
                if (entry.unavailable) {
                  return (
                    <div
                      key={entry.key}
                      title={`${entry.name}（素材庫沒有這件的圖，無法預覽）`}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2 opacity-45"
                    >
                      <ItemIcon
                        key={entry.item.id}
                        srcs={
                          entry.item.hasIcon
                            ? fashionIconSrcs(entry.item.id)
                            : []
                        }
                        alt=""
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">
                          {entry.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
                          {notes.join("・")}
                        </span>
                      </span>
                    </div>
                  );
                }
                return (
                  <button
                    key={entry.key}
                    onClick={() => equip(entry.item)}
                    title={entry.name}
                    className={`cursor-pointer flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <ItemIcon
                      key={entry.item.id}
                      srcs={
                        entry.item.hasIcon
                          ? fashionIconSrcs(entry.item.id)
                          : []
                      }
                      alt={entry.name}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">
                        {entry.name}
                      </span>
                      {notes.length > 0 && (
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
                          {notes.join("・")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "effect" && (
            <div className={`grid gap-2 ${gridCols}`}>
              {effectList.map((effect) => (
                <button
                  key={effect.id}
                  onClick={() => toggleEffect(effect)}
                  title={effect.name}
                  className={`cursor-pointer flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                    look.effect?.id === effect.id
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <ItemIcon
                    srcs={[effectIconUrl(effect.id)]}
                    alt={effect.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">
                      {effect.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                      {EFFECT_KIND_LABELS[effect.kind]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {(tab === "effect" ? effectList.length : list.length) === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              沒有符合的{tab === "effect" ? "特效" : "道具"}
            </div>
          )}

          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 transition-colors hover:border-[var(--accent)] disabled:opacity-40"
              >
                上一頁
              </button>
              {pageNumbers(safePage, pageCount).map((n, i) =>
                n === "…" ? (
                  <span
                    key={`dots-${i}`}
                    className="px-1 text-[var(--text-muted)]"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    aria-current={safePage === n ? "page" : undefined}
                    className={`cursor-pointer min-w-[1.75rem] rounded-full border px-2 py-1 transition-colors ${
                      safePage === n
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {n + 1}
                  </button>
                ),
              )}
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 transition-colors hover:border-[var(--accent)] disabled:opacity-40"
              >
                下一頁
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
