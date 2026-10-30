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
3. `python tools/extract-name-tables.py` → `reference-data/name-tables/`（六份 ID→中文名對照表，來源是 `String/TW/<表名>.json`；可指定表名只抽一份，`--check` 只印差異不寫檔）。遊戲出新內容後這步要先跑，後面的 build 才查得到名字。**Map.json／Mob.json 有沒有名字是其他頁面的實裝判斷依據**，重抽這兩份之後 7、9 要跟著重跑。**2026-10-17 跟著客戶端 10/15 大更新（開放天空之城＋冰原雪域、3 轉）六份全部重抽**（Map +202、Item +1670、Npc +78），怪物（1–7）、任務（8、9、9b）與技能（10–11）管線都已重跑。另：`build-site-data.py` 的道具彈窗吃 `tools/extract-equip-info.py` → `reference-data/equip-info.json`（裝備數值），不在上面編號裡但也要跟著重跑
4. `python tools/fetch-missing-names.py` → `reference-data/name-supplement.json`（maplestory.io 補未實裝 mob/item 中文名；**未來視分頁的名稱靠這份**，缺了會顯示 `#id`）
5. `python tools/fetch-map-names.py` → `reference-data/map-supplement.json`（maplestory.io 補客戶端 Map.json 沒有的地圖名；**未實裝判斷與未來視地圖名靠這份**；已查過的會跳過）
6. `python tools/extract-worldmap.py` → `reference-data/worldmap.json` + `public/worldmap/*.png`（從客戶端抽 16 張世界地圖底圖與各地圖在圖上的點位座標；`Etc/WorldMap.json` 是純 JSON TextAsset，底圖藏在 spriteset 包的 `BaseImg.asset`，混淆 MonoBehaviour 的解法見腳本 docstring）。**2026-10-17 這支壞了**：10/15 的客戶端裡 `BaseImg.asset` 整個消失（掃過全部 bundle，新出現的是 `Map/WorldMap/WorldMap*.wzjson`，像素多半搬進 spritesheet 圖集），但 16 張圖的點位資料逐筆比對**完全沒變**，所以沿用 repo 裡的舊底圖與 `worldmap.json`，這步先跳過。哪天世界地圖真的改了才需要修
7. `python tools/build-site-data.py` → `src/data/generated/monster-drops.json` + `item-info.json` + `worldmap-nav.json`（join 好的網站用資料，含 released 旗標/futureDrops/世界地圖點位 wm/數值/屬性抗性；worldmap-nav 是地圖導覽頁用的全點位+出沒怪反查，規則見腳本 docstring）
8. `python tools/extract-quest.py` → `reference-data/quest.json`（任務 QuestInfo/Check/Act + 中文名稱表）＋ `npc-map.json`（NPC→出沒地圖，掃全部地圖的 `life` 節點建的；2026-10-17 是 1750 張）
9. `python tools/build-quest-data.py` → `src/data/generated/quests.json`（任務查詢頁用：任務、任務鏈、接取/完成條件、獎勵、任務道具名稱/說明、NPC 所在地圖與世界地圖點位）
   9b. `python tools/check-quest-data.py`（只讀，**每次重跑 9 之後都要跑**）把輸出逐筆對回客戶端原始資料，並列出 Check/Act 每個欄位「有用到／刻意不用」。出現 UNKNOWN 欄位 = 遊戲更新加了東西，要人去看
10. `python tools/extract-skill.py` → `reference-data/skill.json`（技能的等級上限、前置技能、每級數值，645 個；數字欄位全留，模板要用）
11. `python tools/build-skill-data.py` → `src/data/generated/skills.json`（技能查詢與配點模擬用；316 個技能＝1轉29／2轉81／3轉89／4轉117）。**2026-10-15 的客戶端拿掉了 Skill.json 的 LevelDesc（逐級敘述）**，只剩帶 `#mpCon` 佔位符的模板 H，逐級敘述改成這支腳本自己代入（規則與「模板寫錯」修正表 `H_FIX` 都在 docstring，拿舊版 LevelDesc 當答案卷驗過）。執行時會列出解不出來印成「?」的佔位符，目前只有兩個 4 轉究極突刺的 `#z`
12. `python tools/extract-skill-icons.py` 依 `reference-data/skill-icon-map.json` 從圖集切出 `public/icons/skill/<skillId>.png`
13. `python tools/fetch-skill-icons.py` 補還沒有圖的技能（3/4 轉靠這支），從參考站 `data.js` 依「職業＋技能名」抓圖，同時把來源寫回 `skill-icon-map.json`
14. `python tools/download-icons.py` 補抓新圖示到 `public/icons/{item,mob,npc}/`（TMS/209 優先、GMS/62 備援；已存在會跳過。道具清單 = 怪物掉落 + 人工補充 + **任務需求/獎勵** + **神秘商人商品** + 腳本裡的 `EXTRA_ITEMS`（掉落表以外、頁面自己要用的圖，例：月妙的六色種子），NPC 清單 = 任務 NPC（`.gif`）+ 神秘商人麥吉（`.png`），所以要排在 build-quest-data 與 build-merchant-data 之後）

`tools/worldmap_spots.py` 是 build-site-data 與 build-quest-data 共用的「地圖→世界地圖點位」規則（精準點位、否則借 ID 最接近的鄰居標約略位置），只該有一份。

**職業中文名寫死在 `tools/jobs.py` 的 `JOBS`**（客戶端 String 表沒有職業名），技能頁與任務頁的職業限制吃同一份，只該有一份。發現跟遊戲內不符就改那裡，再重跑 `build-skill-data.py` 與 `build-quest-data.py`，已修正：110 = **狂戰士**（原本誤植「戰士」，2026-08-22）；2026-09-07 依官方轉職表修海盜與弓箭手線：511 = **格鬥家**（原「拳霸」）、512 = **拳霸**（原「拳王」，遊戲裡沒有拳王）、322 = **神射手**（原「神弓手」）——512 有客戶端佐證（#6330「變強的方法」限 job 512／Lv120，對白寫「你已經是拳霸了」），322 客戶端隻字未提，是照官方轉職表與參考站。法師線的「巫師（火、毒）」寫法維持不變。`jobs.py` 另外收了**職業 bitmask 的解法**：任務獎勵 `Act["1"].item[].job` 是 bitmask 不是職業 id，**bit 編號 % 10 = 職業系列、// 10 = 轉職階段**（19 種 mask 全部吻合）。

**技能圖示：客戶端圖集（`.wzspritesheet`）已完整逆向**（格式細節寫在 `tools/extract-skill-icons.py` 的 docstring，那是唯一一份、別再挖一次）。三個關鍵：**y 座標是從圖的底部量的**（用錯會拿到「別的、但也看得懂的」圖示，所以不會馬上發現）、**sprite 表的第 3 欄不是圖頁編號**（新手包 4 張圖頁但圖示全在最後一張）、**圖集只有座標沒有名字**，而矩形順序是打包器內部順序，跟 wzjson 節點序／前序欄位／字母序全對不上（三種都驗過）——所以「哪張圖是哪個技能」**推不出來**，只能靠外部比對，結果存在 `skill-icon-map.json`（110 個 1/2 轉技能：93 個比對出客戶端的圖、17 個客戶端比對不到就直接存參考站的圖）。同一技能在圖集裡是「一般／灰階／高亮」三件組，**彩度最高的才是一般版本**（50 個已知答案驗過，49:1）。這條路同時證實了 [[client-map-render-blocker]] 說的順序問題確實無解。

**3/4 轉（未來視）的圖示走參考站**（2026-08-22）：`tools/fetch-skill-icons.py` 從同一個參考站的 `data.js` 依「職業＋技能名」抓圖，316 個技能裡 **270 個有圖**。比對要**限定在該職業內**（楓葉祝福、核爆術這種同名技能每條職業線各有一份圖），而且參考站的階段標題不能拿來比職業名（法師線的寫法不同：火毒大魔導 vs 大魔導士（火、毒）），要走腳本裡的 `LINE_TO_JOB4` 對照表。**還缺 46 個**（騎士的屬性攻擊系列 8 個、火毒/冰雷魔導士各 4~5 個、暗殺者 5 個、神槍手/槍神/拳霸等，執行腳本會列出來）——參考站那幾條職業線本來就沒收全，要補只能回頭做客戶端圖集的像素比對（順序推不出來，得人工認圖）。缺圖的技能在 UI 走 `src/app/skill-icon.tsx` 的虛線色塊 fallback，不會出現破圖。**2026-10-17 開 3 轉之後，缺的 46 個裡有 37 個變成現行版本技能**（重跑過腳本，參考站還沒補），補圖的優先度變高了。另注意：那包 Skill 圖集約 175MB，`UnityPy.load()` 有機會直接 MemoryError，重跑圖集比對前先確認記憶體。

**任務資料的十個坑（2026-08-19 逆向完成、2026-08-23 全面複查、2026-10-17 隨客戶端大更新再複查，別重踩）**：
1. `Quest/QuestInfo.wzjson` 的**字串值池只有 12 筆，內容是欄位名本身**（`name`/`parent`/`demandSummary`…）——Gamania 把文字掏空搬去本地化了。所以 QuestInfo 只剩 `area`/`order` 有用，**中文一律從 `String/TW/QuestData.json` 拿**（494 筆，比 QuestInfo 的 485 還全）；連帶 `rewardSummary`/`demandSummary` 在客戶端是空的，做不出「遊戲內任務摘要」這種功能。
2. `QuestData.json` 是 **UTF-8 不是 Big5**（`m_Script.encode('utf-8','surrogateescape').decode('utf-8')`）。
3. **Act 有兩段，獎勵只能讀 `["1"]`**（2026-08-23 修，玩家回報）：`["0"]` 是接任務當下、`["1"]` 是完成當下。`["0"]` 的道具是「NPC 先把任務道具塞給你」（63 個任務有，例：#1034 美味的蘑菇糖果，妮娜先給 10 顆去跑腿，完成時 `["1"]` 再 `-10` 收回、另給 2 顆能吃的），兩段混著讀就會印成「獎勵 10 顆＋2 顆」。這些先給的道具存成 `give`，詳情面板獨立一段「接任務時拿到」（順便解掉「需求道具有一半不用自己找」的困惑）。負數 `money`（＝任務向玩家收費）則**兩段都要看**——#2029 瑪帕的請託是接任務當下先收 1000。
4. **`Check["0"].quest` 的 `state` 決定是前置還是互斥**（2026-08-23 修）：state 2 = 那個任務要已完成、1 = 要正在進行中（都是真前置），**0 或沒寫 = 那個任務「不能接過」＝互斥**。全部當前置的話，五條「XX 之路」轉職任務會互相變成對方的前置（「要先完成盜賊之路才能接戰士之路」），連任務鏈都被串成一條 6 步。現在拆成 `prereq` 與 `exclude`，任務鏈只吃 prereq，UI 在接取條件印「接過這些就不能接」、鏈上的互斥步驟掛「擇一」徽章。
5. **稱號勳章的獎勵不在 `Act`，在 `QuestInfo.viewMedalItem`**（24 個任務，2026-08-23 玩家回報才發現）。少讀這一欄的話，15 個「稱號挑戰／捐獻王／冒險家」會因為 Act 全空被印成「獎勵在伺服器端查不到」，但勳章其實客戶端寫得好好的（另外 9 個 Act 裡也有同一面，要去重）。**教訓：QuestInfo 不是只有 area/order 可用**，`check-quest-data.py` 已經把 QuestInfo 的 23 個欄位也納入涵蓋率檢查。
6. **完成條件不只有道具**：`Check["1"].mob` 有 79 個任務要打怪（`kill`），以前整段沒顯示、還印成「不需要繳交道具」。技能獎勵 `Act["1"].skill` 有 40 個（多半是 4 轉精通書），以前只印一顆「技能」chip 沒有名字；`masterLevel` = 把上限拉到幾級、`skillLevel` = 直接學到幾級，同一個技能常有冒險家/騎士團/龍魔導士三份 id，要用「名字＋職業」去重。
7. **大部分任務的獎勵不在客戶端**：`Act` 只有 **15 個任務**帶 `money`（11 正、4 負），**84 個任務的 `Act` 完全是空的**。原因查明：`Check` 裡有 **66 個任務**帶 `startscript`/`endscript`，代表接受/完成處理交給**伺服器端腳本**，獎勵不走 Act——例如 #2156「可以許願的彩虹鍋牛殼」有 `endscript: q2156e`，實際會給 3 萬楓幣，客戶端一個欄位都沒有。其中 **52 個是「有 script 且 Act 全空」**，獎勵一定查不到（含全部轉職任務）。掃過 `Act` 全部欄位、任務說明文字、`ScriptString` 的 quest0/quest1，客戶端都沒有腳本內容——跟掉落機率一樣只能靠玩家回報。人工補充走 **`reference-data/quest-supplement.json`**（`{ questId: { exp?, money?, cost?, pop?, items? } }`，會覆蓋客戶端資料），網站上吃到補充的任務會標「＊部分獎勵來自玩家回報補充」，查不到獎勵的則直接說明是伺服器端腳本、不會印成「沒有獎勵」。另外**負數 money 是「任務向玩家收費」不是獎勵**（例：#6000 收 100 萬），build 腳本拆成 `money`(得到) 與 `cost`(花費)。
8. **任務的實裝判斷 = 該任務的 NPC 有沒有站在「Map.json 有名字」的地圖上**。實測 490 個任務裡：NPC 全部實裝 296、部分實裝 28、完全沒有 166。定案是 296+28 算現行版本，只有 166 掛未實裝徽章。另外 155 個任務 NPC 只有 97 個查得到地圖，查不到的 14 個正常號段 NPC 是腳本動態生成的劇情 NPC（705 張地圖已確認是全部，不是漏掃）。
9. **2026-10-17 的客戶端把還沒開放的 197 個任務整批拿掉了**（4 轉、菇菇王國、瑪加提亞…），同時加了 277 個（天空之城／冰原雪域、51 步的「冒險家的戒指」、75 個萬聖節活動任務），變成 570 個、實裝分佈 493／4／16。其中 **57 個是遊戲內看不到的系統任務**（「萬聖節台詞顯示用任務」等級 9999、「菇菇通行證參與確認用」、沒有中文名的 #9250 那批），build 時用 `is_hidden()` 濾掉，判斷依據是 QuestInfo 新增的 `disableAtNPC`／`disableAtStartTab`＋`disableAtPerformTab`。**活動任務**的 `Check["0"]` 帶 `start`／`end`（YYYYMMDDHH[MM]），輸出成 `ev`、地區歸「活動」chip；2020 年以前的日期是舊版活動殘留，不算。
10. **任務流程（以前叫任務鏈）是整個連通元件，不能照系列名切**（2026-10-17 玩家回報：#2083 伊卡路斯的滑翔翼前面的「好無聊」、後面的「伊卡路斯與飛天藥水」都被切掉）。系列名在遊戲裡標得很隨便，同一條劇情一半有一半沒有。排序要吃三種邊：前置（state 1/2）、`nextQuest`、**`Check["1"].quest`**（交任務前要先完成——母任務＋子任務，例：謠言的真相要等五個子任務做完才能交，所以接在它後面的「調查木妖」要排在子任務後面）。66 條裡 18 條有分岔，排成「主線＋分岔框」，規則在 `build_flows()` 的 docstring；`check-quest-data.py` 會把流程攤平驗每個前置都排在前面、沒有斷線。「冒險家的戒指」開頭五個「師父的擔憂（各職業）」在客戶端跟後面 51 步**沒有任何關聯欄位**（大概是伺服器腳本串的），沒有硬接。

### 組隊工具的地圖底圖（`/party`，跟上面那串各自獨立）

兩張圖共用 `tools/wzmap_render.py`：照 WZ 的圖層順序自己疊（背景 → 圖層 0–7，每層先物件再地磚 → 前景），像素向 maplestory.io 的 WZ 瀏覽端點借、一張一張拿客戶端的 origin 驗身（`Matched` 會在好幾個版本裡各挑第一個對得上的）。**不要用 maplestory.io 的整張地圖渲染**（`/map/<id>/render`）：它會漏畫物件，中央塔那張連女神像都沒有、迎月花山丘那張只剩地磚。

`python tools/extract-moonbunny-map.py` → `src/data/generated/moon-bunny-map.json` + `public/maps/910010000.webp`（月妙的年糕第一階段「迎月花山丘 910010000」；花收哪色種子讀自 Reactor 9108000-9108005 的 event 道具 id，草掉哪色讀自 Reactor 9102002-9102007 的 action `moonItemN` → 種子 4001095+N，已用實機截圖交叉驗證 14 叢全中。**要連網**，約 20 秒）。**客戶端的 `Map/<id>.wzjson` 有完整的圖層結構**（每塊地磚、每個物件、背景的位置，就是現行版本），缺的只有像素——以前誤以為「只剩玩法資料」，於是拿舊版（TMS/209）的整張渲染再一欄一欄上下平移去湊現行版的下層平台，草皮東一塊西一塊（2026-10-14 玩家回報）；現在結構照客戶端、像素用 TMS/209，只有梯子頂端那一節要回 GMS/83 才對得上 origin。畫進底圖的有草叢與月亮兩種反應器（9102003–9102007 是 info/link 連到 9102002）；背景刻意不畫（遠山森林加一層霧，種子標記會不好認）。

`python tools/extract-goddess-statue.py` → `src/data/generated/goddess-statue.json` + `public/maps/920010100.webp`（女神之塔最後一關「中央塔 920010100」的女神像碎片圖，2026-10-14）。**哪個平台收哪片碎片是客戶端硬資料**：Reactor/2008000–2008005（scar1–6）與 2006001（minerva）的 event 帶道具 id 與判定框，判定框裡剛好各罩住一塊平台（女神像本體最後收生命草 4001055，落在柱頂，畫成綠框泡泡；圖下的說明文字刻意不提生命草，使用者 2026-10-14 說不需要）。**920 那批地圖不在客戶端**，地圖結構與像素借 maplestory.io 的 WZ 瀏覽端點（GMS/83），用到的 66 張圖 origin 先跟客戶端的 Obj/tower、Reactor 比對過才用。**它的整張地圖渲染是壞的**（漏畫 skyStation 物件，女神像整個不見），所以底圖是腳本自己照圖層順序疊的；反應器插在女神像（z=5）與平台（z≥6）之間。不挑 TMS/209 是因為那版女神像柱子底部被切成透明、而且沒有 Map/Back。**要連網**，約 40 秒。

### 時裝與特效（`/fashion`，跟上面那串各自獨立）

1. `python tools/extract-name-tables.py Item`（新點裝的名字；見上面資料管線第 3 步）
2. `python tools/extract-cash-items.py` → `reference-data/cash-items.json` ＋ 當期商城快照
   `reference-data/commodity-history/<日期>.json`（**每次跑都要留檔**：商城換檔後下架的時裝
   會從 Commodity.json 完全消失，今天不存之後補不回來）
3. `python tools/extract-effects.py` → `reference-data/effects.json`（點裝特效，`Item/Cash/0501`）
4. `python tools/fetch-fashion-assets.py`（**要連網**；第一次全抓約一小時，之後只補新的，中斷了
   重跑會接著抓）→ `public/wz-static/fashion/v1/<id>.json`（烤好的圖）＋
   `public/icons/fashion/<id>.png`（縮圖）＋ `reference-data/fashion-coverage.json`
   （每件的來源版本、吻合分數，或「透明」「找不到」）
   4b. `python tools/fetch-item-effects.py`（**要連網**，約一分鐘）→ `public/wz-static/fashion/fx-v1/<id>.json`
   ＋ `reference-data/fashion-fx-coverage.json`（道具特效層，見下面「道具特效層」）
   4c. `python tools/fetch-slot-reference.py`（**要連網**，第一次約四分鐘、之後只補新的）→
   `reference-data/fashion-slot-reference.json`（佔格對照，見下面「佔格資料」）
5. `python tools/build-fashion-data.py` → `src/data/generated/fashion-catalog.json`
   （2026-10-13：7220 件時裝 ＋ 46 件特效。7194 件有圖、17 件透明道具、9 件找不到）
   （2026-10-29 跟著客戶端 10/22–23 更新重跑：8660 件時裝 ＋ 49 件特效。8632 件有圖、
   18 件透明、10 件找不到；新增 1440 件、沒有任何一件下架。掉落表／怪物數值／地圖與怪物
   名稱同時重抽比對過，內容沒變，所以怪物／任務／技能管線沒跟著跑）

**時裝的圖是預先烤好的靜態檔（2026-10-13 改，原本是瀏覽器執行期直接打 maplestory.io）**。
改的理由是量出來的，不是感覺：

- **慢**：那個 API 單次中位數 1.3 秒、4.6% 的請求超過 10 秒、最長卡 60 秒，程式沒設逾時，
  缺件還要依序問 5 個版本——試衣間因此常常停在「合成中」。
- **肥**：每個影格各帶一份 base64，髮型 284KB、最大的武器 26MB。烤的時候把重複的圖去掉、
  併成一張 lossless WebP 圖集，髮型剩 2KB、那把武器 90KB，全部 7194 件共 40MB。
- **會畫錯**：各服的道具 ID 會撞（30570 黑色都會雅痞造型在 GMS/270 是另一顆完全不同的頭），
  執行期備援是「有東西就用」。

現在的做法（細節都在 `tools/fetch-fashion-assets.py` 的 docstring，那是唯一一份）：

- **借圖要驗指紋**。客戶端 wzjson 有每張圖的 origin 與 map，拿這組數字跟 maplestory.io
  回來的比：同一件是 100% 吻合、撞 ID 的是 0%，所以門檻取 0.6 就分得開。
- **版本順序是 TMS/209 → TWMS → 一批舊版本（GMS/83 那個年代）→ 各服最新版**，
  100% 吻合就收工，否則問完全部挑最吻合的。**經典版的圖是大改版以前的畫法**：有些道具連
  TMS/209 都已經是重畫過的新圖（黑色蘑菇頭 30190、唇印 1012009 指紋 0% 吻合），要回到
  GMS/83 才對得上。反過來，**不要為了快把 GMS/KMS 最新版挪到前面**——它們有 CDN 快取
  回得快，但抽 58 件指紋吻合的逐張比，22 件跟 TMS/209 有出入，其中 6 件連像素都改過。
  實際結果：7194 件裡 6450 件來自台服（TMS/209、TWMS/256）、81 件來自舊版本、663 件來自
  各服最新版；指紋 100% 吻合的 7131 件、部分吻合的 28 件、走 WZ 的 35 件。
- **單件端點回 null 不代表沒圖**。它要該版本的 String.wz 有這件的名字才回東西；婚紗、泳裝、
  救生衣、棒球手套這批各版本都沒登記名字（經典版自己補的），但圖好好的在 WZ 裡，
  `/api/wz/<版本>/Character/<資料夾>/<id>.img/<路徑>` 問得到（`walk_wz`）。這條路
  **只跟它要像素，結構與座標全用客戶端的**，因為那個端點穿過連結節點讀兩層以下的值會讀錯
  （`stand1/0/default/map/brow` 回來的是 map 資料夾而不是座標）。
- **只烤頁面選得到的動作與表情**（讀 `src/lib/fashion/config.ts` 的 `ACTIONS`／`EXPRESSIONS`，
  全烤會大三倍）。那邊加動作之後要把工具裡的 `FORMAT` 加 1、`baked.ts` 的 `DIR` 跟著改，
  再 `--rebake`——這批檔案掛一年的 immutable 快取，同網址換內容訪客拿不到新的。
  `build-fashion-data.py` 會比對清單，不一致就擋下來。
- **放 `public/wz-static/fashion/` 不放 `public/fashion/`**：後者跟 `/fashion` 頁面的路由同名，
  `next.config.ts` 那條長快取 header 規則會連頁面一起套到。
- **CDN 沒有就退回本站**（`baked.ts` 的 `SOURCES`、`fashion.ts` 的 `fashionIconSrcs`）：
  jsDelivr 把 `@main` 解析成哪個 commit 會快取 12 小時，新烤的檔案推上去之後 CDN 可能
  半天都還回 404。沒有這層的話，每次補新時裝上線試衣間就會壞到 CDN 更新為止。
- **repo 體積**：這批素材讓 `public/` 多了 47MB（烤好的圖 40MB、縮圖 7MB，共一萬四千多個
  小檔），`public/` 變成 68MB、整個 repo 工作樹約 87MB（2026-10-29 補完 1440 件新時裝後：
  烤好的圖 47MB、縮圖 9MB，`public/` 75MB、工作樹 94MB）。jsDelivr 的上限是整個套件 150MB、
  GitHub 來源單檔 20MB（它的 README 寫的），目前還有餘裕，但再加大包素材前要先算一下。

**WZJS 的連結節點（這次才看懂，`tools/wzjs.py` 的註解原本把 12 跟 18 記反了）**：Character 包裡
一個部件有三種長相——**type 18 是真正的圖**（底下掛 origin／map／z）、**type 12 是連結**
（舊 wz 的 UOL，沒有子節點，valIdx 指到字串值池裡的相對路徑，例 `../../default/default`，
相對於它的上一層）、還有**帶 `$inlink` 的目錄**（自己有 origin／map／z，像素借同一個 img 裡的
另一張，武器大量用）。`decode(..., links=True)` 會把這些都交出來。也就是說**客戶端的結構是
完整的，缺的只有像素**。

**還是拿不到的 10 件**：「瞭望的臉型」8 個顏色（57068~57768，哪個版本的 WZ 都沒有這個 img）
與「鷸巢穴」1002822（各版本同 ID 的帽子是另一種畫法，指紋 0%），2026-10-29 再加「失神眼」
26090（各版本同 ID 的臉指紋只有 4%，是別件；那次 `--retry-missing` 重問過舊的 9 件，結果不變）。要補只剩客戶端
`.wzspritesheet` 那條被 128-bit 雜湊索引擋住的路（見 `.scratch/gacha-sim/research-item-icons.md`）。
另外**髮際陰影（hairShade）沒畫**：單件端點不給這張圖，但 WZ 瀏覽端點問得到
`default/hairShade/<膚色碼>`（0~4、9~11，剛好對上 8 種膚色），想補的話走 `walk_wz` 那條路。

**特效還是執行期打 maplestory.io**（`src/lib/fashion/msio.ts`，現在只剩這個在用它）。特效分頁
目前在 `fashion-client.tsx` 是註解掉的，所以沒有跟著搬；要重新開放的話建議照時裝的做法一起烤。

**特效（2026-08-20 上線）**：客戶端 `Item/Cash/0501.wzjson` 有 46 件，45 件在
maplestory.io 找得到圖（只有「殘像效果」沒有——它本來就不是圖，是 alpha 濾鏡）。
（2026-10-13 重掃多了一件 5010111，變成 47 件、其中 46 件有幀；新的那件在 maplestory.io
有沒有圖還沒查，分頁目前關著所以沒影響。）
只有客戶端知道的是三件事：有哪些特效、`z`（畫在角色前面還是後面）、`loose`（跟隨隊列
每一隻落後幾 px，沒有它玩具小鴨家族會五隻疊在同一點）。圖的 origin 客戶端與
maplestory.io 逐幀比對完全一致，所以借圖不會跑位。錨點就是角色原點 (0,0)，跟 body
同一套算式；特效動畫與角色動作**各跑各的計時器**（遊戲裡也是這樣）。

順帶修好 `tools/wzjs.py` 兩個坑（之前沒有人讀到那層所以沒發現）：canvas 節點**有子節點**
（origin/delay 掛在底下，`decode(..., expand_canvas=True)` 才展開）、vector 值池是
**float32** 不是 int32（原本會讀成 1093664768 這種天文數字）。

**道具特效層（ItemEff，2026-10-29 補上）**：玩家回報「森林護者帽子穿上去看不到」才發現，
有些時裝的外觀不在 Character 包，而在 `Effect/ItemEff.wzjson`（客戶端在小包
`json_6baa5b…`，跟 CharacterEff 同包）。catalog 裡有 59 件在這張表：**33 件本體只是
1×1 空圖、外觀全在特效層**（多半是會動的披風，另有森林／黑夜護者帽子、獨眼死神），
其餘是本體有圖、特效疊在上面的光效；3 件情侶 T 恤是「靠近另一半才出現」的，不畫。
`tools/fetch-item-effects.py` 把它烤到 `public/wz-static/fashion/fx-v1/`（56 件、2.8MB），
catalog 帶 `fx: 1`，試衣間多抓一份來畫。**另放資料夾**是因為本體那批掛一年的 immutable
快取，併進去就得八千多件全部換網址重烤。三個坑：
- **定位規則照 MapleSalon2**（`categorizedItem.resolveEffectFrames`，它註明沿用
  MapleNecrocer）：錨在角色**每一格**的 brow，動作層 `pos` 1 不偏、0 往下 50、沒寫的
  往右 10 往下 50；`z ≥ 2` 畫在整隻角色前面。拿 MapleSalon2 的截圖比過森林護者帽子，一致。
- **maplestory.io 單件 JSON 的 `itemEffects` 不能用**：那是一串沒有動作名的清單、筆數還跟
  客戶端對不上（37 vs 35），靠順序對會把爬繩配到正面那本。改成結構用客戶端、像素向
  WZ 瀏覽端點一張一張要。
- **WZ 端點穿過 `_inlink` 節點讀 origin 會讀到被借那張的**（破舊魔女披風的 proneStab：
  客戶端 63,34、它回 39,-12），抽驗時要跳過這種節點，不然會誤判成撞 ID。

另有 6 件披風（紅色刻印、泡泡小兔、春日之心、很高很高的樹、快樂海豚、球場上觀眾席）
本體也是空圖、但不在 ItemEff，原因還沒查。

**佔格資料（islot／vslot）以 MapleSalon2 為準，不照客戶端**（2026-10-30，玩家回報「穿了某些上衣
褲子就不見」）：islot＝佔哪幾格、vslot＝蓋掉哪幾格，renderer 照它算誰遮住誰，規則跟
MapleSalon2 一字不差（`buildLocks` 照反轉後的 zmap 排、後面的蓋前面的，MapleSalon2 的
`ZmapIndex` 也有 `zmap.reverse()`）。問題出在資料：經典版客戶端把 92 件上衣標成 `MaPn`
（上衣＋褲子），台服新舊版、美服新舊版同一件都是 `Ma`，圖也只畫到腰。**玩家在遊戲商城實測：
褲子還在**，所以遊戲並不照這個欄位遮，定案照 MapleSalon2（其他版本的 WZ）走。
`tools/fetch-slot-reference.py` 向借圖的那個版本問每件裝備的 `info/islot`、`info/vslot`，
build 時不同的就輸出 catalog 的 `sl`，renderer 用它蓋過烤好檔案裡的值（**不改烤好的檔案**：
掛一年 immutable 快取）。2026-10-30 修了 102 件：上衣 MaPn→Ma 85 件（另 7 件其他版本也是 MaPn，
維持）、武器 WpSi→Wp 12 件（雙手→單手，之後能配盾牌）、帽子遮哪幾層頭髮 5 件（邪惡妖精頭套
變成整顆頭都蓋掉，照客戶端的話臉會從頭套穿出來）。**參考版本自己也會錯**：天使玫瑰 1702694
是武器，TWMS/256 寫 MaPn，照抄的話穿上它衣服褲子都不見——build 有防呆，參考值要包含這件本來的
主格才採用。另外 63 件武器在各版本都是 WpSi（雙手武器外觀，例：花束），配盾牌時盾牌被蓋掉是
正常的；夜之玫瑰這種大把的單手武器會把盾牌擋掉大半，看起來像沒畫，其實有。

**飾品拆成臉飾／眼飾／耳環三格**（2026-10-30，玩家回報「眼鏡跟臉飾只能擇一」）：客戶端是同一個
Accessory 資料夾，但遊戲裡三格可以同時戴（臉飾 81／眼飾 79／耳環 12 件）。**照道具編號前三碼拆
（101／102／103），不照 islot**：遊戲決定穿哪一格看編號，透明眼鏡 1022048 的 islot 卻寫 Af
（各版本都是），照 islot 會跑去臉飾。另外「透明臉飾」1012104 的縮圖是一個耳環：那是遊戲本身的
資料（各版本與經典版客戶端都跟透明耳環共用同一張 icon），不是借錯圖。拆在
`build-fashion-data.py` 的 `ACCESSORY_SLOTS`（catalog 的 `s` 變成 faceAccessory／eyeAccessory／
earring，`cash-items.json` 不動），網站上是三個分頁（臉飾／眼飾／耳環，使用者指定；先做過
「一個飾品分頁、卡片標種類」的版本，被換掉），「目前穿著」也分三列。
遊戲加了新的飾品格（islot 不在表裡）build 會直接擋下來。

**拿不到的**：裝備自帶的特效（`Effect/CharacterEff.wzjson` 19 件，如星星王子披風、
各種發光戒指）——maplestory.io 的 item JSON 不含這層、也沒有 effect 端點，只剩客戶端
spritesheet 那條被圖集順序擋死的路。

### 神秘商人機率表（**這條跟其他的不一樣，會過期**）

其他腳本都是從本機客戶端抽、隨時可重跑；**這條打的是線上 API，活動一過期就永遠抓不到**。
2026-10-29 遊戲把轉蛋活動換成「神秘商人」，網站的轉蛋模擬跟著改成神秘商人模擬（`/gacha` 308 轉到 `/merchant`）。

```
python tools/fetch-gacha-odds.py "<官方活動網址>"   → reference-data/gacha-history/<eventAdId>.json
python tools/build-merchant-data.py                 → src/data/generated/merchant.json
python tools/download-icons.py                      （一併抓商品圖示與麥吉 NPC 1022002 的 sprite）
```

- 活動頁是 Vue SPA，真資料在 `GET https://maplestoryclassic-event.beanfun.com/api/EventAd/GetDetail?EventADID=<id>`。
  該 API **只服務當期還活著的活動**（掃過 18900~19200，只有當期的 5 個有回應）。
- 每期都要**手動**在活動結束前跑一次（拷問時明確否決了自動掃描與排程）。快照含 `raw` 原始回應。
  檔名沿用 `fetch-gacha-odds.py`／`gacha-history/`，轉蛋與神秘商人的快照放在一起；`build-merchant-data.py` 只吃標題含「神秘商人」的。
- **玩法**：每批貨架 6 個商品，每 6 小時自動換一批、每天 1 次免費刷新，其他時候用「神秘商人刷新券」5066103 立刻換。
  官方機率是「每一格出現各商品的機率」，模擬時 6 格各自抽（官方沒說同一批會不會避開重複）。
  **商品上架後的售價與免費／打折的機率是伺服器端、官方沒公布**，所以網站花費只算刷新券。
- 20352（2026-10-29 維護後 ~ 11-12 07:59）＝ **261 個商品、機率總和 100.06%**。表格是一列三組，
  官方閱讀順序是**一欄一欄由上往下**（第一欄開頭那串跟遊戲內「本季特別商品」一模一樣）。
  神秘商人是常駐系統，API 的起訖是 1900~2100 佔位值，**真正期間寫在機率說明內文**，fetch 腳本會改讀內文。
- 刷新券：30 點/張、270 點/10 張、2700 點/100 張（商城那三筆的 Count 都是 1、CashPackage 也沒有，張數是從原價 ÷ 單價推的）。**樂豆點與新台幣 1:1**。
- 名稱 → itemId 的三個坑（細節在 `build-merchant-data.py` docstring）：Item.json 名稱有尾巴全形空白；
  「高效能喇叭*20」要拆數量、同一道具會以不同數量出現好幾次（前端一律用表內序號 `key` 識別）；
  21 筆同名撞 ID 先只留點裝、再用全表連號叢集分數挑。覆寫寫 `reference-data/merchant-id-overrides.json`。
- **圖示 261/261 全有**：時裝優先用時裝搭配頁烤好的縮圖（`public/icons/fashion/`，196 件裡 25 件 maplestory.io 沒有，
  例：森林／黑夜護者整套），其他走 `public/icons/item/`。所以時裝管線要排在 build-merchant-data 前面。
- **舊的轉蛋模擬**（19046，2026-08-20~09-10）已整套移除，要復活就從 git 撈 `tools/build-gacha-data.py`、
  `reference-data/gacha-icon-alias.json`、`src/app/gacha/`（最後一版在 commit `cf19414d`）。當時的重點：
  101 個獎品、轉蛋券 `5222222` 20 點/張；Item.json 31 筆同名撞 ID 用「同機率組的連號叢集分數」消歧；
  61 個台服專屬獎品 maplestory.io 沒圖，改顯示它代表的東西（表情券 → `5160xxx` 表情、變身藥水 → 變成的怪）。
  客戶端原圖卡在 `.wzspritesheet` 的 128-bit 雜湊索引，見 `.scratch/gacha-sim/research-item-icons.md`。
**實裝判斷（2026-08-16 修正）**：怪物在 Mob.json ≠ 實裝——客戶端名稱表涵蓋全部舊 wz 怪。正確判斷是「≥1 張出沒地圖在客戶端 Map.json 有名字」，據此現行版本 70 隻、未來視 273 隻；2026-10-17 客戶端開了天空之城與冰原雪域後變成 **112 / 231**（新增的 42 隻全是這兩區的怪，沒有任何一隻被降回未來視）。

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
- **全站公告列**（2026-10-17）：併在 header 裡當第二列（同底色、細線隔開、左邊琥珀色「公告」標籤；原本放 header 上面加一條米色底，使用者嫌醜），內容來自 Google 試算表「楓探公告」（A 日期／B 內容／C 連結／D 顯示核取方塊，格式寫在 `src/lib/announcements.ts`），站長改試算表就好、不用部署。資料走 `/api/announcements`（ISR 5 分鐘）再由瀏覽器抓——**刻意不在 layout 直接 fetch**，那樣全站兩千多個 `/items/[id]`、`/monsters/[id]` 靜態頁都會變成每 5 分鐘重新產生。試算表沒開「知道連結的任何人可檢視」就讀不到，公告列整條不出現。**多則一次只顯示一則、每 5 秒輪播**（並排兩則被嫌醜）；單則塞不下時輪到它才慢慢往左捲完再換；滑鼠移上去會停；多則時右邊有 ‹ › 兩個小箭頭切上下則。使用者打槍過的：箭頭中間的 `1/2` 頁碼（擋路）、捲動時左右的淡出遮罩（手機上字糊掉）。按 × 是**收起**不是關掉：header 右上角會出現大聲公按鈕可以再打開，收起狀態綁定這一批公告，內容一改會自動再打開。
- `src/nav.ts`：選單設定。**2026-08-22 改成兩層、2026-08-23 再開頂層單項並依 GA 重排**：頂層清單是 `navTree`，每個元素可以是**下拉群組**（`NavGroup`，有 `items`）或**直接連過去的單項**（`NavItem`），用 `isNavGroup()` 分辨。目前排法＝**怪物掉落**、**BOSS 計時器**、「查詢」（地圖／技能／任務）、「模擬器」（神秘商人模擬／時裝搭配／技能配點模擬）。**頂層位置的分配標準是「觸及率 ÷ 停留時間」，不是「哪個功能最得意」**——點擊成本會乘上造訪次數，但會被停留時間稀釋：一頁進去待 100 秒，多點一下沒感覺；進去待 22 秒，多點一下就佔了 10% 的體感時間。依 2026-08-23 的 GA（141 位活躍使用者）：monsters 76.6%／58 秒、boss-timer 35.5%／22 秒、fashion 20.6%／98 秒、map 19.2%／56 秒，所以高頻的怪物掉落與「開啟→掃一眼→關掉」的 BOSS 計時器放頂層直達；時裝搭配原本放頂層的理由（主打功能）被數據推翻——只有 20% 的人碰、但碰的人待 98 秒，是深度玩具不是入口，收進下拉的代價接近 0。「模擬器」群組取代舊的「工具」：舊分組把 BOSS 計時器（查一下就走）跟技能配點（待很久）綁在一起，性質相反；現在三個成員都是「進去待很久、一次玩完」的深度工具，之後的裝備模擬器、楓幣計算機也放這裡。**quests／skills／skill-build／gacha（現在是 merchant）在那份 GA 之後才上線、還沒有數據**，目前是依性質歸類，要回頭用 GA 再確認一次。桌機版群組**滑鼠移上去就展開**下拉（2026-08-23 從 click 改成 hover），點擊仍然可以切換——鍵盤與觸控裝置只有這條路；兩個實作細節別拆掉：(1) `mouseleave` 是**延遲 120ms 才關**，因為下拉是 `absolute + mt-1`、畫在 `.relative` 容器的框外，游標穿過那 4px 空隙時會先觸發 `mouseleave`，沒有緩衝選單會在半路關掉；(2) hover 處理器用 `matchMedia("(hover: hover)")` 擋掉觸控裝置，否則觸控點一下會先觸發 `mouseenter` 展開、再被 click toggle 關掉，變成點不開。滑到頂層單項上會把展開中的下拉收掉（`NavEntry` 的 `onMouseEnter`）。手機版側邊選單直接分組攤平（少一層點擊），頂層單項在手機版沒有分組小標。`navItems` 是攤平後的清單（含頂層單項），給不分組的地方用。**桌機主列四個頂層項目都有圖示**（2026-08-23 改）：原本頂層單項用 `showIcon={false}` 關掉，理由是同一排的群組沒圖示、只有單項有會看起來歪掉；現在改成**連群組也配圖示**（查詢＝`BookOpen`、模擬器＝`Gamepad2`），整排就齊了，`showIcon` 這個 prop 已移除。手機版側邊選單的群組小標仍然是純文字（底下的項目已經有圖示了，小標再放一個會跟項目的圖示對不齊）。**注意 nav 的圖示不是讀這裡的 emoji**，是 `site-shell.tsx` 的 `NAV_ICONS` 這份 lucide 元件對照表；那份表的鍵**同時吃 `NavItem.key` 與 `NavGroup.key`**，新增工具或新增群組兩邊都要加。nav 的 label 跟頁面 h1 要一致（`fashion` 曾經 nav 寫「試衣間」、頁面寫「時裝搭配」，已統一成後者）。
- `/map` **地圖導覽**（2026-08-16 上線）：拆包的遊戲世界地圖瀏覽器。上方 chips 切大陸（總圖/楓之島/維多利亞島/…，順序＝總圖 links），大陸圖再有「內部區域」子圖（奇幻村/鯨魚號/廢礦/鐘塔最下層）。地圖上畫**全部**點位（遊戲風黃點，資料 `src/data/worldmap.ts` → `generated/worldmap-nav.json`），點了右欄列出該點的地圖清單＋出沒怪物（依等級排序，點怪物 → `/monsters?q=怪名` 跳掉落查詢）；隱藏地圖/迷你地城掛在借用點的「這附近的隱藏地圖」區。點位共用元件 `src/app/worldmap-view.tsx`（黃點＝一般、橘紅大點＋脈動＝選中、虛線邊＝約略位置），怪物頁的世界地圖彈窗也用它。
- `/quests` **任務查詢**（2026-08-19 上線）：吃真資料（`src/data/quests.ts` → `generated/quests.json`）。513 個任務（2026-10-17；客戶端 570 個扣掉 57 個系統任務），依需求等級排序、每頁 50 筆分頁（分頁列中央標該頁的等級區間，因為按等級排序＋分頁的話翻頁只能用猜的）。**搜尋只吃任務名與獎勵道具名**——不搜 NPC 名、不搜需求道具（定案：需求道具點進詳情看就好）。列表卡片是「左等級圓徽＋任務名＋NPC 名」三項，刻意不放獎勵。詳情面板由上到下是：標題（含等級區間／可重複／活動期間）→**任務流程卡片**→ NPC →**接取條件**（職業限制／互斥任務）→**完成條件**（要先完成的子任務＋打倒怪物＋繳交道具）→ 花費 → 獎勵（含技能獎勵與職業分組）。**客戶端有、但刻意不上畫面的兩樣**（2026-08-23 玩家看了說是雜訊，資料留在 quests.json）：`have`（接任務時身上要有的道具——20 個楓之島教學任務都寫「要有維澤特西裝」，其餘的則是前一步任務給的、任務鏈已經講過）與 `give`（接任務時 NPC 先給的道具——它存在的意義是**把它從獎勵裡挑出來**，不是拿來顯示）。**查不到獎勵時整個「獎勵」區塊不畫**（81 個任務，獎勵在伺服器端腳本）——「沒有獎勵」「獎勵在伺服器端查不到」「回報給我們補上」這三種說明都被玩家打槍過，畫面少一塊比多一句解釋乾淨。**2026-08-23 全面複查過一次**（玩家回報獎勵有錯），修掉的都寫在上面「任務資料的十個坑」，重點：獎勵不再混進接任務時拿到的道具、打怪需求終於顯示、前置與互斥分開、技能獎勵印名字、職業限定獎勵分組印（#2001 酋長蓋房子的 16 張卷軸其實只拿得到自己職業那兩張）、獎勵有 exp/楓幣時不再多印一行「沒有道具獎勵」。**任務流程卡片**（`src/app/quests/quest-flow.tsx`，2026-10-17 取代舊的「系列鏈」）：整個關聯連通元件一起畫（66 條、最多 74 個任務），主線每步一個編號圓圈、一條直線串起來；分岔畫成框——「都要完成，順序不拘」「擇一」「分成 N 條，各自獨立」這三種框佔一個編號，「另外也要完成」「支線」兩種虛線框不編號、縮排掛在直線旁。標題是目前任務的系列名（沒有就寫「任務流程」），副標「第 i / M 步・共 N 個任務」（在支線框裡就寫「支線」）。長流程會在框內捲動並自動把目前這步捲到中間（不用 scrollIntoView，會連整頁一起捲）。舊做法「照系列名切段」是為了避免標題與步數錯（泰實夫的秘密之書＋妖精羅雯…被併成一條），但代價是線會斷（伊卡路斯）；現在步數只算主線、分岔用框表示，兩個問題都沒有了。搜尋框下方有**地區 chips**（帶任務數）。**2026-08-23 重做分類**：改成 `build-quest-data.py` 的 **`TOWNS` 主城清單 ＋ 三段判定**（1. `MAP_REGION_OVERRIDE` 人工指定 → 2. 地圖名開頭就是某個主城名 → 3. 世界地圖上離哪個主城的點最近），chip 從 15 個收斂成 10 個地區＋未實裝；2026-10-17 加天空之城、冰原雪域與**活動**（活動任務不照地理分，萬聖節那串的 NPC 散在三個地方），變成楓之島 52／弓箭手村 64／魔法森林 64／勇士之村 39／墮落城市 38／維多利亞港 21／奇幻村 21／黃金海岸 9／鯨魚號 37／天空之城 35／冰原雪域 42／活動 75（掛日曆圖示）／未實裝 16，**順序＝TOWNS 宣告順序（遊戲地理動線），不是任務數**（照數量排每次更新 chip 都換位置）。舊做法是「streetName 分組＋涵蓋 ≥3 個主城代碼才依主城代碼拆開」，維多利亞是拆對了，但 streetName 本身有一堆不是大地區的值，chip 就歪掉：迷霧森林（整片其實屬奇幻村）、彩虹之地（楓之島的楓葉村那半）、戰火之地（迷宮，入口分別在勇士之村與弓箭手村門口）、墮落城市地鐵、還有隱藏地圖被 ID 前綴推去「自由市場入口」（詛咒之林其實在魔法森林，靠惡靈森林任務鏈其他五步確認）。三段判定的兩個坑：**第 3 段的底圖要取大陸圖（depth 1）不是最深的子圖**——奇幻村那張子圖上只畫得下一個主城，任何點都會被判給它（迷宮入口就是這樣被吸走）；**depth 0 的世界總圖要排除**（整座大陸糊成一團）。地區存在**任務身上（`quest.region`）不是地圖身上**，而且顯示用 NPC 查不到地圖時會**退而找同一任務的其他 NPC**（例：#6101 接任務的懷玆沒實裝、交任務的那位有），所以判不出地區 ⇔ 該任務所有 NPC 都沒實裝 ⇔ 未實裝任務，chip 因此直接叫「**未實裝**」（掛望遠鏡圖示、永遠排最後）而不是看不懂的「未知」。道具**只有 icon＋名稱前兩字標籤＋數量**（前兩字是因為卷軸類 icon 全長一樣，一個任務要五張不同卷軸時完全分不出來），hover 才出道具彈窗。點獎勵道具開彈窗反查「還有哪些任務給這個」；點 NPC 地圖開世界地圖彈窗（隱藏地圖、活動地圖在世界地圖上沒有點位，只印名字不做成按鈕）。詳情的任務 NPC 有站立圖（`public/icons/npc/<npcId>.gif`，`download-icons.py` 從 maplestory.io 抓；2026-10-17 有 15 個萬聖節活動 NPC（穆尼、樂師…經典版自己加的）各版本都沒有圖，走 `GameIcon` 的 fallback。`GameIcon` 同時修了兩個坑：伺服器端渲染的圖在 React 接手前就 404 會錯過 `onError`（改在 ref 掛上時補查 `complete && naturalWidth === 0`），以及換 src 時上一張的失敗狀態會殘留）。**不做**：個人進度勾選、任務對話原文、等級篩選框。
- `/skills` **技能查詢**（2026-08-22 上線）：吃真資料（`src/data/skills.ts` → `generated/skills.json`）。分「現行版本／未來視」，**分頁樣式與怪物掉落頁共用同一套 pill（未來視帶 Telescope 圖示）**——同一個概念不該在兩頁長得不一樣。**現行 = 1～3 轉共 199 個技能，4 轉進未來視**（2026-10-17 開 3 轉；開關是 `src/data/skills.ts` 的 `RELEASED_TIERS`，頁面副標題從它推導，遊戲開 4 轉改那一行就好）。**未來視分頁連已開放的轉職一起列**，只把未開放的在左欄標望遠鏡圖示——職業線是劍士→狂戰士→十字軍→英雄，只列 4 轉會看不出誰接在誰後面；切到未來視時預設落在第一個未開放職業（英雄），而且在未來視裡點 4 轉技能的 3 轉前置**不會把分頁切回現行版本**（本來就列得到，切了清單會整個縮掉）。**新手技能（職業 000）整個不收**。**互動是「點職業」不是「點技能」**：左欄選職業，右欄列出該職業全部技能。右欄版型比過四種原型（單欄大卡／兩欄卡／左說明右表格／總覽列）後選**總覽列＋就地展開**：一技能一列（圖示＋名稱＋上限＋滿級效果摘要），點列就地長出全等級表格，可多開、附「全部展開」；全部攤開的版本一個職業會拉到十幾個螢幕高，總覽列讓「這個職業有哪些技能」一眼看得完。**左欄依職業群分組、只縮一層**（比過五種原型：四層縮排／兩層分支小標／分支卡膠囊／零縮排／先選轉職階段，選兩層版）：1 轉與 2 轉分支各佔一列，3/4 轉平列在自己那條分支底下（字級略小、共用一條連接線）。一階縮一格的樹狀在 260px 的欄位裡會疊到四層＋三條連接線，太雜。**搜尋只吃技能名與職業名，不吃敘述**（吃敘述的話「攻擊」會命中三百個）；目前職業沒命中時**用推導（useMemo）自動落到第一個有命中的職業**，不要用 useEffect 改 state（會多一輪 render，lint 也擋）。數值只顯示白名單 9 欄，其餘不顯示——逐級敘述本來就把數字寫進去了。表格的「熟練度」是 build 時換算過的百分比（wz 原始值是 1~10 的等級，以前直接印成「1%」），換算跟敘述的 `#M` 同一套。技能說明裡的遊戲橘字標記 `#c…#` 由 `cleanDesc` 拿掉。4 轉技能標「上限 N（需精通書）」。
- `/skill-build` **技能配點模擬**（2026-08-22 上線，2026-10-17 加 3 轉）：選 12 個 2 轉職業之一 → 同時攤開 1 轉 + 2 轉 + 3 轉技能（2 轉與 3 轉一對一。按鈕寫成「狂戰士 → 十字軍」，接上左邊的職業群小標剛好讀成整條職業線——原本只寫 2 轉名字，玩家以為只能配到 2 轉；法師線結尾括號相同時只留後面那個：「巫師 → 魔導士（火、毒）」。小標與按鈕分兩欄，窄螢幕換行才不會鑽到小標底下。網址 `?j=` 還是 2 轉 id、舊連結不會壞），卡片格狀（圖示＋名稱＋前置徽章＋當前等級敘述＋等級滑桿）。預算用「到某等級為止累計可得的 SP」表示：法師 30 級前 67／70 級前 188／120 級前 339，其他職業 61／182／333（公式 = 每升 1 級 +3、每次轉職 +1；**3 轉階段每個職業都是 151 點**，沒有任何職業點得滿 3 轉：戰士線要 240~270、其他 160~180）。**SP 只能往前補、不能往後留**（2026-10-17 依客戶端修正，原本當成完全共用池）：2／3／4 轉教官都會擋「SP 剩太多」，3 轉教官直接說「至少必須消耗完到70級為止獲得的所有SP，我才能幫你進行3轉」（`ScriptString/job3.wzjson`），所以**第 k 轉以後的技能最多只能用第 k 轉之後拿到的 SP**（3 轉 ≤ 151、2+3 轉 ≤ 272），這是滑桿硬上限、夾住時會說是哪條規則；轉職後拿到的 SP 回頭點前面的技能則照舊允許。「轉職前要點完」是**下限**，滑桿不擋（逼人先點滿 1 轉才能配 2 轉太難用），改成里程碑條提示：30 級前那條只算 1 轉技能、70 級前算 1+2 轉，後面的轉職有點數而這條沒達標時印「還差 N 點才能 X 轉」。**各階段並排顯示、不做切換**。**預算面板在右側 sticky 側欄**（手機版移到最上面）：原本是吸頂大卡，會蓋在技能卡上；側欄捲到哪都看得到又不擋內容。面板內容＝已配點／剩餘、**各轉配了幾點**（只有 3 轉附「/ 151」，前面的轉職可以用後面的點數補、沒有固定上限）、三條里程碑條。里程碑條的**顯示值夾在額度內**（`min(used, cap)`）——1 轉技能可以用後面的點數補，點了 80 點時印「80 / 61」只會被當成算錯。**不做「還沒轉職，做不到」這種角色等級判斷**。已知的舊行為：網址只帶 `?j=` 不帶 `b=` 時，瀏覽器裡的草稿會蓋過網址選的職業。**配點用滑桿不用 +/- 按鈕**（2026-08-22 改）：點滿 20 級要按 20 次加號、想直接跳到 15 級也只能一下一下按，成本太高；改成拖滑桿直接到位，另附「點滿」（點到目前可負擔的上限）與「歸零」兩個一鍵操作，鍵盤方向鍵仍可 ±1。嚴格模式：滑桿拖過頭會被夾在 `[minLevel, maxLevel]`（前置不足／SP 不夠／有後續技能還點著），**但一定附上原因**（默默夾住不說話會讓人以為壞了）；降級也擋（把前置降到不足會讓已點技能違規）。localStorage 存草稿 + 「分享」把配點編進網址 `?j=110&b=1100000-20.1100002-30`。**不做**：新手技能、4 轉配點（還沒開放）、角色等級輸入框。
- `/merchant` **神秘商人模擬**（2026-10-29 取代 2026-08-20 上線的 `/gacha` 轉蛋模擬，舊網址 308 轉過來）：用官方機率表模擬「用刷新券刷新貨架」。版面沿用轉蛋那套定案的桌機雙欄（左＝商人視窗＋目標＋統計、右＝官方機率表 sticky），商人視窗＝夜空底的麥吉（NPC 1022002）＋ 3×2 貨架，按鈕＝刷新 1 次／連續刷新 N 次（預設 100，快捷 10/50/100/500，旁邊顯示約略花費）；稀有商品（機率 < 0.1%，`RARE_BELOW`）發光，目標商品掛「目標」標籤。內建目標＝裁決者／森林護者／黑夜護者三套（`build-merchant-data.py` 的 `SET_GOALS`，下一期名稱對不到會整組跳過），加上可搜尋的自訂挑選器；目標的意思是「每件都在貨架上出現過」，商品要不要買、多少錢不在模擬範圍。連續刷新**不會湊齊就停**（「抽到達成為止」2026-08-20 因為太複雜廢除過），改在結算彈窗回報「第幾次刷新時湊齊、花了多少」——這是實際發生的事，不是機率計算。另有 10,000 次的 session 上限；引擎一次算完再由 UI 快轉播放 3.5 秒（貨架跟著快轉）。**純 session，重整歸零**，不寫 localStorage——數字是假的，跨 session 累積花費是假成就。
  - **明確不做機率計算**（2026-08-20 定案，不是待辦）：沒有期望值、達成次數分佈、運氣百分位。理由是使用者不想背書可能算錯的數字。未來要加回來的話，驗證方法是容斥閉式 `P(n)=Σ(-1)^|S|(1-Σp)ⁿ` 對照 10 萬次蒙地卡羅，小數點後三位一致即證明兩邊都對（神秘商人要把 p 換成 1 格機率、n 換成 6×刷新次數）。
  - 轉蛋時期的規格與 issue 在 `.scratch/gacha-sim/`。
- `/fashion` **時裝搭配**：紙娃娃試衣間。時裝的圖吃預先烤好的靜態檔（`src/lib/fashion/baked.ts`，來龍去脈見上面「時裝與特效」），換一件約 0.1 秒。每件時裝有 `preview` 三態：`ok` 有圖、`blank` 透明道具（透明帽那類，穿得上但本來就不畫東西，renderer 直接跳過不抓）、`none` 素材庫沒有——**`none` 的在清單上直接標「無法預覽」、不能點、排在該分頁最後面**，不會像以前讓人點了等十幾秒才知道畫不出來；髮型／臉型某個顏色沒圖時會改挑同造型有圖的顏色。換裝時**舊的那隻留在畫面上**，只在角落亮一個延遲 0.25 秒才淡入的小載入點（素材是靜態檔，整片蓋住的「合成中」只會變成每點一下就閃一次）。左欄的警示現在只剩「這幾件沒載入成功」（網路問題），不再有「素材庫沒有」這種情況。**2026-10-14 改版四件事**：(1) **「目前穿著」每列帶縮圖**，縮圖排最左邊對成一直欄（名稱靠右的話縮圖會跟著參差）；(2) 右欄多一個**「全部」分頁**（排第一個，但預設仍停在髮型），照分頁順序把各部位接起來，髮型／臉型一樣一組造型一格、沿用各自記住的顏色（這個分頁不顯示色票），卡片名稱底下多標一行部位；(3) **性別整個從 UI 拿掉**——篩選 chips、「角色性別」選單、卡片上的「限男／女」與變淡都移除（使用者覺得資料不準），catalog 裡的 `gender` 欄位還在、只是頁面不讀；(4) 角色舞台抽成 `src/app/fashion/preview-stage.tsx`：**滾輪縮放（0.5~4 倍、以游標為中心，滾一格約 1.3 倍）＋按住拖曳**，右下角常駐一排工具鈕＝**放大鏡 −／＋**（按一下 1.5 倍；主要用途是讓人知道這裡可以縮放，也是觸控裝置唯一的縮放方式）與**放大試衣間**，動過視角之後多一顆「重設」；另可**換底色**（`config.ts` 的 `BACKGROUNDS` 七個色票＋自訂選色器）。**「放大試衣間」是版面模式不是燈箱**：左欄 320→480px、舞台變高、角色基準大小翻倍，右邊清單少排一欄但照樣能點——蓋住整頁的燈箱會變成「看大圖」和「換衣服」只能擇一。舞台高度取 `min(480px, 55vh)`，因為左欄是 sticky，比視窗高的話底下的控制項會捲不到。舞台的三個細節別拆掉：wheel 要自己用 `{ passive: false }` 掛（React 的 `onWheel` 擋不住頁面捲動）、**觸控不攔**（手機版舞台在頁面最上面，攔了整頁滑不動）、縮放只動 CSS transform 不重畫 canvas，所以**「下載 PNG」不受視角與底色影響**，仍是去背原尺寸。**同一天第二批（存瀏覽器與分享）**：(5) **每頁件數可選**（24／60／120／240，都是 2、3、4 的倍數，清單排幾欄最後一列都是滿的），存 localStorage；(6) **最愛**：卡片右邊的星星，存的是**道具 id**（髮型／臉型是「某個顏色的那一件」，不是整組造型），右欄最後多一個「最愛」分頁照部位分區列出，分頁上有一行說明「只存在這個瀏覽器、換瀏覽器／清資料／太久沒來就可能不見」——那行是使用者指定要的，別拿掉，但**維持純文字、不要包框**（包了框會跟搜尋框、空狀態疊成三層，被嫌醜）；localStorage 本身沒有設過期時間；(7) **分享造型**（「目前穿著」卡片右上角）把造型編進網址 `/fashion?skin=2003&items=30003.20000.1002357&act=walk1&face=smile`，編解碼在 `src/lib/fashion/share.ts`（items 只放 id、部位查 catalog；背景與縮放是看的人自己的偏好、不進連結）；(8) **頁碼列**抽成 `Pagination`：換頁後**滑順地**捲回清單最上面（`listTopRef.scrollIntoView`，`behavior: "smooth"`，系統開了「減少動態效果」才直接到位；手機版是捲到分頁 chips 而不是整頁頂端，否則又要往下滑過紙娃娃）、可輸入頁碼跳頁（超出範圍夾到頭尾）。**兩種「只有瀏覽器有」的資料走不同的路**：localStorage 的設定走 `src/app/fashion/storage.ts` 的 `useStored`（`useSyncExternalStore`，不必在 effect 裡改 state、也不會 hydration 不一致）；網址帶進來的造型則跟技能配點頁一樣在掛載後的 effect 裡套（它之後還要能被改，不是單純的外部狀態）。頁面上四個下拉選單（動作／表情／膚色／每頁件數）共用 `fashion-client.tsx` 裡的 `Select`：關掉原生外觀自己畫箭頭，因為原生箭頭貼在右邊框上、位置調不了。複製到剪貼簿的 `copyText` 搬到 `src/lib/copy-text.ts`，怪物頁與時裝頁共用。右欄分頁預設停在**髮型**，最後一個分頁是**特效**（**目前在程式裡是註解掉的**；同時只能開一個，再點一次關掉）。特效不佔部位、沒有性別限制，所以跟 `equips` 分開放在 `CharacterLook.effect`。渲染見 `src/lib/fashion/renderer.ts`：特效不參與遮蔽也不吃錨點傳播，就是畫在角色原點的一組圖，`z` 決定畫在角色前面還是後面（`drawFrame` 的後方那疊→角色→前方那疊）。
- `/party/*` **組隊工具**（2026-09-07 併入 dev）：各組隊任務一頁，**沒有 `/party` 這個 landing page**——選單上是 `nav.ts` 的「組隊」`NavGroup`，下拉本身就在做「列出三個工具」這件事，再放一頁一模一樣的入口是重複的（分支原本自帶一套 `NavItem.children` 兩層選單，dev 這邊已有 `NavGroup`，合併時丟掉分支那套）。`first-time-together`（第一次同行）是第一階段克魯特 9 題題庫，題目字串出自客戶端 `String/TW/ScriptString/party.wzjson`、答案是交叉比對來的（見 `src/data/party-quests.ts` 註解）；`moon-bunny`（月妙的年糕）是在真實地圖底圖上把 14 叢草＋6 朵花標成一張攻略圖（SVG 疊在圖上、共用底圖像素座標）。**玩家常把視窗縮在遊戲旁邊對照**，所以 md（768px）以上整張圖跟著版面縮放、以下拆成「迎月花／草叢左半／草叢右半」三塊直排（同一張底圖用 SVG viewBox 裁，不多下載；左右兩半等寬，標記也放大）——以前固定 900px，視窗一窄右半邊就被裁掉；`tower-of-goddess`（女神之塔）四個分頁小工具（休息室／封印房／倉庫／女神像；女神像那頁跟月妙一樣是底圖＋SVG 泡泡，泡泡右上角的數字＝第幾個碎片）**封印房是經典版規則**（2026-10-17 改；舊版照 4 人、易克回 0/1/2 寫，是錯的）：5 人站左中右三個踏板、隊長不站，易克只回「所有踏板的重量都不相同」（＝0，UI 畫成 ✕）或「1 個踏板正確」，7 次內沒過會被趕出去、答案重抽——全部出自 `String/TW/ScriptString/party3.wzjson` 的易克對白（#110、#148–#156）。站法照玩家流傳的那棵解法樹（寫死在 `sealed-room.ts`，最多 6 次），模組載入時拿 21 種答案逐一篩過、漏分支就直接 throw。版面是上半「可以按」的下一步卡片＋下半整棵樹（不按也能當對照圖看），兩邊同步；樹是**直的**（由上往下一列＝第幾次，使用者指定；橫向版被換掉），只在分岔的橫線上標 ✕／1（往左一律 ✕、往右一律 1，跟卡片的兩顆按鈕同順序），窄／寬螢幕用兩套間距（`NARROW`／`WIDE`，窄版不畫「第 N 次」）。使用者打槍過的：每條線都標記、格子加外框、人數增減的 +1／−1、「角落數字＝跟上次比」這種說明字。
- **NPC 對話／關卡說明文字**都在 `json_a2909ccd…` 包的 `Assets/WzAssets/Json/String/TW/ScriptString/*.wzjson`（126 檔，`party`~`party6` 是六個組隊任務、`job`/`job2` 轉職…），格式就是 WZJS，`tools/wzjs.py` 直接解得開。- `/monsters` 吃真資料（`src/data/drops.ts` → `generated/monster-drops.json`，見上面資料管線）。搜尋支援怪物名/道具名（反查誰掉某道具）/地圖名；放大鏡旁的漏斗按鈕開進階篩選（屬性弱點多選、等級範圍）。分「現行版本／未來視」分頁：現行 112 隻（有實裝地圖的怪）＋人工補充掉落；未來視 231 隻（未實裝怪與帶未實裝掉落的怪）。實裝了但圖鑑掉落全是未實裝道具的怪（例：幼黑格里芬，掉的全是魔法粉／製作催化劑），掉落區會說「目前版本都還沒開放」而不是「沒有記錄」。**出沒地圖 chip 點了會開世界地圖彈窗**，在拆包出的遊戲世界地圖上標出該地圖位置（同張圖上這隻怪的其他出沒點也會標小點，可點切換）；不在遊戲世界地圖上的隱藏圖/迷你地城借「ID 最接近的鄰居」標約略位置（顯示「約略位置」徽章）。原本的「地區分類」已移除（2026-08-16）——ID 前綴推地區在維多利亞整個對不上（101030xxx 遺跡發掘地其實在勇士之村、100040xxx 其實是魔法森林南部），改用世界地圖標點一勞永逸。詳情面板有怪物數值（HP/攻防/命中/迴避）與屬性抗性（elemAttr：F火 I冰 L雷 S毒 H聖 D暗；1=免疫 2=抗性 3=弱點）。UI 無掉落機率欄位（拿不到真值）。

---

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
