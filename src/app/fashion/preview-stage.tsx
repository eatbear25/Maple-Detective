"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
/** 按一下放大鏡的倍率 */
const BUTTON_STEP = 1.5;
/** 滾輪靈敏度：滑鼠滾一格（deltaY 100）約 1.3 倍 */
const WHEEL_SPEED = 0.0026;
/** 放大模式的舞台大很多，角色的基準大小跟著翻倍才不會縮在中間一小隻 */
const EXPANDED_SCALE = 2;

/** 舞台的視角：x/y 是角色離舞台中心的位移（px），zoom 是倍率 */
interface View {
  x: number;
  y: number;
  zoom: number;
}

const HOME: View = { x: 0, y: 0, zoom: 1 };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * 位移夾在舞台範圍內，免得把角色整隻拖出框外找不回來。
 * 放大時範圍等比放寬——不然放到 4 倍就拉不到腳。
 */
function clampView(view: View, stage: HTMLElement): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  const reach = Math.max(1, zoom);
  const maxX = (stage.clientWidth / 2) * reach;
  const maxY = (stage.clientHeight / 2) * reach;
  return {
    zoom,
    x: clamp(view.x, -maxX, maxX),
    y: clamp(view.y, -maxY, maxY),
  };
}

/** 以 (cx, cy)（相對舞台中心）為中心縮放 factor 倍：那一點縮放前後留在原地 */
function zoomAt(
  view: View,
  stage: HTMLElement,
  cx: number,
  cy: number,
  factor: number,
): View {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const k = zoom / view.zoom;
  return clampView(
    { zoom, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k },
    stage,
  );
}

interface Props {
  /** 舞台底色（任何 CSS background 值） */
  background: string;
  /** 放大模式：舞台變大（版面由父層一起調整，這裡只管舞台自己的高度與角色基準大小） */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** 會跟著縮放與拖曳的內容（角色） */
  children: ReactNode;
  /** 固定蓋在舞台上、不跟著動的東西（載入中、錯誤訊息） */
  overlay?: ReactNode;
}

const TOOL_BUTTON =
  "flex h-7 w-7 cursor-pointer items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]";

/**
 * 試衣間的角色舞台：滾輪或右下角的放大鏡縮放（滾輪以游標所在位置為中心）、按住拖曳移動。
 * 只動 CSS transform，不重畫 canvas，所以不影響「下載 PNG」的輸出。
 */
export default function PreviewStage({
  background,
  expanded,
  onToggleExpanded,
  children,
  overlay,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);

  // React 的 onWheel 是 passive 的，preventDefault 擋不住頁面捲動，所以自己掛
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      // Firefox 的滑鼠滾輪是以「行」為單位回報
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      setView((v) => zoomAt(v, stage, cx, cy, Math.exp(-delta * WHEEL_SPEED)));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  /** 放大鏡按鈕：沒有游標位置可以參考，就以舞台中心縮放 */
  const zoomBy = (factor: number) => {
    const stage = stageRef.current;
    if (stage) setView((v) => zoomAt(v, stage, 0, 0, factor));
  };

  const moved = view.x !== 0 || view.y !== 0 || view.zoom !== 1;
  const scale = view.zoom * (expanded ? EXPANDED_SCALE : 1);

  return (
    <div
      ref={stageRef}
      onPointerDown={(e) => {
        // 觸控留給頁面捲動：手機版舞台就在頁面最上面，攔下來整頁會滑不動
        if (e.pointerType === "touch" || e.button !== 0) return;
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          x: view.x,
          y: view.y,
        };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const stage = e.currentTarget;
        const x = d.x + e.clientX - d.startX;
        const y = d.y + e.clientY - d.startY;
        setView((v) => clampView({ zoom: v.zoom, x, y }, stage));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`relative flex select-none items-center justify-center overflow-hidden rounded-lg ${
        // 放大模式的高度跟著視窗走：左欄是 sticky 的，比視窗還高的話底下的控制項會捲不到
        expanded ? "min-h-[min(480px,55vh)]" : "min-h-[220px]"
      } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ background }}
    >
      <div
        className="flex w-full items-center justify-center"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`,
        }}
      >
        {children}
      </div>
      {overlay}
      {/* 底色可以換成任何顏色，所以這排按鈕自己帶底，不靠舞台的顏色撐對比 */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
        {moved && (
          <button
            onClick={() => setView(HOME)}
            className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <RotateCcw size={11} />
            重設
          </button>
        )}
        <div className="flex items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={() => zoomBy(1 / BUTTON_STEP)}
            disabled={view.zoom <= MIN_ZOOM}
            title="縮小（也可以用滑鼠滾輪）"
            aria-label="縮小"
            className={TOOL_BUTTON}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => zoomBy(BUTTON_STEP)}
            disabled={view.zoom >= MAX_ZOOM}
            title="放大（也可以用滑鼠滾輪）"
            aria-label="放大"
            className={TOOL_BUTTON}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => {
              // 兩種模式的舞台大小差很多，原本的位移搬過去位置會不對，一律回到正中間
              setView(HOME);
              onToggleExpanded();
            }}
            title={expanded ? "縮回原本大小" : "放大試衣間"}
            aria-label={expanded ? "縮回原本大小" : "放大試衣間"}
            aria-pressed={expanded}
            className={`${TOOL_BUTTON} border-l border-[var(--border)]`}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
