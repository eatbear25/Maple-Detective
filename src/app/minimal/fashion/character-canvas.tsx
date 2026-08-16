"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  prepareCharacterFrames,
  drawFrame,
  type PreparedAnimation,
} from "@/lib/fashion/renderer";
import type { CharacterLook } from "@/lib/fashion/config";

export interface CharacterCanvasHandle {
  /** 匯出目前畫面（PNG Blob），給下載按鈕用 */
  toBlob: () => Promise<Blob | null>;
}

interface Props {
  look: CharacterLook;
  action: string;
  expression: string;
  animated: boolean;
  flipX: boolean;
  /** 顯示倍率（維持像素風，用 CSS 放大而不是重繪） */
  scale?: number;
  onStatusChange?: (status: "loading" | "ready" | "error", error?: unknown) => void;
  /** 這次合成時素材庫查不到、沒畫上去的裝備 id */
  onMissing?: (ids: number[]) => void;
}

const CharacterCanvas = forwardRef<CharacterCanvasHandle, Props>(
  function CharacterCanvas(
    { look, action, expression, animated, flipX, scale = 2, onStatusChange, onMissing },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [prepared, setPrepared] = useState<PreparedAnimation | null>(null);
    const frameIndexRef = useRef(0);

    useImperativeHandle(ref, () => ({
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) return resolve(null);
          canvas.toBlob(resolve, "image/png");
        }),
    }));

    // 造型／動作／表情變更 → 重新合成
    useEffect(() => {
      let cancelled = false;
      onStatusChange?.("loading");

      prepareCharacterFrames({ look, action, expression })
        .then((result) => {
          if (cancelled) return;
          frameIndexRef.current = 0;
          setPrepared(result);
          onMissing?.(result.missing);
          onStatusChange?.("ready");
        })
        .catch((err) => {
          if (cancelled) return;
          setPrepared(null);
          onStatusChange?.("error", err);
        });

      return () => {
        cancelled = true;
      };
      // onStatusChange / onMissing 由父層以 useCallback 固定
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [look, action, expression]);

    // 繪製與動畫迴圈
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !prepared) return;

      canvas.width = prepared.width;
      canvas.height = prepared.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let timer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;

      const render = () => {
        if (stopped) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFrame(ctx, prepared, frameIndexRef.current, flipX);

        if (animated && prepared.frames.length > 1) {
          const delay = prepared.frames[frameIndexRef.current % prepared.frames.length].delay;
          timer = setTimeout(() => {
            frameIndexRef.current = (frameIndexRef.current + 1) % prepared.frames.length;
            render();
          }, delay);
        }
      };
      if (!animated) frameIndexRef.current = 0;
      render();

      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
      };
    }, [prepared, animated, flipX]);

    if (!prepared) {
      // 佔位讓舞台維持高度，載入／錯誤畫面由父層蓋在上面
      return <div style={{ width: 96, height: 96 }} />;
    }

    return (
      <canvas
        ref={canvasRef}
        style={{
          width: prepared.width * scale,
          height: prepared.height * scale,
          imageRendering: "pixelated",
        }}
        aria-label="角色預覽"
      />
    );
  },
);

export default CharacterCanvas;
