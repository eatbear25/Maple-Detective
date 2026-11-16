// 分類 chip：任務查詢與地圖導覽共用。兩頁都是「第一排大分類、選了才出現第二排小分類」，
// 同一個概念不該在兩頁長得不一樣，所以樣式只有這一份。
// 第二排用 FilterChipSubRow 包起來（左邊一條線＋矮一點的 chip），看得出是上一排選中那顆的下一層。

export function FilterChip({
  label,
  active,
  icon,
  small,
  onClick,
}: {
  label: string;
  active: boolean;
  /** 放在字前面的 lucide 圖示（12px）。不要用 emoji，跟全站的線條圖示搭不起來 */
  icon?: React.ReactNode;
  /** 第二排的小分類：矮一點，跟第一排分得出層級 */
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer inline-flex shrink-0 items-center gap-1 rounded-full border text-xs transition-colors ${
        small ? "px-2.5 py-0.5" : "px-3 py-1"
      } ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** 第二排的容器。用換行不用橫向捲：窄視窗也要一眼看得到全部 */
export function FilterChipSubRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5 border-l-2 border-[var(--border-strong)] pl-2">
      {children}
    </div>
  );
}
