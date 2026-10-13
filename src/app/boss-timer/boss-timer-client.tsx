"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Plus,
  RotateCcw,
  Share2,
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
  effectiveInterval,
  formatClock,
  formatCountdown,
  respawnRange,
  type Interval,
} from "./logic";

const bossById: Record<string, BossDef> = Object.fromEntries(
  bossList.map((b) => [b.id, b]),
);

/** 「重新擊殺」「移除追蹤」都是一按就蓋掉舊記錄，按完這段時間內可以復原 */
const UNDO_WINDOW_MS = 8000;

interface UndoState {
  /** 被蓋掉／刪掉之前的那筆記錄，復原就是把它寫回去 */
  record: KillRecord;
  action: "rekill" | "remove";
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
    loaded,
    upsertKill,
    removeKill,
    importShared,
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
  const [shareOpen, setShareOpen] = useState(false);

  // 過期不另外開計時器清掉，直接跟每秒跳一次的 now 比
  const [undo, setUndo] = useState<UndoState | null>(null);
  const activeUndo = undo && now < undo.expiresAt ? undo : null;
  const armUndo = (
    record: KillRecord,
    action: UndoState["action"],
    at: number,
  ) => setUndo({ record, action, expiresAt: at + UNDO_WINDOW_MS });

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

  const diff = useMemo(() => {
    if (!pendingImport) return null;
    let overwrite = 0;
    for (const k of pendingImport.kills) {
      if (kills[killKey(k.bossId, k.channel)]) overwrite++;
    }
    return { total: pendingImport.kills.length, overwrite };
  }, [pendingImport, kills]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BOSS 計時器</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          記錄擊殺時間，自動推算下次重生時間。資料存在你的瀏覽器裡，重生時間為玩家回報，僅供參考。
        </p>
      </div>

      <div>
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--accent)" }}
        >
          選擇 BOSS
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {bossList.map((boss) => (
            <BossCard
              key={boss.id}
              boss={boss}
              interval={effectiveInterval(boss.id, intervals, bossById)}
              onAdd={() => setAddingBoss(boss)}
              onClearInterval={
                !boss.defaultRespawnMin && intervals[boss.id]
                  ? () => clearIntervalOverride(boss.id)
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
            <button
              onClick={() => setShareOpen(true)}
              className="cursor-pointer ml-auto flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              <Share2 size={13} />
              分享清單
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            還沒有追蹤中的 BOSS，點上面的 BOSS 卡片新增擊殺記錄。
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
                  armUndo(r.record, "rekill", at);
                  upsertKill(r.record.bossId, r.record.channel, at);
                }}
                onRemove={() => {
                  armUndo(r.record, "remove", Date.now());
                  removeKill(r.record.bossId, r.record.channel);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {addingBoss && (
        <KillFormModal
          boss={addingBoss}
          defaultInterval={effectiveInterval(
            addingBoss.id,
            intervals,
            bossById,
          )}
          onClose={() => setAddingBoss(null)}
          onSubmit={(channel, killedAt, interval) => {
            upsertKill(addingBoss.id, channel, killedAt, interval);
            setAddingBoss(null);
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

      {activeUndo && (
        <UndoToast
          undo={activeUndo}
          now={now}
          onUndo={() => {
            const { bossId, channel, killedAt } = activeUndo.record;
            upsertKill(bossId, channel, killedAt);
            setUndo(null);
          }}
        />
      )}
    </div>
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
  const name = bossById[undo.record.bossId]?.name ?? "BOSS";
  const secondsLeft = Math.max(1, Math.ceil((undo.expiresAt - now) / 1000));
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-4 pr-2 text-sm shadow-xl"
    >
      <span className="min-w-0 truncate">
        {undo.action === "rekill" ? "已重新計時" : "已移除"}・{name}{" "}
        {undo.record.channel} 頻
      </span>
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

function BossCard({
  boss,
  interval,
  onAdd,
  onClearInterval,
}: {
  boss: BossDef;
  interval: Interval | null;
  onAdd: () => void;
  /** 有值代表這隻 BOSS 的重生時間是使用者自訂（沒有官方固定值），可以清掉重設 */
  onClearInterval?: () => void;
}) {
  const intervalLabel = interval
    ? interval.min === interval.max
      ? `${interval.min} 分`
      : `${interval.min}~${interval.max} 分`
    : "重生時間未設定";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <a
        href={`/monsters?id=${boss.id}`}
        target="_blank"
        rel="noopener noreferrer"
        title="在新視窗查看掉落資訊"
        className="flex items-center gap-2.5 hover:opacity-80"
      >
        <GameIcon
          src={mobIconSrc(boss.id)}
          alt={boss.name}
          fallback="👑"
          className="h-10 w-10 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-medium">
            <span className="truncate">{boss.name}</span>
            <ExternalLink
              size={11}
              className="shrink-0 text-[var(--text-muted)]"
            />
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="truncate">{intervalLabel}</span>
            {onClearInterval && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onClearInterval();
                }}
                title="清除重生時間設定"
                aria-label="清除重生時間設定"
                className="cursor-pointer shrink-0 text-[var(--text-muted)] hover:text-red-400"
              >
                <X size={11} />
              </button>
            )}
          </span>
        </span>
      </a>
      <button
        onClick={onAdd}
        className="cursor-pointer mt-2.5 flex w-full items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Plus size={13} />
        擊殺
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

function KillFormModal({
  boss,
  defaultInterval,
  onClose,
  onSubmit,
}: {
  boss: BossDef;
  defaultInterval: Interval | null;
  onClose: () => void;
  onSubmit: (channel: number, killedAt: number, interval: Interval) => void;
}) {
  // 擊殺時間鎖定「現在」不給選，開啟彈窗那一刻就固定下來，跟送出時記錄的值一致
  const [killedAt] = useState(() => Date.now());
  const [channel, setChannel] = useState("");
  const [min, setMin] = useState(String(defaultInterval?.min ?? ""));
  const [max, setMax] = useState(String(defaultInterval?.max ?? ""));

  useEscapeToClose(onClose);

  const channelNum = parseInt(channel, 10);
  const minNum = parseFloat(min);
  const maxNum = parseFloat(max);
  const valid =
    Number.isInteger(channelNum) &&
    channelNum >= 1 &&
    channelNum <= 60 &&
    minNum > 0 &&
    !Number.isNaN(maxNum) &&
    maxNum >= minNum;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <GameIcon
            src={mobIconSrc(boss.id)}
            alt={boss.name}
            fallback="👑"
            className="h-6 w-6 shrink-0"
          />
          <span className="text-sm font-semibold">
            新增擊殺記錄 · {boss.name}
          </span>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="cursor-pointer ml-auto text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">
              擊殺時間
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-muted)]">
              現在・{formatClock(killedAt)}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              頻道（1~60）
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              // placeholder="例如 3"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              重生間隔（分鐘）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="最短"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[var(--text-muted)]">〜</span>
              <input
                type="number"
                min={1}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="最長"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              固定重生時間可以填一樣的數字；這裡的設定會套用到這隻 BOSS
              所有頻道。
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            取消
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              valid &&
              onSubmit(channelNum, killedAt, { min: minNum, max: maxNum })
            }
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            確定
          </button>
        </div>
      </div>
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
