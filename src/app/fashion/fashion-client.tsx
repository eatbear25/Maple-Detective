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
  type Gender,
} from "@/data/fashion";
import {
  ACTIONS,
  EXPRESSIONS,
  SKINS,
  DEFAULT_LOOK,
  type CharacterLook,
} from "@/lib/fashion/config";
import { itemIconUrls } from "@/lib/fashion/msio";
import CharacterCanvas, {
  type CharacterCanvasHandle,
} from "./character-canvas";

const PAGE_SIZE = 60;

/** 右欄分頁：12 個部位，外加不佔部位的「特效」 */
type Tab = FashionSlot | "effect";

/** 特效分頁卡片上的一行說明 */
const EFFECT_KIND_LABELS: Record<FashionEffect["kind"], string> = {
  follow: "跟在身後",
  action: "隨動作變化",
  simple: "循環播放",
};

const GENDER_FILTERS: { value: Gender | "all"; label: string }[] = [
  { value: "all", label: "全部性別" },
  { value: 0, label: "男" },
  { value: 1, label: "女" },
  { value: 2, label: "共用" },
];

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

/** 清單格子的統一形狀：一般部位一件＝一格；髮型／臉型一組造型＝一格 */
interface GridEntry {
  key: number;
  name: string;
  gender: Gender;
  /** 點下去要穿的那件（髮型／臉型已依選色解析成對應色的 variant） */
  item: FashionItem;
  /** 這組造型沒有目前選的顏色（退回其他色） */
  colorMissing?: boolean;
}

/** 角色性別 vs 道具性別限制：2=共用、-1=不明都算穿得下 */
const genderFits = (gender: Gender, charGender: 0 | 1) =>
  gender === charGender || gender === 2 || gender === -1;

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

function ItemIcon({ id, alt }: { id: number; alt: string }) {
  // 依 REGIONS 順序逐一退，全部失敗才顯示空位；呼叫端用 key={id} 讓換色時重置
  const [srcIndex, setSrcIndex] = useState(0);
  const urls = itemIconUrls(id);
  if (srcIndex >= urls.length) {
    return (
      <div
        className="h-8 w-8 shrink-0 rounded bg-[var(--accent-soft)]"
        aria-hidden
      />
    );
  }
  return (
    // 素材來自 maplestory.io（尺寸不定），用原生 img 免去 next/image 的網域設定
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urls[srcIndex]}
      alt={alt}
      className="h-8 w-8 shrink-0 object-contain"
      style={{ imageRendering: "pixelated" }}
      loading="lazy"
      onError={() => setSrcIndex((i) => i + 1)}
    />
  );
}

export default function FashionPage() {
  const [look, setLook] = useState<CharacterLook>(DEFAULT_LOOK);
  const [charGender, setCharGender] = useState<0 | 1>(0);
  const [tab, setTab] = useState<Tab>("hair");
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all");
  // 髮色／瞳色各自記住（DEFAULT_LOOK 是黑髮黑眼，跟 0 對齊）
  const [hairColor, setHairColor] = useState(0);
  const [faceColor, setFaceColor] = useState(0);
  const [page, setPage] = useState(0);

  const [action, setAction] = useState("stand1");
  const [expression, setExpression] = useState("default");
  const [animated, setAnimated] = useState(true);
  const [flipX, setFlipX] = useState(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState<number[]>([]);
  const canvasRef = useRef<CharacterCanvasHandle>(null);

  const onStatusChange = useCallback(
    (s: "loading" | "ready" | "error", err?: unknown) => {
      setStatus(s);
      setError(err ?? null);
    },
    [],
  );
  const onMissing = useCallback((ids: number[]) => setMissing(ids), []);

  /** 在特效分頁時沒有「目前部位」，底下用到部位的地方都要先擋掉 */
  const slot: FashionSlot | null = tab === "effect" ? null : tab;
  const grouped = slot !== null && GROUPED_SLOTS.has(slot);
  const palette = slot === "hair" ? HAIR_COLORS : FACE_COLORS;
  const selectedColor = slot === "hair" ? hairColor : faceColor;

  const q = query.trim();
  const list = useMemo<GridEntry[]>(() => {
    if (slot === null) return [];
    if (grouped) {
      const groups = slot === "hair" ? hairGroups : faceGroups;
      const entries: GridEntry[] = [];
      for (const g of groups) {
        if (genderFilter !== "all" && g.gender !== genderFilter) continue;
        if (
          q &&
          !g.name.includes(q) &&
          !g.variants.some(
            (v) => v.item.name.includes(q) || String(v.item.id) === q,
          )
        ) {
          continue;
        }
        const variant =
          g.variants.find((v) => v.color === selectedColor) ?? g.variants[0];
        entries.push({
          key: g.key,
          name: g.name,
          gender: g.gender,
          item: variant.item,
          colorMissing: variant.color !== selectedColor,
        });
      }
      return entries;
    }
    const all = BY_SLOT.get(slot) ?? [];
    return all
      .filter((it) => genderFilter === "all" || it.gender === genderFilter)
      .filter((it) => !q || it.name.includes(q) || String(it.id) === q)
      .map((it) => ({
        key: it.id,
        name: it.name,
        gender: it.gender,
        item: it,
      }));
  }, [slot, q, grouped, selectedColor, genderFilter]);

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
        (v) => v.color === digit,
      );
      if (!variant || variant.item.id === current.id) return prev;
      return {
        ...prev,
        equips: {
          ...prev.equips,
          [slot]: {
            id: variant.item.id,
            name: variant.item.name,
            path: itemImgPath(variant.item),
          },
        },
      };
    });
  };

  const equip = (item: FashionItem) => {
    setLook((prev) => {
      const equips = { ...prev.equips };
      if (equips[item.slot]?.id === item.id) {
        delete equips[item.slot];
        return { ...prev, equips };
      }
      for (const conflict of SLOT_CONFLICTS[item.slot] ?? [])
        delete equips[conflict];
      equips[item.slot] = {
        id: item.id,
        name: item.name,
        path: itemImgPath(item),
      };
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">時裝搭配</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          圖與動作由 maplestory.io 提供，少數道具素材庫查不到、無法預覽。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* ===== 左：角色預覽 ===== */}
        <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg bg-[var(--bg)]">
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
              {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--bg)]/80">
                  <div className="maple-loader" />
                  <span className="text-sm text-[var(--text-muted)]">
                    合成中…
                  </span>
                </div>
              )}
              {status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                  {error instanceof Error ? error.message : "這個組合畫不出來"}
                </div>
              )}
            </div>

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
              <label className="space-y-1">
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
              <label className="space-y-1">
                <span className="text-[var(--text-muted)]">角色性別</span>
                <select
                  value={charGender}
                  onChange={(e) =>
                    setCharGender(Number(e.target.value) as 0 | 1)
                  }
                  className="w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
                >
                  <option value={0}>男</option>
                  <option value={1}>女</option>
                </select>
              </label>
            </div>
          </div>

          {missing.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3 text-xs">
              <AlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-[var(--accent)]"
              />
              <div>
                <div className="font-medium">這幾件無法預覽</div>
                <div className="mt-0.5 text-[var(--text-muted)]">
                  {missing
                    .map(
                      (id) =>
                        fashionItem(id)?.name ??
                        fashionEffect(id)?.name ??
                        `#${id}`,
                    )
                    .join("、")}
                  —— 素材庫沒有它們的動作資料，仍然穿在身上，只是畫不出來。
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
              <div className="space-y-1.5">
                {look.effect && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--text-muted)]">特效</span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate">{look.effect.name}</span>
                      <button
                        onClick={() =>
                          setLook((p) => ({ ...p, effect: undefined }))
                        }
                        aria-label="關掉特效"
                        className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  </div>
                )}
                {equippedRows.map(({ slot: s, label }) => (
                  <div
                    key={s}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-[var(--text-muted)]">{label}</span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate">{look.equips[s]!.name}</span>
                      <button
                        onClick={() => unequip(s)}
                        aria-label={`脫掉${label}`}
                        className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== 右：道具選擇 ===== */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
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

          <div
            className={`flex-wrap gap-1.5 ${tab === "effect" ? "hidden" : "flex"}`}
          >
            {GENDER_FILTERS.map(({ value, label }) => (
              <button
                key={String(value)}
                onClick={() => {
                  setGenderFilter(value);
                  setPage(0);
                }}
                aria-pressed={genderFilter === value}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
                  genderFilter === value
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
              >
                {label}
              </button>
            ))}
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

          {slot !== null && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((entry) => {
                const equipped = look.equips[slot];
                // 髮型／臉型：身上那件是同組任一顏色就算選中（換色前後都亮）
                const active = grouped
                  ? equipped !== undefined &&
                    styleBaseId(slot, equipped.id) === entry.key
                  : equipped?.id === entry.item.id;
                const fits = genderFits(entry.gender, charGender);
                return (
                  <button
                    key={entry.key}
                    onClick={() => equip(entry.item)}
                    title={
                      fits
                        ? entry.name
                        : `${entry.name}（此造型限${entry.gender === 0 ? "男" : "女"}性角色）`
                    }
                    className={`cursor-pointer flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--accent)]"
                    } ${fits ? "" : "opacity-45"}`}
                  >
                    <ItemIcon
                      key={entry.item.id}
                      id={entry.item.id}
                      alt={entry.name}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">
                        {entry.name}
                      </span>
                      {(entry.colorMissing || !fits) && (
                        <span className="mt-0.5 flex items-center gap-1">
                          {entry.colorMissing && (
                            <span className="text-[10px] text-[var(--text-muted)]">
                              無此色，以現有色代替
                            </span>
                          )}
                          {!fits && (
                            <span className="text-[10px] text-[var(--text-muted)]">
                              限{entry.gender === 0 ? "男" : "女"}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "effect" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
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
                  <ItemIcon id={effect.id} alt={effect.name} />
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
