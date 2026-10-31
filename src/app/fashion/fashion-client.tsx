"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronDown,
  Download,
  FlipHorizontal2,
  Link2,
  Play,
  Save,
  Search,
  Square,
  Star,
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
  colorDigitOf,
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
import {
  DEFAULT_ACTION,
  DEFAULT_EXPRESSION,
  decodeLook,
  encodeLook,
  type SharedLook,
} from "@/lib/fashion/share";
import { copyText } from "@/lib/copy-text";
import CharacterCanvas, {
  type CharacterCanvasHandle,
} from "./character-canvas";
import PreviewStage from "./preview-stage";
import {
  NO_OUTFITS,
  OutfitCard,
  makeOutfit,
  parseOutfits,
  sameLook,
} from "./outfits";
import {
  FAVORITES_KEY,
  OUTFITS_KEY,
  PAGE_SIZE_KEY,
  useStored,
} from "./storage";
import { PageHeader } from "@/app/page-header";

/** 每頁幾件的選項。都是 2、3、4 的倍數，清單不管排幾欄最後一列都是滿的 */
const PAGE_SIZES = [24, 60, 120, 240];
const DEFAULT_PAGE_SIZE = 60;
const parsePageSize = (v: unknown) =>
  typeof v === "number" && PAGE_SIZES.includes(v) ? v : null;

/** 最愛存的是道具 id（髮型／臉型是「某個顏色的那一件」，不是整組造型） */
const NO_FAVORITES: number[] = [];
const parseFavorites = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((id): id is number => Number.isInteger(id))
    : null;

/** 右欄分頁：「全部」＋ 12 個部位＋「最愛」，外加不佔部位的「特效」 */
type Tab = FashionSlot | "all" | "favorites" | "effect";

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
      !g.variants.some(
        (v) => v.item.name.includes(q) || String(v.item.id) === q,
      )
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
  ...(item.hasEffect ? { fx: true } : {}),
  ...(item.slots ? { slots: item.slots } : {}),
});

/**
 * 分享連結或存下來的搭配 → 身上的裝備。網址是別人給的、存的那套也可能放了很久：
 * catalog 沒有的、畫不出來的直接略過
 */
function equipsFromIds(itemIds: number[]): CharacterLook["equips"] {
  const equips: CharacterLook["equips"] = {};
  for (const id of itemIds) {
    const item = fashionItem(id);
    if (item && item.preview !== "none") equips[item.slot] = toEquipped(item);
  }
  return equips;
}

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

/**
 * 下拉選單。原生的箭頭會貼在右邊框上、位置又調不了（圓角一大更擠），
 * 所以關掉原生外觀自己畫一個；className 只需要給圓角、底色與左側留白。
 */
function Select({
  className = "",
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select
        {...props}
        className={`w-full cursor-pointer appearance-none border border-[var(--border)] pr-8 outline-none focus:border-[var(--accent)] ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
    </span>
  );
}

/** 清單上的一格：點卡片試穿，右邊的星星收進最愛 */
function EntryCard({
  entry,
  active,
  notes,
  favorite,
  onEquip,
  onToggleFavorite,
}: {
  entry: GridEntry;
  active: boolean;
  /** 名稱底下那行小字 */
  notes: string[];
  favorite: boolean;
  onEquip: () => void;
  onToggleFavorite: () => void;
}) {
  const icon = (
    <ItemIcon
      key={entry.item.id}
      srcs={entry.item.hasIcon ? fashionIconSrcs(entry.item.id) : []}
      alt=""
    />
  );
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs">{entry.name}</span>
      {notes.length > 0 && (
        <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
          {notes.join("・")}
        </span>
      )}
    </span>
  );
  if (entry.unavailable) {
    return (
      <div
        title={`${entry.name}（素材庫沒有這件的圖，無法預覽）`}
        className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2 opacity-45"
      >
        {icon}
        {text}
      </div>
    );
  }
  return (
    // 星星不能包在卡片的 button 裡（button 不能巢狀），所以兩顆並排、星星疊在右邊
    <div className="relative">
      <button
        onClick={onEquip}
        title={entry.name}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border p-2 pr-8 text-left transition-colors ${
          active
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border)] hover:border-[var(--accent)]"
        }`}
      >
        {icon}
        {text}
      </button>
      <button
        onClick={onToggleFavorite}
        title={favorite ? "從最愛移除" : "加入最愛"}
        aria-label={`${favorite ? "從最愛移除" : "加入最愛"}：${entry.name}`}
        aria-pressed={favorite}
        className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors ${
          favorite
            ? "text-[var(--accent-text)]"
            : "text-[var(--border)] hover:text-[var(--accent-text)]"
        }`}
      >
        <Star size={15} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/** 頁碼列：上一頁／頁碼／下一頁，外加直接輸入頁碼跳頁 */
function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  /** 輸入框送出：超出範圍就夾到頭尾，不是數字就當沒輸入 */
  const jump = (input: HTMLInputElement) => {
    const n = Math.round(Number(input.value));
    if (!input.value.trim() || !Number.isFinite(n)) {
      input.value = String(page + 1);
      return;
    }
    const target = Math.min(pageCount, Math.max(1, n)) - 1;
    input.value = String(target + 1);
    if (target !== page) onChange(target);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-xs">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 transition-colors hover:border-[var(--accent)] disabled:opacity-40"
      >
        上一頁
      </button>
      {pageNumbers(page, pageCount).map((n, i) =>
        n === "…" ? (
          <span key={`dots-${i}`} className="px-1 text-[var(--text-muted)]">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-current={page === n ? "page" : undefined}
            className={`cursor-pointer min-w-[1.75rem] rounded-full border px-2 py-1 transition-colors ${
              page === n
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            {n + 1}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount - 1}
        className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 transition-colors hover:border-[var(--accent)] disabled:opacity-40"
      >
        下一頁
      </button>
      <label className="ml-2 flex items-center gap-1.5 text-[var(--text-muted)]">
        跳到第
        <input
          // 換頁之後用 key 重掛，輸入框才會跟著顯示新的頁碼
          key={page}
          type="number"
          inputMode="numeric"
          min={1}
          max={pageCount}
          defaultValue={page + 1}
          onKeyDown={(e) => {
            if (e.key === "Enter") jump(e.currentTarget);
          }}
          onBlur={(e) => jump(e.currentTarget)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`跳到第幾頁（共 ${pageCount} 頁）`}
          className="w-14 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-center text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        頁
      </label>
    </div>
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
  // 這兩樣存在瀏覽器裡，下次開還在（換瀏覽器或清資料就沒了，最愛分頁上有寫）
  const [pageSize, setPageSize] = useStored(
    PAGE_SIZE_KEY,
    DEFAULT_PAGE_SIZE,
    parsePageSize,
  );
  const [favorites, setFavorites] = useStored(
    FAVORITES_KEY,
    NO_FAVORITES,
    parseFavorites,
  );
  const [outfits, setOutfits] = useStored(
    OUTFITS_KEY,
    NO_OUTFITS,
    parseOutfits,
  );
  const [copied, setCopied] = useState(false);
  /** 正在編輯哪一套：點搭配卡片穿上、或剛存好的那套。「更新這套」就是寫回它 */
  const [editingId, setEditingId] = useState<number | null>(null);
  // 「儲存搭配」「更新這套」按下去之後各自亮一下的提示
  const [saved, setSaved] = useState(false);
  const [updated, setUpdated] = useState(false);
  /** 右欄最上面，換頁之後捲回這裡 */
  const listTopRef = useRef<HTMLDivElement>(null);

  const [action, setAction] = useState(DEFAULT_ACTION);
  const [expression, setExpression] = useState(DEFAULT_EXPRESSION);
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

  /** 整身換成某一套（分享連結、存下來的搭配） */
  const wear = useCallback((shared: SharedLook) => {
    const equips = equipsFromIds(shared.itemIds);
    setLook({ skinId: shared.skinId, equips });
    setAction(shared.action);
    setExpression(shared.expression);
    // 色票跟著身上的顏色走，不然接著點別的髮型會跳回黑色
    if (equips.hair) setHairColor(colorDigitOf("hair", equips.hair.id));
    if (equips.face) setFaceColor(colorDigitOf("face", equips.face.id));
  }, []);

  // 分享連結帶造型進來時套上去。網址只有瀏覽器讀得到，SSR 階段拿不到，
  // 所以只能掛載後才設 state（提前讀會 hydration 不一致）——做法同技能配點頁。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const shared = decodeLook(window.location.search);
    if (shared) wear(shared);
  }, [wear]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** 「全部」「最愛」與特效分頁沒有「目前部位」，底下用到部位的地方都要先擋掉 */
  const slot: FashionSlot | null =
    tab === "effect" || tab === "all" || tab === "favorites" ? null : tab;
  const grouped = slot !== null && GROUPED_SLOTS.has(slot);
  const palette = slot === "hair" ? HAIR_COLORS : FACE_COLORS;
  const selectedColor = slot === "hair" ? hairColor : faceColor;

  const q = query.trim();
  const list = useMemo<GridEntry[]>(() => {
    if (tab === "effect" || tab === "favorites") return [];
    // 「全部」照分頁順序把每個部位接起來；髮型／臉型沿用各自記住的顏色
    const slots = tab === "all" ? SLOT_LABELS.map((l) => l.slot) : [tab];
    return availableFirst(
      slots.flatMap((s) =>
        slotEntries(s, q, s === "hair" ? hairColor : faceColor),
      ),
    );
  }, [tab, q, hairColor, faceColor]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  /** 最愛分頁：照部位分區，一件一格（髮型／臉型不收成造型組，存的就是那個顏色） */
  const favoriteSections = useMemo(
    () =>
      SLOT_LABELS.map(({ slot: s, label }) => ({
        slot: s,
        label,
        entries: (BY_SLOT.get(s) ?? [])
          .filter((it) => favoriteSet.has(it.id))
          .map(
            (it): GridEntry => ({
              key: it.id,
              name: it.name,
              item: it,
              unavailable: it.preview === "none",
            }),
          ),
      })).filter((section) => section.entries.length > 0),
    [favoriteSet],
  );
  // chip 上的數字只算 catalog 裡還有的（存過的 id 之後被下架也不會多算）
  const favoriteCount = favoriteSections.reduce(
    (n, section) => n + section.entries.length,
    0,
  );
  const shownFavoriteSections = favoriteSections
    .map((section) => ({
      ...section,
      entries: section.entries.filter(
        (e) => !q || e.name.includes(q) || String(e.item.id) === q,
      ),
    }))
    .filter((section) => section.entries.length > 0);

  /** 搭配縮圖要畫的樣子：先 memo 起來，否則每次重畫都會丟新物件、縮圖整批重新合成 */
  const outfitLooks = useMemo(
    () =>
      new Map(
        outfits.map((o): [number, CharacterLook] => [
          o.id,
          { skinId: o.skinId, equips: equipsFromIds(o.itemIds) },
        ]),
      ),
    [outfits],
  );
  // 搜尋也吃搭配裡的道具名：找「森林護者」會連穿著它的那幾套一起列出來
  const shownOutfits = outfits.filter(
    (o) =>
      !q ||
      o.name.includes(q) ||
      o.itemIds.some((id) => fashionItem(id)?.name.includes(q)),
  );

  const renameOutfit = (id: number, name: string) =>
    setOutfits(outfits.map((o) => (o.id === id ? { ...o, name } : o)));
  const deleteOutfit = (id: number) =>
    setOutfits(outfits.filter((o) => o.id !== id));

  const toggleFavorite = (id: number) =>
    setFavorites(
      favoriteSet.has(id)
        ? favorites.filter((x) => x !== id)
        : [...favorites, id],
    );

  const effectList = useMemo(
    () =>
      fashionEffects.filter(
        (e) => !q || e.name.includes(q) || String(e.id) === q,
      ),
    [q],
  );

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const shown = list.slice(safePage * pageSize, (safePage + 1) * pageSize);

  /** 頁碼列換頁：順便捲回清單最上面，不然人還停在上一頁的底部 */
  const goToPage = (n: number) => {
    setPage(Math.min(pageCount - 1, Math.max(0, n)));
    // 系統設定「減少動態效果」的人直接到位，不滑
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    listTopRef.current?.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

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
  /** 目前這身，分享連結與儲存搭配共用 */
  const currentLook: SharedLook = {
    skinId: look.skinId,
    itemIds: equippedRows.map(({ slot: s }) => look.equips[s]!.id),
    action,
    expression,
  };

  /** 把目前這身造型編進網址、複製到剪貼簿 */
  const share = async () => {
    await copyText(
      `${window.location.origin}/fashion?${encodeLook(currentLook)}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // 被刪掉的話就找不到，「編輯中」那一列自己消失
  const editingOutfit = outfits.find((o) => o.id === editingId);
  const dirty =
    editingOutfit !== undefined && !sameLook(editingOutfit, currentLook);

  /**
   * 存成新的一套，排在最愛分頁「整身搭配」的最前面。
   * 一模一樣的也照存（想留兩份改成不同版本）；存完就算在編輯這套，接著改可以直接「更新這套」
   */
  const saveOutfit = () => {
    const outfit = makeOutfit(currentLook, outfits);
    setOutfits([outfit, ...outfits]);
    setEditingId(outfit.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  /** 把目前這身寫回正在編輯的那套（名稱與排列位置不動） */
  const updateOutfit = () => {
    setOutfits(
      outfits.map((o) => (o.id === editingId ? { ...o, ...currentLook } : o)),
    );
    setUpdated(true);
    setTimeout(() => setUpdated(false), 1800);
  };

  /** 身上有沒有穿這一格。exact＝要同一個顏色才算（最愛分頁存的是特定顏色） */
  const isWorn = (entry: GridEntry, exact: boolean) => {
    const worn = look.equips[entry.item.slot];
    if (!worn) return false;
    // 髮型／臉型的清單一格是一組造型：身上是同組任一顏色就算選中（換色前後都亮）
    return !exact && GROUPED_SLOTS.has(entry.item.slot)
      ? styleBaseId(entry.item.slot, worn.id) === entry.key
      : worn.id === entry.item.id;
  };

  /** 卡片名稱底下那行小字 */
  const notesOf = (entry: GridEntry) => {
    const s = entry.item.slot;
    const eyeColor = FACE_COLORS.find(
      (c) => c.digit === colorDigitOf("face", entry.item.id),
    )?.label;
    return [
      // 「全部」分頁各部位混在一起，多標一個部位——不然分不出是帽子還是飾品
      tab === "all" && SLOT_NAMES.get(s),
      // 臉型各色同名，最愛分頁要靠瞳色分辨（髮型的顏色本來就寫在名字裡）
      tab === "favorites" && s === "face" && eyeColor && `${eyeColor}瞳孔`,
      // 透明帽、技能效果這類：遊戲裡它本來就什麼都不畫，
      // 不先講的話點了沒反應會以為壞掉
      entry.item.preview === "blank" && "穿上不會顯示",
      entry.colorMissing && "無此色，以現有色代替",
      entry.unavailable && "無法預覽",
    ].filter((note): note is string => Boolean(note));
  };

  const renderCard = (entry: GridEntry) => (
    <EntryCard
      key={entry.key}
      entry={entry}
      active={isWorn(entry, tab === "favorites")}
      notes={notesOf(entry)}
      favorite={favoriteSet.has(entry.item.id)}
      onEquip={() => equip(entry.item)}
      onToggleFavorite={() => toggleFavorite(entry.item.id)}
    />
  );

  const emptyMessage =
    tab === "favorites"
      ? favoriteCount + outfits.length === 0
        ? "還沒有加入最愛：點卡片右邊的星星收藏單件，或按「儲存搭配」存下整身造型"
        : shownOutfits.length + shownFavoriteSections.length === 0 &&
          "沒有符合的最愛"
      : tab === "effect"
        ? effectList.length === 0 && "沒有符合的特效"
        : list.length === 0 && "沒有符合的道具";

  const customBackground = !BACKGROUNDS.some((b) => b.value === background);
  // 放大模式左欄吃掉 160px，清單少排一欄，卡片才不會窄到名稱只剩三個字
  const gridCols = expanded
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
    : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="space-y-8">
      <PageHeader title="時裝搭配" />

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
                <Select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="rounded-lg bg-[var(--bg)] py-1.5 pl-2"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-[var(--text-muted)]">表情</span>
                <Select
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="rounded-lg bg-[var(--bg)] py-1.5 pl-2"
                >
                  {EXPRESSIONS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-[var(--text-muted)]">膚色</span>
                <Select
                  value={look.skinId}
                  onChange={(e) =>
                    setLook((p) => ({ ...p, skinId: Number(e.target.value) }))
                  }
                  className="rounded-lg bg-[var(--bg)] py-1.5 pl-2"
                >
                  {SKINS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
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
                className="mt-0.5 shrink-0 text-[var(--accent-text)]"
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
            {/* 窄螢幕塞不下一列時，兩顆按鈕一起換到下一列、靠右 */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                目前穿著
              </span>
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={saveOutfit}
                  disabled={equippedRows.length === 0}
                  title={
                    editingOutfit
                      ? `存成新的一套，「${editingOutfit.name}」不會變`
                      : "把這身存進「最愛」分頁，之後點一下就能整身穿回來"
                  }
                  className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:cursor-default disabled:opacity-40 ${
                    saved
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                  }`}
                >
                  {saved ? <Check size={12} /> : <BookmarkPlus size={12} />}
                  {saved
                    ? "已存到最愛"
                    : editingOutfit
                      ? "另存新搭配"
                      : "儲存搭配"}
                </button>
                <button
                  onClick={share}
                  title="把這身造型編進網址，複製後貼給朋友或自己留著"
                  className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    copied
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                  }`}
                >
                  {copied ? <Check size={12} /> : <Link2 size={12} />}
                  {copied ? "已複製連結" : "分享造型"}
                </button>
              </div>
            </div>
            {/* 改了東西才出現「更新這套」；✕ 只是不再跟那套連動，已存的不會變 */}
            {editingOutfit && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">
                  編輯中：
                  <span className="text-[var(--text)]">
                    {editingOutfit.name}
                  </span>
                  {dirty && "・有改動"}
                </span>
                {(dirty || updated) && (
                  <button
                    onClick={updateOutfit}
                    disabled={updated}
                    title={`把目前這身寫回「${editingOutfit.name}」`}
                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[var(--text)] disabled:cursor-default"
                  >
                    {updated ? <Check size={12} /> : <Save size={12} />}
                    {updated ? "已更新" : "更新這套"}
                  </button>
                )}
                <button
                  onClick={() => setEditingId(null)}
                  title="不編輯這套了（已存的不會變）"
                  aria-label={`不編輯「${editingOutfit.name}」了`}
                  className="shrink-0 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <X size={12} />
                </button>
              </div>
            )}
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
        {/* scroll-mt：換頁捲回這裡時上面留一點空，不要貼齊視窗邊緣 */}
        <div ref={listTopRef} className="scroll-mt-4 space-y-3">
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
            <button
              onClick={() => changeTab("favorites")}
              className={`flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs transition-colors ${
                tab === "favorites"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
              }`}
            >
              <Star
                size={11}
                className="mr-1 text-[var(--accent-text)]"
                fill="currentColor"
              />
              最愛
              <span className="ml-1 opacity-60">
                {favoriteCount + outfits.length}
              </span>
            </button>
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
            {tab !== "favorites" && tab !== "effect" && (
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                每頁
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="rounded-full bg-[var(--surface)] py-2 pl-3.5 text-[var(--text)]"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} 件
                    </option>
                  ))}
                </Select>
              </label>
            )}
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

          {tab !== "effect" && tab !== "favorites" && (
            <div className={`grid gap-2 ${gridCols}`}>
              {shown.map(renderCard)}
            </div>
          )}

          {tab === "favorites" && (
            <>
              {/* 純文字一行、不包框：上面是搜尋框、下面是清單或空狀態，再多一個框就三層疊在一起 */}
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                最愛只存在這個瀏覽器，換瀏覽器或裝置、清除瀏覽資料、太久沒來都可能不見。
              </p>
              {shownOutfits.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold text-[var(--text-muted)]">
                    整身搭配
                    <span className="ml-1 font-normal opacity-60">
                      {shownOutfits.length}
                    </span>
                  </h2>
                  <div className={`grid gap-2 ${gridCols}`}>
                    {shownOutfits.map((o) => (
                      <OutfitCard
                        key={o.id}
                        outfit={o}
                        look={outfitLooks.get(o.id)!}
                        // 亮的是正在編輯的那套（同一身可以存好幾份，照樣子比會一起亮）
                        active={o.id === editingId}
                        onWear={() => {
                          wear(o);
                          setEditingId(o.id);
                        }}
                        onRename={(name) => renameOutfit(o.id, name)}
                        onDelete={() => deleteOutfit(o.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
              {shownFavoriteSections.map((section) => (
                <section key={section.slot} className="space-y-2">
                  <h2 className="text-xs font-semibold text-[var(--text-muted)]">
                    {section.label}
                    <span className="ml-1 font-normal opacity-60">
                      {section.entries.length}
                    </span>
                  </h2>
                  <div className={`grid gap-2 ${gridCols}`}>
                    {section.entries.map(renderCard)}
                  </div>
                </section>
              ))}
            </>
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

          {emptyMessage && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              {emptyMessage}
            </div>
          )}

          {pageCount > 1 && (
            <Pagination
              page={safePage}
              pageCount={pageCount}
              onChange={goToPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
