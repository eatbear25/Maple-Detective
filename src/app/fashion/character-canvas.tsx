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
    // 特效的動畫跟角色動作各跑各的（遊戲裡也是），所以另外記一個索引
    const effectIndexRef = useRef(0);

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
          effectIndexRef.current = 0;
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

      let stopped = false;

      const paint = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFrame(ctx, prepared, frameIndexRef.current, flipX, effectIndexRef.current);
      };

      /**
       * 角色與特效各跑一條時間軸：推進自己的索引後重畫整張
       * （兩者疊在同一個 canvas，所以任一條動了都要整張重畫）。
       */
      const runTrack = (frames: { delay: number }[], indexRef: { current: number }) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const step = () => {
          if (stopped) return;
          paint();
          if (!animated || frames.length < 2) return;
          const delay = frames[indexRef.current % frames.length].delay;
          timer = setTimeout(() => {
            indexRef.current = (indexRef.current + 1) % frames.length;
            step();
          }, delay);
        };
        step();
        return () => {
          if (timer) clearTimeout(timer);
        };
      };

      if (!animated) {
        frameIndexRef.current = 0;
        effectIndexRef.current = 0;
      }
      const stops = [runTrack(prepared.frames, frameIndexRef)];
      if (prepared.effectFrames.length > 0) {
        stops.push(runTrack(prepared.effectFrames, effectIndexRef));
      }

      return () => {
        stopped = true;
        for (const stop of stops) stop();
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
          // 大張的特效（翅膀類寬到 183px）放大兩倍會超出預覽欄，
          // maxWidth + height:auto 讓瀏覽器等比縮回來，像素風不受影響
          width: prepared.width * scale,
          height: "auto",
          maxWidth: "100%",
          imageRendering: "pixelated",
        }}
        aria-label="角色預覽"
      />
    );
  },
);

export default CharacterCanvas;
