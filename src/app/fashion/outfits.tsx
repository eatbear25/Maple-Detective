"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { CharacterLook } from "@/lib/fashion/config";
import { normalizeLook, type SharedLook } from "@/lib/fashion/share";
import CharacterCanvas from "./character-canvas";

/**
 * 存在瀏覽器裡的整身搭配（「目前穿著」的「儲存搭配」）。
 * 存的東西跟分享連結一樣：膚色、道具 id、動作、表情；背景與縮放不存。
 */
export interface SavedOutfit extends SharedLook {
  /** 存下來的時間（Date.now()），兼當識別碼 */
  id: number;
  name: string;
}

export const NO_OUTFITS: SavedOutfit[] = [];

const NAME_MAX = 20;

/** 驗 localStorage 讀出來的東西；壞掉的那幾筆丟掉，其餘照留 */
export function parseOutfits(v: unknown): SavedOutfit[] | null {
  if (!Array.isArray(v)) return null;
  return v.flatMap((raw): SavedOutfit[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const { id, name, skinId, itemIds, action, expression } = raw as Record<
      string,
      unknown
    >;
    if (typeof id !== "number" || typeof name !== "string") return [];
    if (!Array.isArray(itemIds)) return [];
    return [
      { id, name, ...normalizeLook({ skinId, itemIds, action, expression }) },
    ];
  });
}

/** 兩套是不是同一身（道具順序不算） */
export function sameLook(a: SharedLook, b: SharedLook) {
  if (
    a.skinId !== b.skinId ||
    a.action !== b.action ||
    a.expression !== b.expression ||
    a.itemIds.length !== b.itemIds.length
  ) {
    return false;
  }
  const ids = new Set(a.itemIds);
  return b.itemIds.every((id) => ids.has(id));
}

/**
 * 把一身包成新的一套。預設名稱「搭配 N」，跳過已經用掉的號碼（刪過幾套之後不會撞名）。
 * 只能在按鈕的事件裡叫（Date.now() 不能出現在 render 裡）
 */
export function makeOutfit(
  look: SharedLook,
  existing: SavedOutfit[],
): SavedOutfit {
  let n = existing.length + 1;
  while (existing.some((o) => o.name === `搭配 ${n}`)) n++;
  return { id: Date.now(), name: `搭配 ${n}`, ...look };
}

/** 最愛分頁裡的一套：點卡片整身穿上，右上角刪除、名稱旁邊改名 */
export function OutfitCard({
  outfit,
  look,
  active,
  onWear,
  onRename,
  onDelete,
}: {
  outfit: SavedOutfit;
  /** 縮圖要畫的樣子（父層先 memo 好，不然每次重畫都會重新合成） */
  look: CharacterLook;
  active: boolean;
  onWear: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // 刪掉就回不來，所以要按兩下：第一下變成「確定刪除」，移開就取消
  const [confirming, setConfirming] = useState(false);

  const commit = (input: HTMLInputElement) => {
    const name = input.value.trim();
    if (name && name !== outfit.name) onRename(name);
    setEditing(false);
  };

  return (
    <div
      onMouseLeave={() => setConfirming(false)}
      className={`relative rounded-lg border transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] hover:border-[var(--accent)]"
      }`}
    >
      {/* 按鈕不能巢狀，改名與刪除兩顆疊在卡片上 */}
      <button
        onClick={onWear}
        title={`穿上「${outfit.name}」`}
        className="block w-full cursor-pointer p-2 text-left"
      >
        <span className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-[var(--surface)]">
          <CharacterCanvas
            look={look}
            action={outfit.action}
            expression={outfit.expression}
            animated={false}
            flipX={false}
            scale={2}
            maxHeight={120}
          />
        </span>
        {!editing && (
          <span className="mt-1.5 block truncate pr-6 text-xs">
            {outfit.name}
          </span>
        )}
      </button>

      {editing && (
        <input
          autoFocus
          defaultValue={outfit.name}
          maxLength={NAME_MAX}
          aria-label="搭配名稱"
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget);
            if (e.key === "Escape") setEditing(false);
          }}
          className="mx-2 mb-2 block w-[calc(100%-1rem)] rounded border border-[var(--accent)] bg-[var(--surface)] px-1.5 py-0.5 text-xs outline-none"
        />
      )}

      {!editing && (
        <button
          onClick={() => setEditing(true)}
          title="改名"
          aria-label={`改名：${outfit.name}`}
          className="absolute bottom-1.5 right-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <Pencil size={12} />
        </button>
      )}

      <button
        onClick={() => (confirming ? onDelete() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        title={confirming ? "再按一次刪除" : "刪除這套"}
        aria-label={
          confirming ? `確定刪除：${outfit.name}` : `刪除：${outfit.name}`
        }
        className={`absolute right-3 top-3 flex h-6 cursor-pointer items-center justify-center gap-1 rounded-full border text-xs transition-colors ${
          confirming
            ? "border-[var(--accent)] bg-[var(--surface)] px-2 text-[var(--text)]"
            : "w-6 border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
        }`}
      >
        <Trash2 size={12} />
        {confirming && "確定刪除"}
      </button>
    </div>
  );
}
