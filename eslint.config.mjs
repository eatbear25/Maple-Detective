import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 這兩個預設會從本站發一大堆請求、吃 Vercel Hobby 的 CDN Request 配額，
  // 理由寫在 src/app/hover-prefetch-link.tsx 與 src/app/layout.tsx 的註解
  {
    ignores: ["src/app/hover-prefetch-link.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                '改用 import { HoverPrefetchLink as Link } from "@/app/hover-prefetch-link"（預設的 prefetch 會吃 Vercel 配額）',
            },
            {
              name: "next/font/google",
              message: "字型改從 Google Fonts 的 <link> 載（見 src/app/layout.tsx），next/font 會從本站發字型檔吃 Vercel 配額",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
