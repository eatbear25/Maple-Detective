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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((r) => (
              <TrackedRow
                key={killKey(r.record.bossId, r.record.channel)}
                {...r}
                now={now}
                onRekillNow={() =>
                  upsertKill(r.record.bossId, r.record.channel, Date.now())
                }
                onRemove={() => removeKill(r.record.bossId, r.record.channel)}
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
        href={`/monsters?q=${encodeURIComponent(boss.name)}`}
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

  let statusLabel: string;
  let countdown: string | null = null;
  if (passed) {
    statusLabel = "應該已重生";
  } else if (inRange) {
    statusLabel = "最快重生時間已過，最晚";
    countdown = formatCountdown(maxTime - now);
  } else {
    statusLabel = "距最快重生時間";
    countdown = formatCountdown(minTime - now);
  }

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        passed
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <GameIcon
          src={mobIconSrc(boss.id)}
          alt={boss.name}
          fallback="👑"
          className="h-9 w-9 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{boss.name}</span>
            <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
              {record.channel} 頻
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            擊殺於 {formatClock(record.killedAt)}
          </div>
        </div>
        <button
          onClick={onRemove}
          title="移除追蹤"
          aria-label="移除追蹤"
          className="cursor-pointer flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
        <div
          className="text-sm font-semibold tabular-nums"
          style={{ color: passed ? "var(--accent)" : undefined }}
        >
          {statusLabel}
          {countdown && <span className="ml-1.5">{countdown}</span>}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {minTime === maxTime
            ? formatClock(minTime)
            : `${formatClock(minTime)}〜${formatClock(maxTime)}`}
        </div>
      </div>

      {passed && (
        <button
          onClick={onRekillNow}
          className="cursor-pointer mt-2.5 flex w-full items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
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
              placeholder="例如 3"
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
