"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { bossList, type BossDef } from "@/data/bosses";
import { mobIconSrc } from "@/data/drops";
import { GameIcon } from "../monsters/game-icon";
import {
  decodeShare,
  encodeShare,
  killKey,
  useBossTimerState,
  type IntervalMap,
  type KillMap,
  type KillRecord,
} from "./storage";
import {
  canEditInterval,
  effectiveInterval,
  formatClock,
  formatCountdown,
  respawnRange,
  type Interval,
} from "./logic";

const bossById: Record<string, BossDef> = Object.fromEntries(
  bossList.map((b) => [b.id, b]),
);

/** 「重新擊殺」「移除追蹤」「全部清除」都是一按就蓋掉舊記錄，按完這段時間內可以復原 */
const UNDO_WINDOW_MS = 8000;

interface UndoState {
  /** 被蓋掉／刪掉之前的記錄，復原就是把它們寫回去（全部清除時會有很多筆） */
  records: KillRecord[];
  action: "rekill" | "remove" | "clear";
  expiresAt: number;
}

/** 按 Esc 關閉彈窗，所有彈窗共用 */
function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export default function BossTimerPage() {
  return (
    <Suspense fallback={null}>
      <BossTimerApp />
    </Suspense>
  );
}

function BossTimerApp() {
  const {
    kills,
    intervals,
    pinned,
    loaded,
    upsertKill,
    togglePin,
    removeKill,
    clearKills,
    importShared,
    setIntervalOverride,
    clearIntervalOverride,
  } = useBossTimerState();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [addingBoss, setAddingBoss] = useState<BossDef | null>(null);
  const [editingIntervalBoss, setEditingIntervalBoss] =
    useState<BossDef | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // 過期不另外開計時器清掉，直接跟每秒跳一次的 now 比
  const [undo, setUndo] = useState<UndoState | null>(null);
  const activeUndo = undo && now < undo.expiresAt ? undo : null;
  const armUndo = (
    records: KillRecord[],
    action: UndoState["action"],
    at: number,
  ) => setUndo({ records, action, expiresAt: at + UNDO_WINDOW_MS });

  // 分享連結匯入：解析出來但還沒套用，等使用者在確認彈窗按下確定
  const shareParam = searchParams.get("share");
  const [pendingImport, setPendingImport] = useState<{
    kills: KillRecord[];
    intervals: [string, Interval][];
  } | null>(null);

  useEffect(() => {
    if (!loaded || !shareParam) return;
    const decoded = decodeShare(shareParam);
    if (decoded) setPendingImport(decoded);
    // 不管解析成不成功，網址上的 ?share= 用完就清掉，避免重新整理又跳一次
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在 loaded/shareParam 首次就緒時跑一次
  }, [loaded, shareParam]);

  const rows = useMemo(() => {
    return Object.values(kills)
      .map((k) => {
        const interval = effectiveInterval(k.bossId, intervals, bossById);
        if (!interval) return null;
        const boss = bossById[k.bossId];
        if (!boss) return null;
        const range = respawnRange(k.killedAt, interval);
        return { record: k, boss, interval, ...range };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.minTime - b.minTime);
  }, [kills, intervals]);

  // 釘選的排前面（照釘選先後），其餘維持原本順序
  const { pinnedBosses, orderedBosses } = useMemo(() => {
    const pinnedBosses = pinned
      .map((id) => bossById[id])
      .filter((b): b is BossDef => b !== undefined);
    return {
      pinnedBosses,
      orderedBosses: [
        ...pinnedBosses,
        ...bossList.filter((b) => !pinned.includes(b.id)),
      ],
    };
  }, [pinned]);

  const diff = useMemo(() => {
    if (!pendingImport) return null;
    let overwrite = 0;
    for (const k of pendingImport.kills) {
      if (kills[killKey(k.bossId, k.channel)]) overwrite++;
    }
    return { total: pendingImport.kills.length, overwrite };
  }, [pendingImport, kills]);

  // 彈窗、右下角按鈕、復原提示這些 fixed 元素要放在 space-y 容器外面：
  // space-y 會幫「不是最後一個」的子元素加 margin-bottom，fixed 元素吃到的話
  // 會被往上推 32px（按鈕跟提示撞在一起、彈窗遮罩底部缺一條）
  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BOSS 計時器</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            記錄擊殺時間，自動推算下次重生時間。資料存在你的瀏覽器裡，重生時間為玩家回報，僅供參考。
          </p>
        </div>

        {/* BOSS 區刻意做成小圖示格、放最上面：這頁兩件事都很常做——看倒數、記新的擊殺。
            大卡片版不管放上面（手機要捲 700px 才看得到清單）還是放下面（清單一長就要捲很久才能加）
            都會擋到其中一件；縮成兩列以內，兩邊都不用捲。設定時間等次要操作收進點開後的彈窗 */}
        <div>
          <h2
            className="mb-3 text-sm font-semibold"
            style={{ color: "var(--accent)" }}
          >
            選擇 BOSS
          </h2>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
            {orderedBosses.map((boss) => (
              <BossTile
                key={boss.id}
                boss={boss}
                pinned={pinned.includes(boss.id)}
                onTogglePin={() => togglePin(boss.id)}
                interval={effectiveInterval(boss.id, intervals, bossById)}
                onOpen={() => setAddingBoss(boss)}
                onEditInterval={
                  canEditInterval(boss, intervals)
                    ? () => setEditingIntervalBoss(boss)
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--accent)" }}
            >
              我的追蹤清單
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              ({rows.length})
            </span>
            {rows.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setClearConfirmOpen(true)}
                  title="清除全部擊殺記錄"
                  className="cursor-pointer flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-red-400 hover:text-red-400"
                >
                  <Trash2 size={13} />
                  <span>
                    <span className="hidden sm:inline">全部</span>清除
                  </span>
                </button>
                <button
                  onClick={() => setShareOpen(true)}
                  className="cursor-pointer flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
                >
                  <Share2 size={13} />
                  <span>
                    分享<span className="hidden sm:inline">清單</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
              還沒有追蹤中的 BOSS，點上面的 BOSS 圖示新增擊殺記錄。
            </div>
          ) : (
            // 欄數挑到每張卡至少 290px 寬：再窄的話頻道、擊殺時間、倒數都會被擠到換行。
            // 手機單欄還有一個好處——清單依重生時間排序，由上往下讀就是先後順序
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((r) => (
                <TrackedRow
                  key={killKey(r.record.bossId, r.record.channel)}
                  {...r}
                  now={now}
                  onRekillNow={() => {
                    const at = Date.now();
                    armUndo([r.record], "rekill", at);
                    upsertKill(r.record.bossId, r.record.channel, at);
                  }}
                  onRemove={() => {
                    armUndo([r.record], "remove", Date.now());
                    removeKill(r.record.bossId, r.record.channel);
                  }}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {addingBoss && !editingIntervalBoss && (
        <KillFormModal
          boss={addingBoss}
          tracked={Object.values(kills)
            .filter((k) => k.bossId === addingBoss.id)
            .sort((a, b) => a.channel - b.channel)}
          interval={effectiveInterval(addingBoss.id, intervals, bossById)}
          onEditInterval={
            canEditInterval(addingBoss, intervals)
              ? () => setEditingIntervalBoss(addingBoss)
              : undefined
          }
          onClose={() => setAddingBoss(null)}
          onSubmit={(channel, killedAt, interval) => {
            upsertKill(addingBoss.id, channel, killedAt, interval);
            setAddingBoss(null);
          }}
        />
      )}

      {editingIntervalBoss && (
        <IntervalModal
          boss={editingIntervalBoss}
          interval={effectiveInterval(
            editingIntervalBoss.id,
            intervals,
            bossById,
          )}
          // 只有改過的才有東西可以清：有預設值的回到預設值，沒有的變回未設定
          onReset={
            intervals[editingIntervalBoss.id]
              ? () => {
                  clearIntervalOverride(editingIntervalBoss.id);
                  setEditingIntervalBoss(null);
                }
              : undefined
          }
          onClose={() => setEditingIntervalBoss(null)}
          onSubmit={(interval) => {
            setIntervalOverride(editingIntervalBoss.id, interval);
            setEditingIntervalBoss(null);
          }}
        />
      )}

      {clearConfirmOpen && (
        <ClearConfirmModal
          total={rows.length}
          onCancel={() => setClearConfirmOpen(false)}
          onConfirm={() => {
            // 連畫面上沒列出來的（BOSS 的重生間隔被清掉的）也一起清，復原時整包還回去
            armUndo(Object.values(kills), "clear", Date.now());
            clearKills();
            setClearConfirmOpen(false);
          }}
        />
      )}

      {shareOpen && (
        <ShareModal
          kills={kills}
          intervals={intervals}
          onClose={() => setShareOpen(false)}
        />
      )}

      {pendingImport && diff && (
        <ImportConfirmModal
          total={diff.total}
          overwrite={diff.overwrite}
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            importShared(pendingImport.kills, pendingImport.intervals);
            setPendingImport(null);
          }}
        />
      )}

      <QuickAddButton
        pinnedBosses={pinnedBosses}
        onPick={(boss) => setAddingBoss(boss)}
      />

      {activeUndo && (
        <UndoToast
          undo={activeUndo}
          now={now}
          onUndo={() => {
            importShared(activeUndo.records, []);
            setUndo(null);
          }}
        />
      )}
    </>
  );
}

/** 右下角常駐的快速擊殺：清單捲到多下面都按得到，不用回頂端找 BOSS。
 *  只列釘選的 BOSS（這顆按鈕的意義就是「我常打的那幾隻」）；一隻都沒釘選時退回列全部 */
function QuickAddButton({
  pinnedBosses,
  onPick,
}: {
  pinnedBosses: BossDef[];
  onPick: (boss: BossDef) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hasPinned = pinnedBosses.length > 0;
  const choices = hasPinned ? pinnedBosses : bossList;

  return (
    <>
      {/* 點選單外面任何地方都會收起來 */}
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      )}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {open && (
          <div className="w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
            <div className="px-2 pb-1 pt-1 text-xs font-semibold text-[var(--text-muted)]">
              {hasPinned ? "記錄擊殺・釘選的 BOSS" : "記錄擊殺"}
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {choices.map((boss) => (
                <button
                  key={boss.id}
                  onClick={() => {
                    setOpen(false);
                    onPick(boss);
                  }}
                  className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]"
                >
                  <GameIcon
                    src={mobIconSrc(boss.id)}
                    alt=""
                    fallback="👑"
                    className="h-7 w-7 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">{boss.name}</span>
                </button>
              ))}
            </div>
            {!hasPinned && (
              <p className="border-t border-[var(--border)] px-2 pb-1 pt-1.5 text-[11px] text-[var(--text-muted)]">
                按 BOSS 右上角的星星，這裡就只列你常打的。
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => {
            // 只釘選一隻的話沒有東西好選，直接開那隻的擊殺彈窗，少點一下
            if (!open && pinnedBosses.length === 1) onPick(pinnedBosses[0]);
            else setOpen((v) => !v);
          }}
          aria-label="快速記錄擊殺"
          aria-expanded={open}
          title="快速記錄擊殺"
          className="cursor-pointer flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
          style={{ background: "var(--accent)" }}
        >
          <Plus
            size={24}
            className={`transition-transform ${open ? "rotate-45" : ""}`}
          />
        </button>
      </div>
    </>
  );
}

function UndoToast({
  undo,
  now,
  onUndo,
}: {
  undo: UndoState;
  now: number;
  onUndo: () => void;
}) {
  const first = undo.records[0];
  const label =
    undo.action === "clear"
      ? `已清除全部 ${undo.records.length} 筆`
      : `${undo.action === "rekill" ? "已重新計時" : "已移除"}・${
          bossById[first.bossId]?.name ?? "BOSS"
        } ${first.channel} 頻`;
  // now 每秒才跳一次，剛按下去那一刻會多算將近一秒，所以上限夾在視窗長度
  const secondsLeft = Math.min(
    UNDO_WINDOW_MS / 1000,
    Math.max(1, Math.ceil((undo.expiresAt - now) / 1000)),
  );
  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 sm:bottom-4 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-4 pr-2 text-sm shadow-xl"
    >
      <span className="min-w-0 truncate">{label}</span>
      <button
        onClick={onUndo}
        className="cursor-pointer flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition-colors"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Undo2 size={13} />
        復原（{secondsLeft}）
      </button>
    </div>
  );
}

function formatInterval(interval: Interval): string {
  return interval.min === interval.max
    ? `${interval.min} 分`
    : `${interval.min}~${interval.max} 分`;
}

function BossTile({
  boss,
  interval,
  pinned,
  onOpen,
  onEditInterval,
  onTogglePin,
}: {
  boss: BossDef;
  interval: Interval | null;
  pinned: boolean;
  /** 開擊殺彈窗 */
  onOpen: () => void;
  /** 直接開重生時間設定，不用先繞去擊殺彈窗；沒給＝這隻的重生時間是固定的、不能改 */
  onEditInterval?: () => void;
  onTogglePin: () => void;
}) {
  // 一格裡有三種操作（記擊殺／設定時間／釘選），所以外層是 div、裡面各自是獨立的按鈕；
  // 圖示＋名字與下面那顆「擊殺」做同一件事，前者只給滑鼠／觸控用，鍵盤與讀屏走後者
  return (
    <div className="relative flex flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-1.5 pb-2 pt-2.5 text-center transition-colors hover:border-[var(--accent)]">
      <button
        onClick={onOpen}
        tabIndex={-1}
        aria-hidden
        className="cursor-pointer flex w-full flex-col items-center"
      >
        <GameIcon
          src={mobIconSrc(boss.id)}
          alt=""
          fallback="👑"
          className="h-10 w-10"
        />
        <span className="mt-1 w-full truncate text-xs font-medium">
          {boss.name}
        </span>
      </button>
      {onEditInterval ? (
        <button
          onClick={onEditInterval}
          title="設定重生時間"
          aria-label={`設定${boss.name}的重生時間`}
          className={`cursor-pointer flex max-w-full items-center justify-center gap-0.5 py-0.5 text-[11px] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent)] ${
            interval ? "text-[var(--text-muted)]" : "text-[var(--accent)]"
          }`}
        >
          <span className="truncate">
            {interval ? formatInterval(interval) : "未設定"}
          </span>
          <Pencil size={10} className="hidden shrink-0 md:block" />
        </button>
      ) : (
        <span className="max-w-full truncate py-0.5 text-[11px] text-[var(--text-muted)]">
          {interval && formatInterval(interval)}
        </span>
      )}
      <button
        onClick={onOpen}
        title={`記錄擊殺：${boss.name}`}
        aria-label={`記錄擊殺：${boss.name}`}
        className="cursor-pointer mt-1 flex w-full max-w-28 items-center justify-center gap-0.5 rounded-full py-1 text-[11px] font-medium"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Plus size={11} />
        擊殺
      </button>
      <button
        onClick={onTogglePin}
        aria-pressed={pinned}
        title={pinned ? "取消釘選" : "釘選到最前面"}
        aria-label={pinned ? `取消釘選${boss.name}` : `釘選${boss.name}`}
        className={`cursor-pointer absolute right-0 top-0 flex h-6 w-6 items-center justify-center transition-colors md:h-7 md:w-7 ${
          pinned
            ? "text-[var(--accent)]"
            : "text-[var(--text-muted)] hover:text-[var(--accent)]"
        }`}
      >
        <Star size={15} fill={pinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function TrackedRow({
  record,
  boss,
  minTime,
  maxTime,
  now,
  onRekillNow,
  onRemove,
}: {
  record: KillRecord;
  boss: BossDef;
  interval: Interval;
  minTime: number;
  maxTime: number;
  now: number;
  onRekillNow: () => void;
  onRemove: () => void;
}) {
  const passed = now >= maxTime;
  const inRange = !passed && now >= minTime;
  // 最快重生時間一到 BOSS 就可能已經出來了，從這一刻起就要能記下一次擊殺，
  // 不能等到最晚時間（45~60 分的 BOSS 在 45 分重生的話，會白等 15 分鐘按不到）
  const canRekill = passed || inRange;

  let statusLabel: string;
  let countdown: string | null = null;
  if (passed) {
    statusLabel = "應該已重生";
  } else if (inRange) {
    statusLabel = "可能已重生";
    countdown = `最晚還要 ${formatCountdown(maxTime - now)}`;
  } else {
    statusLabel = "距最快重生時間";
    countdown = formatCountdown(minTime - now);
  }

  return (
    <div
      className={`relative rounded-xl border p-3 transition-colors ${
        passed
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : inRange
            ? "border-[var(--accent)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      {/* 卡片在手機兩欄時只有 160~200px：名字那一列只放名字，頻道與擊殺時間放第二列，
          放不下就整塊換行，不會把一句話從中間切斷。垃圾桶釘在卡片右上角、吃卡片的 padding，
          少佔一點名字的寬度（不然「殭屍蘑菇王」在 375px 的手機上會被截斷） */}
      <button
        onClick={onRemove}
        title="移除追蹤"
        aria-label="移除追蹤"
        className="cursor-pointer absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-red-400"
      >
        <Trash2 size={14} />
      </button>
      <div className="flex items-start gap-2">
        <GameIcon
          src={mobIconSrc(boss.id)}
          alt={boss.name}
          fallback="👑"
          className="h-9 w-9 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate pr-4 text-sm font-medium" title={boss.name}>
            {boss.name}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-muted)]">
            {/* 頻道是「要去哪一頻」的關鍵資訊，用強調色；底色固定用 surface，
                這樣在「應該已重生」那張 accent-soft 底的卡片上也不會融進去 */}
            <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--accent)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--accent)]">
              {record.channel} 頻
            </span>
            <span className="whitespace-nowrap">
              擊殺於 {formatClock(record.killedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
        <div
          className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold tabular-nums"
          style={{ color: canRekill ? "var(--accent)" : undefined }}
        >
          <span className="whitespace-nowrap">{statusLabel}</span>
          {countdown && (
            <span
              className={
                inRange
                  ? "whitespace-nowrap text-xs font-normal text-[var(--text-muted)]"
                  : "whitespace-nowrap"
              }
            >
              {countdown}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {minTime === maxTime
            ? formatClock(minTime)
            : `${formatClock(minTime)}〜${formatClock(maxTime)}`}
        </div>
      </div>

      {canRekill && (
        <button
          onClick={onRekillNow}
          className="cursor-pointer mt-2.5 flex w-full items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          // 已過最晚時間的卡片整張是 accent-soft 底，按鈕再用同色會融進去看不出是按鈕
          style={
            passed
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--accent-soft)", color: "var(--accent)" }
          }
        >
          <RotateCcw size={13} />
          重新擊殺
        </button>
      )}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

/** 重生間隔的「最短〜最長」兩格輸入，擊殺彈窗與設定彈窗共用 */
function useIntervalFields(initial: Interval | null) {
  const [min, setMin] = useState(String(initial?.min ?? ""));
  const [max, setMax] = useState(String(initial?.max ?? ""));
  const minNum = parseFloat(min);
  const maxNum = parseFloat(max);
  const value: Interval | null =
    minNum > 0 && !Number.isNaN(maxNum) && maxNum >= minNum
      ? { min: minNum, max: maxNum }
      : null;
  return { min, max, setMin, setMax, value };
}

function IntervalFields({
  fields,
  autoFocus,
}: {
  fields: ReturnType<typeof useIntervalFields>;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
        重生間隔（分鐘）
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={fields.min}
          onChange={(e) => fields.setMin(e.target.value)}
          placeholder="最短"
          aria-label="最短重生間隔（分鐘）"
          autoFocus={autoFocus}
          className={INPUT_CLASS}
        />
        <span className="text-[var(--text-muted)]">〜</span>
        <input
          type="number"
          min={1}
          value={fields.max}
          onChange={(e) => fields.setMax(e.target.value)}
          placeholder="最長"
          aria-label="最長重生間隔（分鐘）"
          className={INPUT_CLASS}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        固定重生時間可以填一樣的數字；這裡的設定會套用到這隻 BOSS 所有頻道。
      </p>
    </div>
  );
}

function ModalHeader({
  boss,
  title,
  onClose,
}: {
  boss: BossDef;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
      <GameIcon
        src={mobIconSrc(boss.id)}
        alt={boss.name}
        fallback="👑"
        className="h-6 w-6 shrink-0"
      />
      <span className="text-sm font-semibold">
        {title} · {boss.name}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="關閉"
        className="cursor-pointer ml-auto text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function KillFormModal({
  boss,
  tracked,
  interval,
  onEditInterval,
  onClose,
  onSubmit,
}: {
  boss: BossDef;
  /** 這隻 BOSS 已經在追蹤清單裡的記錄（依頻道排序） */
  tracked: KillRecord[];
  /** 這隻 BOSS 目前的重生間隔；null = 還沒設定過，這時才在彈窗裡一併問 */
  interval: Interval | null;
  /** 沒給＝這隻的重生時間是固定的、不能改 */
  onEditInterval?: () => void;
  onClose: () => void;
  onSubmit: (channel: number, killedAt: number, interval?: Interval) => void;
}) {
  // 擊殺時間鎖定「現在」不給選，開啟彈窗那一刻就固定下來，跟送出時記錄的值一致
  const [killedAt] = useState(() => Date.now());
  const [channel, setChannel] = useState("");
  const fields = useIntervalFields(null);

  useEscapeToClose(onClose);

  const channelNum = parseInt(channel, 10);
  const channelValid =
    Number.isInteger(channelNum) && channelNum >= 1 && channelNum <= 60;
  // 同 BOSS 同頻道已經在追蹤就不給新增：記錄是以 BOSS＋頻道為鍵，送出會直接蓋掉舊的擊殺時間，
  // 沒注意到就重複按的話舊記錄默默不見。真的要重新計時走清單卡片上的「重新擊殺」（有復原）
  const duplicate = channelValid
    ? tracked.find((k) => k.channel === channelNum)
    : undefined;
  // 已經有重生間隔的 BOSS 只要填頻道就能送出，間隔要改按下面那顆「修改」
  const newInterval = interval ? undefined : fields.value;
  const valid =
    channelValid && !duplicate && (interval !== null || newInterval != null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(channelNum, killedAt, newInterval ?? undefined);
        }}
      >
        <ModalHeader boss={boss} title="新增擊殺記錄" onClose={onClose} />

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              頻道（1~60）
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              aria-label="頻道"
              aria-invalid={duplicate ? true : undefined}
              aria-describedby={duplicate ? "kill-channel-dup" : undefined}
              autoFocus
              className={`${INPUT_CLASS} ${duplicate ? "!border-red-400" : ""}`}
            />
            {duplicate && (
              <p id="kill-channel-dup" className="mt-1 text-xs text-red-400">
                同頻道已經在追蹤了
              </p>
            )}
          </div>

          {interval === null && <IntervalFields fields={fields} />}

          {interval && (
            <div className="text-xs text-[var(--text-muted)]">
              <p className="flex items-center gap-2">
                重生間隔 {formatInterval(interval)}
                {onEditInterval && (
                  <button
                    type="button"
                    onClick={onEditInterval}
                    className="cursor-pointer flex items-center gap-1 text-[var(--accent)] hover:underline"
                  >
                    <Pencil size={11} />
                    修改
                  </button>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
          <a
            href={`/monsters?id=${boss.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="在新視窗查看掉落資訊"
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            掉落資訊
            <ExternalLink size={11} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer ml-auto rounded-full px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            確定
          </button>
        </div>
      </form>
    </div>
  );
}

function IntervalModal({
  boss,
  interval,
  onReset,
  onClose,
  onSubmit,
}: {
  boss: BossDef;
  interval: Interval | null;
  /** 有值代表目前的間隔是使用者改過的，可以清掉 */
  onReset?: () => void;
  onClose: () => void;
  onSubmit: (interval: Interval) => void;
}) {
  const fields = useIntervalFields(interval);
  useEscapeToClose(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (fields.value) onSubmit(fields.value);
        }}
      >
        <ModalHeader boss={boss} title="設定重生時間" onClose={onClose} />

        <div className="p-4">
          <IntervalFields fields={fields} autoFocus />
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer rounded-full px-2 py-1.5 text-sm text-[var(--text-muted)] hover:text-red-400"
            >
              {boss.defaultRespawnMin != null ? "恢復預設" : "清除設定"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer ml-auto rounded-full px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!fields.value}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            儲存
          </button>
        </div>
      </form>
    </div>
  );
}

function ShareModal({
  kills,
  intervals,
  onClose,
}: {
  kills: KillMap;
  intervals: IntervalMap;
  onClose: () => void;
}) {
  useEscapeToClose(onClose);
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => {
    const share = encodeShare(kills, intervals);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/boss-timer?share=${share}`;
  }, [kills, intervals]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 權限被擋的話，使用者可以直接從下面的輸入框手動選取複製
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Share2 size={16} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold">分享追蹤清單</span>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="cursor-pointer ml-auto text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-[var(--text-muted)]">
            對方點開這個連結後，會把你目前整份追蹤清單匯入到他自己的瀏覽器。
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs outline-none"
            />
            <button
              onClick={copy}
              className="cursor-pointer flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "已複製" : "複製"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClearConfirmModal({
  total,
  onCancel,
  onConfirm,
}: {
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeToClose(onCancel);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="text-sm font-semibold">清除全部追蹤記錄？</div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            會清掉追蹤清單裡的 <b className="text-[var(--text)]">{total}</b>{" "}
            筆擊殺記錄。重生時間設定和釘選不會動。
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            全部清除
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportConfirmModal({
  total,
  overwrite,
  onCancel,
  onConfirm,
}: {
  total: number;
  overwrite: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeToClose(onCancel);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="text-sm font-semibold">匯入分享的追蹤清單？</div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            這個連結會匯入 <b className="text-[var(--text)]">{total}</b> 筆 BOSS
            記錄
            {overwrite > 0 && (
              <>
                ，其中 <b className="text-[var(--text)]">{overwrite}</b>{" "}
                筆會覆蓋你現有的記錄
              </>
            )}
            ，確定嗎？
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            確定匯入
          </button>
        </div>
      </div>
    </div>
  );
}
