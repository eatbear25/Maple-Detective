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

## 資料管線（2026-08-16 更新：加入怪物數值 + 未來視）

`/monsters` 吃真資料。**遊戲版本更新後的手動更新流程**（不用重跑 Il2CppDumper 那套，腳本都用 container path 掃描定位、不依賴 bundle 檔名，直接依序重跑即可，全部可重複執行）：

1. `python tools/extract-monster-book.py` → `reference-data/monster-book.json`（從客戶端抽掉落+地圖）
2. `python tools/extract-mob-stats.py` → `reference-data/mob-stats.json`（從客戶端 `Mob/` 包抽全部 1232 隻的 level/maxHP/exp/攻防/命中/迴避等數值）
3. （名稱表 `reference-data/name-tables/` 若遊戲有新增內容也要重抽——目前還沒有獨立腳本，是當初手動從 `json_a2909ccd...` 包抽的，見「已經拿到的東西」）
4. `python tools/fetch-missing-names.py` → `reference-data/name-supplement.json`（maplestory.io 補未實裝 mob/item 中文名；**未來視分頁的名稱靠這份**，缺了會顯示 `#id`）
5. `python tools/fetch-map-names.py` → `reference-data/map-supplement.json`（maplestory.io 補客戶端 Map.json 沒有的地圖名；**未實裝判斷與未來視地圖名靠這份**；已查過的會跳過）
6. `python tools/extract-worldmap.py` → `reference-data/worldmap.json` + `public/worldmap/*.png`（從客戶端抽 16 張世界地圖底圖與各地圖在圖上的點位座標；`Etc/WorldMap.json` 是純 JSON TextAsset，底圖藏在 spriteset 包的 `BaseImg.asset`，混淆 MonoBehaviour 的解法見腳本 docstring）
7. `python tools/build-site-data.py` → `src/data/generated/monster-drops.json` + `item-info.json` + `worldmap-nav.json`（join 好的網站用資料，含 released 旗標/futureDrops/世界地圖點位 wm/數值/屬性抗性；worldmap-nav 是地圖導覽頁用的全點位+出沒怪反查，規則見腳本 docstring）
8. `python tools/download-icons.py` 補抓新圖示到 `public/icons/{item,mob,npc}/`（TMS/209 優先、GMS/62 備援；已存在會跳過。清單同時吃 `monster-book.json` 與 `generated/gacha.json`）

### 時裝與特效（`/fashion`，跟上面那串各自獨立）

1. `python tools/extract-cash-items.py` → `reference-data/cash-items.json` ＋ 當期商城快照
   `reference-data/commodity-history/<日期>.json`（**每次跑都要留檔**：商城換檔後下架的時裝
   會從 Commodity.json 完全消失，今天不存之後補不回來）
2. `python tools/extract-effects.py` → `reference-data/effects.json`（點裝特效，`Item/Cash/0501`）
3. `python tools/build-fashion-data.py` → `src/data/generated/fashion-catalog.json`（5099 件時裝 ＋ 45 件特效）

**圖不在我們這邊**：紙娃娃與特效的圖都是執行期打 maplestory.io（TMS/209 優先，見
`src/lib/fashion/msio.ts`）。客戶端的圖鎖在 `.wzspritesheet` 裡出不來。

**特效（2026-08-20 上線）**：客戶端 `Item/Cash/0501.wzjson` 有 46 件，45 件在
maplestory.io 找得到圖（只有「殘像效果」沒有——它本來就不是圖，是 alpha 濾鏡）。
只有客戶端知道的是三件事：有哪些特效、`z`（畫在角色前面還是後面）、`loose`（跟隨隊列
每一隻落後幾 px，沒有它玩具小鴨家族會五隻疊在同一點）。圖的 origin 客戶端與
maplestory.io 逐幀比對完全一致，所以借圖不會跑位。錨點就是角色原點 (0,0)，跟 body
同一套算式；特效動畫與角色動作**各跑各的計時器**（遊戲裡也是這樣）。

順帶修好 `tools/wzjs.py` 兩個坑（之前沒有人讀到那層所以沒發現）：canvas 節點**有子節點**
（origin/delay 掛在底下，`decode(..., expand_canvas=True)` 才展開）、vector 值池是
**float32** 不是 int32（原本會讀成 1093664768 這種天文數字）。

**拿不到的**：裝備自帶的特效（`Effect/CharacterEff.wzjson` 19 件，如星星王子披風、
各種發光戒指）——maplestory.io 的 item JSON 不含這層、也沒有 effect 端點，只剩客戶端
spritesheet 那條被圖集順序擋死的路。

### 轉蛋機率表（**這條跟其他的不一樣，會過期**）

其他腳本都是從本機客戶端抽、隨時可重跑；**這條打的是線上 API，活動一過期就永遠抓不到**。

```
python tools/fetch-gacha-odds.py "<官方活動網址>"   → reference-data/gacha-history/<eventAdId>.json
python tools/build-gacha-data.py                    → src/data/generated/gacha.json
python tools/download-icons.py                      （已擴充，一併抓轉蛋道具與轉蛋機 sprite）
```

- 活動頁是 Vue SPA，真資料在 `GET https://maplestoryclassic-event.beanfun.com/api/EventAd/GetDetail?EventADID=<id>`。
  該 API **只服務當期還活著的活動**（掃過 18900~19200，只有當期的 5 個有回應）。
- 每期都要**手動**在活動結束前跑一次（拷問時明確否決了自動掃描與排程）。快照含 `raw` 原始回應。
- 19046（2026-08-20~09-10 那期）＝ **101 個獎品、機率總和 99.97%**，7 個機率階層。
- 轉蛋券 `5222222`：20 點/張、180 點/10 張；**樂豆點與新台幣 1:1**。
- 官方機率表只給中文名稱，`Item.json` 有 **31 筆同名撞 ID**。消歧用「同機率組的連號叢集分數」，
  較小 ID 只當平手 tiebreak——單純取較小 ID 會選錯（欄位擴充券正解是 `2832888~2832891` 不是
  `2430768~2430771`；雕像正解是 `2210287/2210288` 不是 `2210000/2210001`）。判定會逐筆印出，
  要覆寫就寫 `reference-data/gacha-id-overrides.json`。
- **圖示 101/101 全有**（2026-08-20 解決）。其中 61 個是台服專屬獎品、maplestory.io 沒有
  它們自己的圖（各版本全 404），改顯示**它實際代表的東西**，對應表在
  `reference-data/gacha-icon-alias.json`：
  - 表情交換券 → `5160xxx` 表情本體。對應靠位置：券 `2832892+k` ↔ 表情 `5160000+k`，
    中間有親親／眨眼／閃閃發亮／吐舌頭四個同名定錨點（第 3、4、8、14 位）確認對位；
    券名與道具名是同一個表情的兩種翻譯（`頭暈目眩交換券` ↔ `嘔吐`）。
  - 特效交換券 → `5010xxx` 特效本體；重配卷軸交換券 → `5050xxx`（客戶端寫「捲軸」不是「卷軸」）。
  - 欄位擴充券／瞬移之石／雕像 → 同名的舊版道具 ID（就是消歧時沒選中的那個孿生 ID）。
  - 變身藥水 → **它變成的那隻怪**（`mob` 圖），因為 `2210283~2210293` 沒有任何可用道具圖，
    而通用藥水瓶九款長一樣、沒有辨識度。
  - `prize.icon` = `{kind:"item"|"mob", id}`，`download-icons.py` 只抓這個欄位指到的圖。
  - 客戶端裡其實有原圖，但卡在 `.wzspritesheet` 的 128-bit 雜湊索引（試過的路都失敗），
    完整調查見 `.scratch/gacha-sim/research-item-icons.md`——**上面的替代方案已經夠用，不必再碰**。

**實裝判斷（2026-08-16 修正）**：怪物在 Mob.json ≠ 實裝——客戶端名稱表涵蓋全部舊 wz 怪。正確判斷是「≥1 張出沒地圖在客戶端 Map.json 有名字」，據此現行版本 70 隻、未來視 273 隻。

**後台檢視器**：`../maple-detective-admin/`（獨立資料夾，**不部署、不進公開 repo**）。雙擊 `start.bat` 可查完整未過濾拆包資料（mobId/itemId/名稱搜尋、完整數值、未過濾掉落、道具反查）。遊戲更新後重跑主專案管線，再跑它的 `refresh-data.py` 即同步。

另有 `reference-data/drop-supplement.json`：**人工補充掉落表**（客戶端圖鑑沒記錄、但實際遊戲確認會掉的，例：超級綠水靈掉黏稠稠鞋子 1072369）。玩家回報新缺漏就往這裡加 `{ mobId: [itemId...] }`，重跑 build-site-data + download-icons。前端入口是 `src/data/drops.ts`（型別 + 查名 helper）。

## 接下來可以做的事

1. ~~等級/HP/EXP 等數值~~：**已完成（2026-08-16）**，`tools/extract-mob-stats.py` 抽出全部 1232 隻的 info 數值，網站已顯示。注意 5 隻未實裝活動怪不在 `Mob/` 包裡（沒數值，等級 fallback 用圖鑑描述 regex）。
2. **地圖名稱不全**：`Map.json` 名稱表只涵蓋掉落資料用到的 596 張地圖裡的 204 張（缺的靠 map-supplement 補名）。世界地圖資料已自己抽出來了（`tools/extract-worldmap.py`），位置問題已解。
3. **同類參考站**：「楓憶 MapleMemory」 <https://morrisrrrrrrr-svg.github.io/>（repo 公開）。資料來源跟我們一樣是客戶端的 `MonsterBook.wzjson`（他的 data.js 開頭有寫），掉落筆數 9946 vs 我們 9859，差額是他另外加的任務掉落/補充列。可拿來對數，但別直接抄他整理好的檔案。
4. 機率仍然拿不到（不在客戶端，伺服器端才有）。真要有機率就是走玩家回報/共筆，20 年來的楓谷 wiki 都是這樣做的。

---

## 網站專案現況

- Next.js 16（App Router）+ TypeScript + Tailwind v4，位置就是這個資料夾。
- **2026-08-16 移除分風格結構**：原本有 `/minimal`（現代簡約風，正式站）、`/retro`（復古像素風畫廊）、`/dark`（深色電競儀表板畫廊）三條並存路徑，`/` 只是 redirect 到 `/minimal`。風格畫廊已確定不留，整個 `minimal/*` 直接搬到 `src/app/` 根目錄，`retro`、`dark` 連同只有它們在用的假資料 `src/data/monsters.ts`、`src/data/outfits.ts` 一併刪除。原本 `MinimalLayout`（`src/app/minimal/layout.tsx`）拆成 `src/app/layout.tsx`（html/body/字型/metadata）＋ `src/app/site-shell.tsx`（header/nav/footer 這層 client shell，被根 layout 包住 children）。`src/nav.ts` 的 `themeHref(theme, path)` 也簡化成 `navHref(path)`（不用再帶 theme 參數）。現在網站沒有風格切換的概念，頁面路徑就是 `/monsters`、`/map`、`/boss-timer`、`/fashion`、`/party`，不再有 `/minimal` 前綴。
- `src/nav.ts`：toolbox 選單設定，`裝備模擬器`／`楓幣計算機` 目前是 `enabled: false` 佔位，之後開新工具就是加一筆 + 建對應 `page.tsx`。
- `/map` **地圖導覽**（2026-08-16 上線）：拆包的遊戲世界地圖瀏覽器。上方 chips 切大陸（總圖/楓之島/維多利亞島/…，順序＝總圖 links），大陸圖再有「內部區域」子圖（奇幻村/鯨魚號/廢礦/鐘塔最下層）。地圖上畫**全部**點位（遊戲風黃點，資料 `src/data/worldmap.ts` → `generated/worldmap-nav.json`），點了右欄列出該點的地圖清單＋出沒怪物（依等級排序，點怪物 → `/monsters?q=怪名` 跳掉落查詢）；隱藏地圖/迷你地城掛在借用點的「這附近的隱藏地圖」區。點位共用元件 `src/app/worldmap-view.tsx`（黃點＝一般、橘紅大點＋脈動＝選中、虛線邊＝約略位置），怪物頁的世界地圖彈窗也用它。
- `/gacha` **轉蛋模擬**（2026-08-20 上線）：官方轉蛋活動的模擬器。上半部是遊戲風的轉蛋機視窗（CSS 仿製遊戲 UI：銀灰視窗框＋放射光背景＋`public/icons/npc/9110011.png` 那台機器，**沒有挖客戶端 UI 圖集**），三顆鈕＝單抽／十連／自動；下半部是站內簡約風的分析區。刻意的視覺斷層：上面是爽度、下面是真相。版面由上到下＝遊戲視窗 → 目標設定 → 統計面板 → 官方機率表。內建目標「神秘任務」＝ 6 種怪物橡皮擦 ＋（六角水晶項鍊 OR 水女神的衣料），目標模型是 `AND of OR-groups`（`src/data/gacha.ts`），但 UI 只暴露「勾選＋數量」不讓使用者組 OR。連抽是**直接設次數**（預設 100，快捷 10/100/500，旁邊顯示約略花費；原本設計的「預算上限＋抽到達成為止」在 2026-08-20 實測後因為太複雜而廢除），另有 10,000 抽的 session 上限；引擎一次算完再由 UI 快轉播放 3.5 秒。官方機率表與獲得進度連動（抽到的打勾／×N）。**純 session，重整歸零**，不寫 localStorage——數字是假的，跨 session 累積花費是假成就。
  - **明確不做機率計算**（2026-08-20 定案，不是待辦）：沒有期望值、達成抽數分佈、運氣百分位。理由是使用者不想背書可能算錯的數字。未來要加回來的話，驗證方法是容斥閉式 `P(n)=Σ(-1)^|S|(1-Σp)ⁿ` 對照 10 萬次蒙地卡羅，小數點後三位一致即證明兩邊都對。參考量級（**不要放進網站**）：集齊神秘任務蒙地卡羅 300 次實測平均 692 抽、中位數 617、最多 2527，約 NT$12,449。
  - 規格與 issue 在 `.scratch/gacha-sim/`。
- `/fashion` **時裝搭配**：紙娃娃試衣間。右欄分頁預設停在**髮型**，最後一個分頁是**特效**（45 件，同時只能開一個，再點一次關掉）。特效不佔部位、沒有性別限制，所以跟 `equips` 分開放在 `CharacterLook.effect`。渲染見 `src/lib/fashion/renderer.ts`：特效不參與遮蔽也不吃錨點傳播，就是畫在角色原點的一組圖，`z` 決定畫在角色前面還是後面（`drawFrame` 的後方那疊→角色→前方那疊）。
- `/monsters` 吃真資料（`src/data/drops.ts` → `generated/monster-drops.json`，見上面資料管線）。搜尋支援怪物名/道具名（反查誰掉某道具）/地圖名；放大鏡旁的漏斗按鈕開進階篩選（屬性弱點多選、等級範圍）。分「現行版本／未來視」分頁：現行 70 隻（有實裝地圖的怪）＋人工補充掉落；未來視 273 隻（未實裝怪與帶未實裝掉落的怪）。**出沒地圖 chip 點了會開世界地圖彈窗**，在拆包出的遊戲世界地圖上標出該地圖位置（同張圖上這隻怪的其他出沒點也會標小點，可點切換）；不在遊戲世界地圖上的隱藏圖/迷你地城借「ID 最接近的鄰居」標約略位置（顯示「約略位置」徽章）。原本的「地區分類」已移除（2026-08-16）——ID 前綴推地區在維多利亞整個對不上（101030xxx 遺跡發掘地其實在勇士之村、100040xxx 其實是魔法森林南部），改用世界地圖標點一勞永逸。詳情面板有怪物數值（HP/攻防/命中/迴避）與屬性抗性（elemAttr：F火 I冰 L雷 S毒 H聖 D暗；1=免疫 2=抗性 3=弱點）。UI 無掉落機率欄位（拿不到真值）。

---

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
