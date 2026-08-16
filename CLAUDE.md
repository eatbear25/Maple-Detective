@AGENTS.md
1. 一律回答中文
2. 預設用戶為 ADHD 患者，回答時請考量該症狀患者

# 楓谷工具箱（Maple Detective）

給下一個接手這個專案的人（或未來的我）看的筆記。目標：做一個楓之谷經典版（Gamania 代理）的攻略工具箱網站，第一個功能是**怪物掉落查詢**，之後會加時裝搭配、組隊攻略等。

**2026-08-13 更新：掉落資料已經解出來了。**`tools/extract-monster-book.py` 會從客戶端抽出「每隻怪掉哪些道具、出沒在哪些地圖」（純 ID 清單，無機率——機率本來就不在客戶端），輸出到 `reference-data/monster-book.json`（343 隻怪、9859 筆掉落）。詳見下面「掉落資料：已解決」。

---

## 遊戲用戶端技術背景

遊戲安裝路徑：`C:\Program Files\Gamania\maplestory_classic`

這**不是**舊版楓之谷的 `.wz` 格式，是 Gamania 用 **Unity（IL2CPP 編譯）+ Unity Addressables** 重新做的用戶端。資料放在：

```
Maplestory_Classic_Data\StreamingAssets\aa\w\
```

這個資料夾裡一堆 `json_*.bundle`、`spritesheet_*.bundle`、`sound_*.bundle` 等檔案，都是 Unity AssetBundle。

**重要**：這些檔名裡的 hash（例如 `json_a2909ccd82f5e94b75cf905405af04af.bundle`）是 Addressables 內容雜湊，**遊戲每次更新都會變**，下面提到的具體檔名只是某個時間點的快照，之後要重新用 `catalog.bin` / `catalog_json.bin`（同資料夾）或直接掃資料夾比對 TextAsset 名稱來重新定位。

---

## 已經拿到的東西（乾淨、可直接用）

`json_*.bundle` 裡有一包（掃描時是 `json_a2909ccd82f5e94b75cf905405af04af.bundle`，要配合同資料夾的 `monoscripts_*.bundle` 一起載入才能解析）裡面裝了一堆 **TextAsset**，內容是**未混淆的純 JSON**，是 ID → 中文名稱的對照表，包含：

`Mob`、`Item`、`Skill`、`Map`、`Npc`、`QuestData`、`MonsterBook`、`Pet`、`SetItemInfo` 等等。

格式範例（`Mob.json`）：
```json
"100100": { "name": "嫩寶" }
```

這批資料已經抽出來放在本專案 `reference-data/name-tables/` 底下（Mob / Item / Skill / Map / Npc / MonsterBook 共 6 份），可以直接拿來做 ID↔名稱對照，或當作之後接真實資料時的 fallback 顯示名稱。**只有名稱，沒有任何數值/掉落資訊。**

另外還有一包（掃描時是 `json_e66ac8390d02720f97a33bca31723791.bundle`）裝的是音效路徑對照表（ReactorTable / PetTable / ItemTable / WeaponTable / SkillTable / MobTable），跟掉落物無關，只是備註一下這個命名規律不要重複去挖。

---

## 掉落資料：已解決（2026-08-13）

之前以為被混淆擋死，其實**混淆只套在 IL2CPP 的 class/欄位名稱上，AssetBundle 的 container path 和資料內容都沒混淆**。用 UnityPy 列出 `env.container` 就會看到整包舊 wz 轉出來的資料，路徑一目了然：

- `json_c32a59...`（141MB、8044 物件）= `Assets/WzAssets/Json/Character/`（裝備/臉/髮，8 碼補零 ID 就是舊 wz 的 img 檔名）
- `json_573635...`（44MB）= `Map/`、`json_27ed12...`（5MB）= `Mob/`（1232 隻，含數值）、`json_2f1452...`= `Npc/`
- 其他小包：`Skill/`、`Quest/`、`Reactor/`、`String/`、`Effect/`…
- **`MonsterBook.wzjson`（掉落表）在一個只有 0.4MB 的小包裡**（掃描時是 `json_670307ac...`），跟 `MapLogin`、`StandardPDD` 等 5 個檔同包

### WZJS 二進位格式（已逆向，版本 5）

每個 `*.wzjson` 是一個 MonoBehaviour，raw bytes 版面（不需要 typetree，直接 `reader.get_raw_data()`）：

```
[MonoBehaviour 標頭+m_Name][36×u32 目錄表]["WZJS"][u32 版本=5]
[節點表 每筆 32B=8×u32: type, nameIdx, valIdx, firstChild, childCount, parent, 前序, 保留]
[int 值池 u32[]，葉節點用 valIdx 索引][名稱字串池][名稱 offset 表(前綴和)]
```

節點 type：2=目錄、6=int 葉、11=字串葉、3/4/5=罕見型別。樹就是舊 wz 的 img 結構：`MonsterBook → mobId → {episode, map→[mapId], reward→[itemId]}`。細節和防更新的定位技巧（值池位址要用內容驗證挑選，不能全信目錄表）都寫在 `tools/extract-monster-book.py` 裡，遊戲更新後直接重跑即可。

已知缺口（2026-08-14 已查明原因）：343 隻怪有 5 隻不在 `Mob.json` 名稱表、2239 種掉落物有 287 種不在 `Item.json`——這些是**經典版未實裝**的內容（舊 wz 完整掉落表的殘留：287 種道具多為各部位屬性卷軸，5 隻怪是活動/變種怪），遊戲內圖鑑本來就不顯示。`build-site-data.py` 已改用「客戶端名稱表有無該 ID」當實裝判斷直接過濾，讓網站對齊遊戲內圖鑑；未實裝內容的名稱仍可在 `name-supplement.json` 查到。另外 `episode` 欄位已解碼確認**不是章節**：337 隻為空字串，僅 6 隻活動怪（蜈蚣大王、藍色蘑菇王、路邊攤、武公、小雪人、迷路的麋鹿）帶未翻譯的韓文說明；字串值池位址 = header[33]/[34] + 188（WZJS 前的 MonoBehaviour 標頭長度）。

### 附錄：typetree 管線（抽 wzjson 用不到，留著備查）

抽 `*.wzjson` **不需要**下面這套——`reader.get_raw_data()` 拿 raw bytes 直接解 WZJS 就好。但如果之後要讀「不是 wzjson」的其他自訂 MonoBehaviour 欄位，這套流程親測可行：

這些是 IL2CPP 編譯後的自訂類別，Unity 沒有把型別結構（typetree）包進 bundle，一般工具讀不出欄位。打通的流程：

1. 這遊戲的 IL2CPP metadata 版本是 **v39**（對應 Unity 6.x），官方版 [Perfare/Il2CppDumper](https://github.com/Perfare/Il2CppDumper) 最新 release（v6.7.46）讀不動，會報 `Metadata file supplied is not a supported version[39]`。
2. 改用社群 fork：`https://github.com/jdziat/Il2CppDumper`，branch `support-metadata-v39`。用 `dotnet publish -f net8.0 -r win-x64` 自己編。
3. 執行：
   ```
   Il2CppDumper.exe <遊戲根目錄>\GameAssembly.dll <遊戲根目錄>\Maplestory_Classic_Data\il2cpp_data\Metadata\global-metadata.dat <輸出資料夾>
   ```
   輸出會有 `dump.cs`、`script.json`、`il2cpp.h`、`DummyDll\`（裡面是一堆假的 managed dll，包含 `Assembly-CSharp.dll`）。
4. 用 Python：`pip install UnityPy TypeTreeGeneratorAPI`
5. **關鍵技巧**：不要用 `TypeTreeGenerator.load_local_game()`（它內部走 `LibCpp2IL`，目前這個版本一樣不支援 metadata v39，會報 `Fatal Exception initializing LibCpp2IL!`）。改用 `gen.load_local_dll_folder(<Il2CppDumper 輸出的 DummyDll 資料夾>)`，這條路走的是一般 .NET reflection 解析，不受 metadata 版本限制，親測可行。
6. 讀取時要把目標 bundle 跟同資料夾的 `monoscripts_*.bundle` 一起丟給 `UnityPy.load()`（MonoScript 參照在另一個 bundle 裡，不然會報 `FileNotFoundError: cab-... not found`）。
7. `env.typetree_generator = gen` 之後，`obj.read_typetree()` 就能把完整欄位挖出來。

以上步驟親測有效，技術關卡已打通。

### 附錄：混淆長什麼樣（當初卡住的原因）

typetree 讀出來的東西長這樣：

```csharp
public class d141beafd4e361b85e5b2d96f61e7a99920a73fa454cd8c389aecc039a71a9a : ScriptableObject
{
    private int b4c7138a932c9279821b88472e3dab6dc4cf9a9ecdcdc895cf9f9058edd7e27; // 0x18
    private int b0ada9d3080b9a30d059d52de415900d89ad169dc59b1fda3fa22254f022345; // 0x1C
    ...
}
```

**不只欄位名，連 class 名稱、namespace、method 名稱、enum 值全部被換成 SHA256 雜湊**。這是刻意套用在整個 `Assembly-CSharp.dll` 上的識別碼混淆（不是 Unity 預設行為）。當初卡住就是因為只從 typetree 欄位下手；後來發現 container path 沒混淆、資料本體是 WZJS 二進位，繞過去就解了（那個沒被混淆的常數 `"wzjson"` 正是線索）。

---

## 資料管線（已完成，2026-08-13）

`/minimal/monsters` 已改吃真資料。遊戲更新後依序重跑三支腳本即可（都可重複執行）：

1. `python tools/extract-monster-book.py` → `reference-data/monster-book.json`（從客戶端抽掉落+地圖）
2. `python tools/fetch-missing-names.py` → `reference-data/name-supplement.json`（用 maplestory.io 的 TMS 資料補名稱表缺的 mob/item 中文名，目前補了 287 道具 + 5 怪物。**2026-08-14 起網站改為直接隱藏未實裝內容，這步變成純參考用，跳過不影響建置**）
3. `python tools/build-site-data.py` → `src/data/generated/monster-drops.json`（160KB，join 好的網站用資料；會過濾未實裝怪物/道具以對齊遊戲內圖鑑，規則見腳本 docstring）

另有 `python tools/download-icons.py` 抓圖示到 `public/icons/{item,mob}/`（TMS/209 優先、GMS/62 備援，已抓 2582 個；9 隻怪在 maplestory.io 沒圖，UI 用 emoji fallback）。前端入口是 `src/data/drops.ts`（型別 + 查名 helper）。

## 接下來可以做的事

1. **等級/HP/EXP 等數值**：在 `Assets/WzAssets/Json/Mob/*.wzjson`（5MB 那包，1232 檔），同一套 WZJS 格式。把 `tools/extract-monster-book.py` 的 decoder 一般化（處理字串葉、多檔批次）即可。目前等級是從圖鑑描述文字 regex 出來的（335/343 隻有），HP/EXP 沒有。
2. **地圖名稱不全**：`Map.json` 名稱表只涵蓋掉落資料用到的 596 張地圖裡的 204 張。MapleMemory 是用 worldmap 資料做區域推斷，可參考他的做法補。
3. **同類參考站**：「楓憶 MapleMemory」 <https://morrisrrrrrrr-svg.github.io/>（repo 公開）。資料來源跟我們一樣是客戶端的 `MonsterBook.wzjson`（他的 data.js 開頭有寫），掉落筆數 9946 vs 我們 9859，差額是他另外加的任務掉落/補充列。可拿來對數，但別直接抄他整理好的檔案。
4. 機率仍然拿不到（不在客戶端，伺服器端才有）。真要有機率就是走玩家回報/共筆，20 年來的楓谷 wiki 都是這樣做的。

---

## 網站專案現況

- Next.js 16（App Router）+ TypeScript + Tailwind v4，位置就是這個資料夾。
- UI 風格暫定「現代簡約風」（`/minimal` 路徑，根目錄 `/` 會直接 redirect 過去）。另外兩個風格（`/retro` 復古像素風、`/dark` 深色電競儀表板）保留在 `/styles` 畫廊當參考，之後可能砍掉。
- `src/nav.ts`：toolbox 選單設定，`裝備模擬器`／`楓幣計算機`／`地圖導覽` 目前是 `enabled: false` 佔位，之後開新工具就是加一筆 + 建對應 `page.tsx`。
- `/minimal/monsters` 吃真資料（`src/data/drops.ts` → `generated/monster-drops.json`，見上面資料管線）。搜尋支援怪物名/道具名（反查誰掉某道具）/地圖名，UI 已無掉落機率欄位（拿不到真值）。掉落內容已對齊遊戲內圖鑑：未實裝道具/活動怪在 build 階段就被過濾，前端不用再管 fallback 名稱。
- `src/data/monsters.ts`、`src/data/outfits.ts`：**仍是假資料**，只剩 `/retro`、`/dark` 風格畫廊在用；砍畫廊時可一併刪 `monsters.ts`。`outfits.ts`（時裝）要接真資料得另外解 `Character/` 那包。

---

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
