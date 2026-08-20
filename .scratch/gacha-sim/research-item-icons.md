# 研究筆記：台服專屬道具圖示為什麼抓不到（2026-08-20）

Status: wontfix（2026-08-20）——問題已用**替代圖示**繞過，101/101 都有圖了，
不需要再破解 `.wzspritesheet`。下面的調查留著，是給「將來真的要自己出圖」的人看的。

> **繞過的方法**：交換券顯示它換到的本體道具、變身藥水顯示它變成的怪。
> 對應表 `reference-data/gacha-icon-alias.json`，細節見 CLAUDE.md 的轉蛋段落。

## 問題

轉蛋 101 個獎品裡 **61 個在 maplestory.io 抓不到圖示**，全部是台服經典版專屬道具：

| 層 | 缺 | 內容 |
|---|---|---|
| `emote` | 42 | 表情／特效交換券 `2832892~2832933` |
| `morph` | 11 | 變身藥水／雕像 `2210283~2210293` |
| `reset` | 3 | 重配卷軸交換券 `2832885/2832886/2832951` |
| `slot` | 5 | 瞬移之石、四種欄位擴充券 `2832887~2832891` |

**有圖的 40 個涵蓋所有主打獎品**：怪物橡皮擦 8/8、椅子 4/4、黑之包、100% 卷軸 27/27。
所以目前用 fallback（稀有度色塊 + 名稱前兩字）不影響核心體驗。

## 已排除的路

maplestory.io 的 `TMS/209`、`GMS/62`、`KMS/367`、`JMS/414` 對 `2832892` / `2210287`
全部 404；`MSEA/211`、`CMS/114`、`TWMS/209` 回 500（版本代號無效）。
這些道具只存在於台服經典版，公開 API 沒有。

## 客戶端裡的東西（都已定位）

圖**在客戶端裡而且完整可讀**，卡的只是「哪個格子對應哪個道具」。

### 1. 圖集本體（可直接匯出）

```
spritesheet_abb78745197801a59b36735c77783da5.bundle   # 15MB，316 containers
  Assets/WzAssets/SpriteSheet/TW/Item/Consume/0283_0.png    Texture2D 512x256
  Assets/WzAssets/SpriteSheet/TW/Item/Consume/0283.wzspritesheet  MonoBehaviour
```

路徑前 4 碼 = 補零 8 碼道具 ID 的前 4 位（`2832887` → `02832887` → `0283`）。
`_0.png` 用 UnityPy `.read().image` 直接存得出來，肉眼確認就是要的那批表情券／擴充券圖示。

**這個 bundle 裡沒有任何 `Sprite` 物件**（只有 158 個 Texture2D + 158 個 MonoBehaviour），
所以拿不到現成的具名矩形。

### 2. 圖名（已解出）

```
json_4f0192b4db49dca312b7c5d0d6d30555.bundle   # 3MB
  Assets/WzAssets/Json/Item/Consume/0283.wzjson
```

用現成的 `tools/wzjs.py` 就解得開。樹長這樣：

```
0283 → 02832888 → info → icon → $spritesheetitem = "consume_2832888"
                            └→ origin (vector)
                     → iconRaw → $spritesheetitem / origin
```

**順帶更正 `wzjs.py` 的註解**：它寫「h[29]/h[30]/h[31] 在已掃描的檔案中皆為空池」，
但在 Item 包裡**不是空的**——那是一份 910 筆的「節點完整路徑」字串池
（`02831769/info/icon/$spritesheetitem` 這種）。另外 Item 包裡沒有 type 12 canvas 節點，
圖的參照是走 `$spritesheetitem` 字串。

### 3. 卡住的地方：`.wzspritesheet` 的矩形索引

`WZSS` 格式（magic 之後 `u32 版本 = 4`）：

```
[MonoBehaviour 標頭][m_Name "0283"][…欄位…]["Item/Consume/0283"][32 字元雜湊]["WZSS"][u32 版本=4]
[結構區 ~4KB：一堆小浮點數，像是 pivot 偏移，不是 UV 矩形]
[雜湊表 1：122 × 32 字元 hex，已排序]
[雜湊表 2：140 × 32 字元 hex]
```

- **122 = 61 個道具 × (icon + iconRaw)**，數字完全對得上，所以雜湊表就是圖名的索引。
- 雜湊表**已排序**（`044b…` < `05f2…` < `08f9…`），是查表用的。
- 檔案裡**完全沒有**明文的道具 ID、`icon`、`info` 字串——全部走雜湊。

**試過而失敗的**：對 `consume_2832888`、`02832888/info/icon`、
`Item/Consume/0283/02832888/info/icon` 等 5 種字串 × utf-8/utf-16le × md5/sha1/sha256
都算不出表中的值；用檔頭那個已知雜湊 `850c99bce377e7f429dc3e1848e535e9` 反推
（對 11 種路徑寫法 × 2 種編碼 × 3 種演算法）也全部落空。

**也試過而失敗的**：對圖集做連通分量分割再依序對應排序後的道具 ID——
0283 切出 75 段但範圍內只有 61 個 ID（icon/iconRaw 兩張、相鄰圖示會誤併），
0221 切出 33 段對 41 個 ID。純靠順序猜不可靠。

## 要繼續的話怎麼做

唯一可靠的路是**找出那個 128-bit 雜湊函式**，走 CLAUDE.md 附錄記的
Il2CppDumper 流程（`jdziat/Il2CppDumper` 的 `support-metadata-v39` 分支）
反編譯 `Assembly-CSharp.dll`，在 dump 裡找讀 `WZSS` 的程式碼。
類別名被 SHA256 混淆，但常數字串 `"WZSS"` / `"$spritesheetitem"` 沒混淆，可以當入口。

**估計是多小時的獨立工作**，跟轉蛋模擬器沒有必然關係——但一旦打通，
受益的不只轉蛋：所有台服專屬道具、NPC、UI 圖示都能自己出，
不用再依賴 maplestory.io。要做的話應該當成獨立的 effort 開票。
