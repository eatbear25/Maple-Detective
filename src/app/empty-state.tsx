import type { ReactNode } from "react";
import { DetectivePenguin } from "./detective-penguin";

/** 內頁共用的「搜不到」畫面：偵探企鵝（2 倍，像素圖只能整數倍放大）＋一句話 */
export function EmptyState({
  title = "找不到相關結果",
  hint,
}: {
  title?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <DetectivePenguin className="w-[122px]" />
      <p className="text-base font-bold">{title}</p>
      {hint && <p className="text-sm text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
