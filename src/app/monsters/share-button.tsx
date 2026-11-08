"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { copyText } from "@/lib/copy-text";
import { PILL } from "./styles";

/**
 * 複製這隻怪的分享連結。分享的是完整頁面 /monsters/ID 而不是 ?id=：那頁是靜態的
 * （開啟不用等 JS）、內容完整，貼到巴哈／Discord 之後會變成指向站內詳情頁的外部連結。
 * ?id= 仍然可以用，舊連結不會壞。換一隻怪時呼叫端用 key 換掉，「已複製」才不會帶過去。
 */
export function ShareButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        copyText(`${window.location.origin}/monsters/${id}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      title="複製這隻怪物的分享連結"
      className={`cursor-pointer ${PILL} ${
        copied ? "border-[var(--accent)]! bg-[var(--accent-soft)]! text-[var(--text)]!" : ""
      }`}
    >
      {copied ? <Check size={13} /> : <Share2 size={13} />}
      {copied ? "已複製連結" : "分享"}
    </button>
  );
}
