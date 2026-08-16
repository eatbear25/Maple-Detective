/**
 * 紙娃娃合成渲染器：在瀏覽器端把身體、頭與各部位裝備合成成角色。
 *
 * 演算法移植自 MapleSalon2（MIT，Copyright (c) 2024 Leo Lin，
 * src/renderer/character/*），經 maple-runway 專案驗證過：
 * - 錨點傳播：身體登錄 navel/neck/hand 等共用錨點，其餘部件靠這些點對位
 * - 圖層順序：zmap.json（原始順序 index 0 = 最前層，繪製時反轉由後往前畫）
 * - 部位遮蔽：smap.json + 各道具的 islot/vslot 建 lock 表（帽子蓋住哪幾層頭髮…）
 * - 臉／臉飾：依表情而非動作取部件，錨定在身體 frame 的 brow
 *
 * 與 maple-runway 的差異：這裡只有單一素材來源（maplestory.io），且個別裝備
 * 抓不到時不會讓整隻角色渲染失敗——會跳過該件並回報在 missing 裡，讓 UI 顯示
 * 「這件無法預覽」。約 6% 的點裝兩個版本都查不到，這是常態不是例外。
 */
import { fetchItemWz, fetchMappings, imageUrl } from "./wz";
import type { CharacterLook } from "./config";

interface Vec2 {
  x: number;
  y: number;
}

type AnchorMap = Record<string, Vec2>;

/** WZ canvas 節點（帶 path 與 origin 的葉節點） */
interface WzCanvas {
  _outlink?: string;
  path?: string;
  origin?: Vec2;
  map?: AnchorMap;
  z?: string | number;
}

type WzFrame = Record<string, unknown>;

interface LoadedItem {
  id: number;
  path: string;
  wz: Record<string, unknown>;
  islot: string[];
  vslot: string[];
  isBody: boolean;
  isHead: boolean;
  /** 臉型或臉部飾品：用表情取部件 */
  isExpressionItem: boolean;
  /** 臉部飾品且會蓋掉臉（info.invisibleFace） */
  isOverrideFace: boolean;
}

interface Piece {
  name: string;
  url: string;
  origin: Vec2;
  map: AnchorMap;
  layer: string;
  sortKey: number;
  item: LoadedItem;
}

interface PieceGroup {
  layer: string;
  sortKey: number;
  frames: (Piece | null)[];
}

export interface DrawOp {
  img: HTMLImageElement;
  x: number;
  y: number;
}

export interface PreparedFrame {
  ops: DrawOp[];
  delay: number;
}

export interface PreparedAnimation {
  frames: PreparedFrame[];
  /** 所有 frame 的聯集邊界，畫布共用避免動畫抖動 */
  width: number;
  height: number;
  /** 世界座標 → 畫布座標的位移 */
  offsetX: number;
  offsetY: number;
  /** 素材庫查不到、這次沒畫上去的裝備 id */
  missing: number[];
}

// ===== zmap / smap =====

/**
 * WZ 資料中存在但 zmap.json 沒有的圖層名稱 → 等價既有圖層。
 * 對照表來自 MapleSalon2 zmapIndex.ts（含官方資料本身的拼字錯誤）。
 */
const LAYER_ALIASES: Record<string, string> = {
  accessoryFaceOverCap: "accessoryEyeOverCap",
  backBelowBody: "backShieldBelowBody",
  backCapAcssesary: "backHairBelowCap",
  backCapBelowHair: "backCap",
  backCapBelowHead: "backMailChestOverPants",
  backCapeBelowHead: "backMailChestOverPants",
  backWeaponBelowGlove: "backWeaponOverGlove",
  capBelowHair: "hairBelowBody",
  capBelowBody: "hairBelowBody",
  capBackHair: "hairOverHead",
  capBelowHead: "capAccessoryBelowBody",
  capeArm: "cape",
  capeBelowHair: "hairBelowBody",
  capeBelowChest: "mailChest",
  capeBelowBodyOverPants: "pants",
  capeOverHeadOverCap: "capAccessory",
  capeUnderBody: "capeBelowBody",
  capeWeapon: "capeOverHead",
  gloveBelowHair: "hair",
  hairBelowHead: "mailArmBelowHead",
  mailChestBelowBody: "gloveWristBelowBody",
  shieldBelowArm: "weaponBelowArm",
  weapnBelowBody: "weaponBelowBody",
  weponBelowBody: "weaponBelowBody",
  weaponBelowArmOverHead: "head",
  weaponBelowGlove: "gloveWristOverBody",
  weaponBelowHand: "weaponOverArmBelowHead",
  weaponBelowHandOverBody: "weaponOverArmBelowHead",
  weaponBelowHead: "weaponOverArmBelowHead",
  weaponBelowbody: "weaponBelowBody",
  weaponBodyBelow: "weaponBelowBody",
  weaponOverArmBelowBody: "weaponOverArmBelowHead",
  weaponOverBelowArm: "weaponOverArmBelowHead",
  weaponOverGloveBelowMailArm: "glove",
  weaponOverHead: "hairOverHead",
  weaponWrist: "gloveWrist",
  weaponback: "backWeapon",
  weaponWristOverGloveOverArm: "weaponOverArm",
  weaponEffecctOver: "weaponOverBody",
  backbackWeapon: "backWeapon",
  capeOverBody: "weaponOverBody",
  capeBelowHead: "armBelowHead",
  capeOverArm: "gloveWrist",
  rglove: "gloveWrist",
};

/** 臉的正面圖層，背面動作（爬梯／爬繩）時整組隱藏 */
const FRONT_FACE_LAYERS = new Set([
  "accessoryFace",
  "capAccessoryBelowAccFace",
  "accessoryFaceOverFaceBelowCap",
  "face",
  "accessoryEyeBelowFace",
  "accessoryFaceBelowFace",
]);

/** alert/heal 動作缺 handMove 錨點時的預設值（per frame，相對 navel） */
const HAND_MOVE_DEFAULTS: Vec2[] = [
  { x: -8, y: -2 },
  { x: -10, y: 0 },
  { x: -12, y: 3 },
];

/** 來回播放的動作（站立呼吸 0,1,2 → 0,1,2,1 循環）；走路等步伐動作維持正向循環 */
const PING_PONG_ACTIONS = new Set(["stand1", "stand2"]);

/** 角色背對鏡頭的動作，default 後備優先取 backDefault */
const BACK_ACTIONS = new Set(["ladder", "rope"]);

const EAR_REG = /ear$/i;
/** 顯示哪種耳朵（head img 內有 humanEar/ear/lefEar/highlefEar 四種） */
const EAR_TYPE = "humanEar";

class ZmapIndex {
  /** 由後往前排序的圖層陣列（index 越大越前面） */
  layers: string[];
  private index = new Map<string, number>();

  constructor(zmapFrontFirst: string[]) {
    this.layers = [...zmapFrontFirst].reverse();
    for (let i = 0; i < this.layers.length; i++) {
      this.set(this.layers[i], i);
    }
    for (const [alias, target] of Object.entries(LAYER_ALIASES)) {
      const targetIndex = this.get(target);
      if (targetIndex !== undefined) this.set(alias, targetIndex);
    }
  }

  private set(name: string, i: number) {
    this.index.set(name, i);
    if (name.length > 2) this.index.set(name.toLowerCase(), i);
  }

  get(name: string): number | undefined {
    return this.index.get(name) ?? this.index.get(name.toLowerCase());
  }

  /**
   * 解析部件的圖層名稱：優先 z，再部件名，再數字 z，
   * 再嘗試從 xxxBelowYyy 這種組合名推算，最後退回道具 islot。
   */
  resolve(pieceName: string, z: string | number | undefined, islot: string[]) {
    if (typeof z === "string" && z && this.get(z) !== undefined) return z;
    if (this.get(pieceName) !== undefined) return pieceName;

    const zNum = typeof z === "number" ? z : Number(z);
    if (z !== undefined && z !== "" && !Number.isNaN(zNum)) {
      const target = this.layers[this.layers.length - 10 - zNum];
      if (target) return target;
    }
    if (typeof z === "string" && z && this.tryResolveComposite(z) !== undefined) {
      return z;
    }
    return islot[0] ?? pieceName;
  }

  /** 把 headBelowBody 這種名字拆成 [head, below, body] 推算層級 */
  private tryResolveComposite(name: string): number | undefined {
    const parts = name.toLowerCase().split(/(below|under|over|above)/);
    if (parts.length < 3 || parts.length % 2 === 0) return undefined;
    let index = this.get(parts[0]);
    if (index === undefined) return undefined;
    for (let i = 1; i < parts.length; i += 2) {
      const target = this.get(parts[i + 1]);
      if (target === undefined) return undefined;
      index = parts[i] === "below" || parts[i] === "under" ? target - 1 : target + 1;
    }
    this.set(name, index);
    return index;
  }

  sortKey(layer: string): number {
    return this.get(layer) ?? 0;
  }
}

let zmapIndexPromise: Promise<{
  zmapIndex: ZmapIndex;
  smap: Record<string, string>;
}> | null = null;

function getZmapIndex() {
  if (!zmapIndexPromise) {
    zmapIndexPromise = fetchMappings()
      .then(({ zmap, smap }) => ({ zmapIndex: new ZmapIndex(zmap), smap }))
      .catch((err) => {
        zmapIndexPromise = null;
        throw err;
      });
  }
  return zmapIndexPromise;
}

// ===== 道具載入 =====

// origin 不強制：部分道具的連結節點缺 origin，缺時當 (0,0)
const isCanvas = (node: unknown): node is WzCanvas =>
  !!node &&
  typeof node === "object" &&
  typeof ((node as WzCanvas)._outlink || (node as WzCanvas).path) === "string";

const pad8 = (id: number) => String(id).padStart(8, "0");

async function loadItem(id: number, path: string): Promise<LoadedItem> {
  const wz = (await fetchItemWz(path)) as Record<string, unknown>;
  const info = (wz.info ?? {}) as Record<string, unknown>;
  let islot: string[] =
    (typeof info.islot === "string" && info.islot.match(/.{1,2}/g)) || [];
  const vslot: string[] =
    (typeof info.vslot === "string" && info.vslot.match(/.{1,2}/g)) || [];

  // 鞋子偶爾帶著奇怪的 islot，強制修正（MapleSalon2 同樣處理）
  if (path.includes("/Shoes/") && !islot.includes("So")) islot = ["So"];

  const isBody = /^Character\/0000[0-9]{4}\.img$/.test(path);
  const isHead = /^Character\/0001[0-9]{4}\.img$/.test(path);
  const isFace = path.includes("/Face/") || islot[0] === "Fc";
  const isFaceAccessory = islot.includes("Af") || islot.includes("Ay");

  return {
    id,
    path,
    wz,
    islot,
    vslot,
    isBody,
    isHead,
    isExpressionItem: isFace || isFaceAccessory,
    isOverrideFace: info.invisibleFace === 1,
  };
}

/**
 * 點裝武器的 img 以數字子目錄（30～70）分武器種類，挑一個有此動作的；
 * 一般道具直接用頂層動作。
 */
function getActionRoot(
  item: LoadedItem,
  action: string,
): Record<string, unknown> | undefined {
  const wz = item.wz;
  if (wz[action] !== undefined) return wz;
  if (wz.alert !== undefined || wz.jump !== undefined) return wz;

  const numericKeys = Object.keys(wz)
    .filter((k) => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);
  if (numericKeys.includes(30)) {
    const base = wz["30"] as Record<string, unknown>;
    if (base?.[action]) return base;
  }
  for (const key of numericKeys) {
    const sub = wz[String(key)] as Record<string, unknown>;
    if (sub?.[action]) return sub;
  }
  return undefined;
}

/** 取此道具在指定動作／表情下的部件組（跨 frame），結果快取在 item 上 */
const groupCache = new WeakMap<LoadedItem, Map<string, PieceGroup[]>>();

function getPieceGroups(
  item: LoadedItem,
  actionName: string,
  zmapIndex: ZmapIndex,
): PieceGroup[] {
  let byAction = groupCache.get(item);
  if (!byAction) {
    byAction = new Map();
    groupCache.set(item, byAction);
  }
  const cached = byAction.get(actionName);
  if (cached) return cached;

  const buildGroups = (actionData: WzFrame): PieceGroup[] => {
    const numericKeys = Object.keys(actionData)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => !Number.isNaN(n));
    const frameCount = numericKeys.length
      ? numericKeys.reduce((a, b) => Math.max(a, b + 1), numericKeys.length)
      : 1;
    /** 表情類的 default 沒有 frame 層，節點本身就是一格 */
    const framelessSingle = numericKeys.length === 0;

    const groups = new Map<string, PieceGroup>();
    for (let frame = 0; frame < frameCount; frame++) {
      const frameData = (framelessSingle ? actionData : actionData[frame]) as
        | WzFrame
        | undefined;
      if (!frameData || typeof frameData !== "object") continue;

      for (const [pieceName, node] of Object.entries(frameData)) {
        if (!isCanvas(node)) continue; // 略過 delay/face 等屬性與資料夾節點

        // 耳朵只畫選定的類型
        if (item.isHead && EAR_REG.test(pieceName) && pieceName !== EAR_TYPE) {
          continue;
        }

        const layer = zmapIndex.resolve(pieceName, node.z, item.islot);
        const key = `${pieceName}|${layer}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            layer,
            sortKey: zmapIndex.sortKey(layer),
            frames: new Array(frameCount).fill(null),
          };
          groups.set(key, group);
        }
        group.frames[frame] = {
          name: pieceName,
          url: (node._outlink || node.path)!,
          origin: node.origin ?? { x: 0, y: 0 },
          map: node.map ?? { navel: { x: 0, y: 0 } },
          layer,
          sortKey: group.sortKey,
          item,
        };
      }
    }
    return [...groups.values()];
  };

  const root = getActionRoot(item, actionName);
  let actionData = root?.[actionName] as WzFrame | undefined;

  // 臉型可能缺 default 表情，拿 blink 第 0 格頂替（MapleSalon2 同樣處理）
  if (!actionData && item.isExpressionItem && actionName === "default") {
    const blink = item.wz.blink as Record<string, WzFrame> | undefined;
    if (blink?.[0]) {
      const { delay: _delay, ...rest } = blink[0] as Record<string, unknown>;
      actionData = rest as WzFrame;
    }
  }

  let result = actionData && typeof actionData === "object" ? buildGroups(actionData) : [];

  // 部分道具（多為帽子）沒有此動作的部件：退回不分動作的 default/backDefault，
  // 背面動作（爬梯／爬繩）優先取 backDefault
  if (result.length === 0 && !item.isBody && !item.isHead) {
    const fallbackKeys = BACK_ACTIONS.has(actionName)
      ? ["backDefault", "default"]
      : ["default", "backDefault"];
    for (const key of fallbackKeys) {
      const node = item.wz[key];
      if (node && typeof node === "object") {
        result = buildGroups(node as WzFrame);
        if (result.length > 0) break;
      }
    }
  }

  byAction.set(actionName, result);
  return result;
}

// ===== 遮蔽（lock）判定 =====

function buildLocks(items: LoadedItem[], zmapIndex: ZmapIndex) {
  const sorted = [...items].sort((a, b) => a.id - b.id);
  const ordered: LoadedItem[] = [];
  for (const layer of zmapIndex.layers) {
    for (const item of sorted) {
      if (item.islot.includes(layer)) ordered.push(item);
    }
  }
  const locks = new Map<string, number>();
  for (const item of ordered) {
    for (const slot of item.vslot) locks.set(slot, item.id);
  }
  return locks;
}

function isPieceVisible(
  piece: Piece,
  locks: Map<string, number>,
  smap: Record<string, string>,
): boolean {
  const { item, layer } = piece;
  const hasAll = (slots: string[]) =>
    slots.every((slot) => {
      const owner = locks.get(slot);
      return owner === undefined || owner === item.id;
    });

  // 特例對照 MapleSalon2 characterZmapContainer.ts（部分源自 maplestory.js）
  let layerLocks: string[];
  if (layer === "mailArm") {
    layerLocks = ["Ma"];
  } else if (layer === "backHead") {
    layerLocks = ["Hd"];
  } else if (layer === "pants" || layer === "backPants") {
    layerLocks = ["Pn"];
  } else {
    layerLocks = smap[layer]?.match(/.{1,2}/g) || [];
  }

  if (item.islot.includes("Cp")) {
    layerLocks = item.vslot;
  } else if (
    item.islot.length === 1 &&
    item.islot[0] === "Hd" &&
    (layer === "accessoryOverHair" || layer === "hairShade")
  ) {
    layerLocks = ["Hd"];
  }
  if (layer === "mailChest") layerLocks = item.vslot;

  return hasAll(item.vslot) || hasAll(layerLocks);
}

// ===== 圖片載入 =====

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const IMAGE_CACHE_LIMIT = 800;

function loadImage(nodePath: string): Promise<HTMLImageElement> {
  let cached = imageCache.get(nodePath);
  if (!cached) {
    cached = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      // 素材主機開 CORS，匿名載入讓 canvas 可以匯出下載
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        imageCache.delete(nodePath);
        reject(new Error(`圖片載入失敗：${nodePath}`));
      };
      img.src = imageUrl(nodePath);
    });
    if (imageCache.size >= IMAGE_CACHE_LIMIT) {
      const oldest = imageCache.keys().next().value;
      if (oldest !== undefined) imageCache.delete(oldest);
    }
    imageCache.set(nodePath, cached);
  }
  return cached;
}

// ===== 合成主流程 =====

interface PlacedPiece {
  piece: Piece;
  /** 部件原點（origin 對齊點）的世界座標 */
  world: Vec2;
}

/** 錨點傳播：反覆嘗試直到所有部件都能定位（部件間錨點互相依賴） */
function placePieces(pieces: Piece[], anchors: Map<string, Vec2>): PlacedPiece[] {
  const placed: PlacedPiece[] = [];
  const pending = [...pieces];
  const maxPasses = pieces.length * 4 + 4;

  for (let pass = 0; pass < maxPasses && pending.length > 0; pass++) {
    let progressed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const piece = pending[i];
      const anchorName = Object.keys(piece.map).find((name) => anchors.has(name));
      if (!anchorName) continue;

      const base = anchors.get(anchorName)!;
      const local = piece.map[anchorName];
      const world = { x: base.x - local.x, y: base.y - local.y };
      // 這個部件帶有的其他錨點，登錄成後續部件的定位依據
      for (const [name, point] of Object.entries(piece.map)) {
        if (name !== anchorName && !anchors.has(name)) {
          anchors.set(name, { x: world.x + point.x, y: world.y + point.y });
        }
      }
      placed.push({ piece, world });
      pending.splice(i, 1);
      progressed = true;
    }
    if (!progressed) break; // 剩下的部件缺共用錨點，放棄避免死迴圈
  }
  return placed;
}

export interface ComposeOptions {
  look: CharacterLook;
  action: string;
  expression: string;
}

/**
 * 站立／走路的 1（空手）、2（持武）姿勢由武器種類決定：
 * 單手武器只有 stand1、雙手只有 stand2。選到武器沒有的姿勢時，
 * 整隻角色改用武器支援的那個（遊戲內也是如此）。
 */
function resolveStance(action: string, items: LoadedItem[]): string {
  const match = /^(stand|walk)([12])$/.exec(action);
  if (!match) return action;

  const weapon = items.find(
    (item) => item.islot.includes("Wp") || item.path.includes("/Weapon/"),
  );
  if (!weapon) return action;

  const [, base, variant] = match;
  const other = `${base}${variant === "1" ? "2" : "1"}`;
  const supports = (name: string) => getActionRoot(weapon, name)?.[name] !== undefined;
  if (!supports(action) && supports(other)) return other;
  return action;
}

/**
 * 合成一個動作的所有 frame，回傳可直接畫上 canvas 的部件序列與共用邊界。
 * 個別裝備素材庫查不到時會跳過並記在 missing，不會讓整隻角色渲染失敗。
 */
export async function prepareCharacterFrames({
  look,
  action: requestedAction,
  expression,
}: ComposeOptions): Promise<PreparedAnimation> {
  const { zmapIndex, smap } = await getZmapIndex();

  const bodyId = look.skinId;
  const headId = look.skinId + 10000;

  // 身體與頭是必要的（走自家 /wz-static，正常不會失敗）
  const [body, head] = await Promise.all([
    loadItem(bodyId, `Character/${pad8(bodyId)}.img`),
    loadItem(headId, `Character/${pad8(headId)}.img`),
  ]);

  // 裝備逐件載入，缺的跳過
  const equips = Object.values(look.equips).filter(
    (equip): equip is NonNullable<typeof equip> => equip !== undefined,
  );
  const settled = await Promise.allSettled(
    equips.map((equip) => loadItem(equip.id, equip.path)),
  );
  const items: LoadedItem[] = [body, head];
  const missing: number[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") items.push(result.value);
    else missing.push(equips[i].id);
  });

  const action = resolveStance(requestedAction, items);
  const bodyAction = body.wz[action] as Record<string, WzFrame> | undefined;
  if (!bodyAction) throw new Error(`此動作沒有身體資料：${action}`);

  const frameKeys = Object.keys(bodyAction)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => !Number.isNaN(n));
  const frameCount = Math.max(1, ...frameKeys.map((n) => n + 1));

  const locks = buildLocks(items, zmapIndex);
  const isOverrideFace = items.some(
    (item) => item.isExpressionItem && !item.isBody && item.isOverrideFace,
  );

  const rawFrames: { placed: PlacedPiece[]; delay: number }[] = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const bodyFrame = bodyAction[frame] as Record<string, unknown> | undefined;
    const delay =
      typeof bodyFrame?.delay === "number" && bodyFrame.delay > 0 ? bodyFrame.delay : 180;
    const showFace = bodyFrame?.face !== 0;

    // 1. 身體系部件（依動作）
    const actionPieces: Piece[] = [];
    for (const item of items) {
      if (item.isExpressionItem && !item.isBody && !item.isHead) continue;
      for (const group of getPieceGroups(item, action, zmapIndex)) {
        const piece = group.frames[frame % group.frames.length];
        if (piece) actionPieces.push(piece);
      }
    }

    // 身體本體以自己的 origin 定位在 (0,0)（遊戲引擎的角色位置點），
    // 其餘部件靠身體登錄的錨點（navel/neck…）對位。
    // 若改用 navel 當原點，navel 在呼吸／走路時相對腳底會移動，整隻角色會逐 frame 飄移
    const anchors = new Map<string, Vec2>();
    const placed: PlacedPiece[] = [];
    const rootIndex = actionPieces.findIndex((p) => p.item.isBody && p.name === "body");
    if (rootIndex >= 0) {
      const [root] = actionPieces.splice(rootIndex, 1);
      placed.push({ piece: root, world: { x: 0, y: 0 } });
      for (const [name, point] of Object.entries(root.map)) {
        anchors.set(name, { x: point.x, y: point.y });
      }
    } else {
      // 極端情況（此動作沒有 body 部件）：退回 navel 當原點
      anchors.set("navel", { x: 0, y: 0 });
    }

    if ((action === "alert" || action === "heal") && !anchors.has("handMove")) {
      const navel = anchors.get("navel") ?? { x: 0, y: 0 };
      const d = HAND_MOVE_DEFAULTS[frame] ?? HAND_MOVE_DEFAULTS[0];
      anchors.set("handMove", { x: navel.x + d.x, y: navel.y + d.y });
    }

    placed.push(...placePieces(actionPieces, anchors));

    // 2. 臉與臉部飾品（依表情，錨定身體的 brow；背面／特定 frame 隱藏）
    const isBackAction = placed.some((p) => p.piece.layer === "backBody");
    if (showFace && !isBackAction) {
      const facePieces: Piece[] = [];
      for (const item of items) {
        if (!item.isExpressionItem || item.isBody || item.isHead) continue;
        const groups = getPieceGroups(item, expression, zmapIndex);
        const fallback =
          groups.length > 0 ? groups : getPieceGroups(item, "default", zmapIndex);
        for (const group of fallback) {
          const piece = group.frames[0];
          if (!piece) continue;
          // 臉飾若指定隱藏臉，把臉本體濾掉
          if (isOverrideFace && piece.item.islot[0] === "Fc") continue;
          facePieces.push(piece);
        }
      }
      placed.push(...placePieces(facePieces, anchors));
    }

    // 3. 遮蔽與背面臉部圖層過濾
    const visible = placed.filter(({ piece }) => {
      if (isBackAction && FRONT_FACE_LAYERS.has(piece.layer)) return false;
      return isPieceVisible(piece, locks, smap);
    });

    // 4. 圖層排序（sortKey 小的先畫 = 在後面）
    visible.sort((a, b) => a.piece.sortKey - b.piece.sortKey);
    rawFrames.push({ placed: visible, delay });
  }

  // 載圖 + 計算聯集邊界
  const urls = new Set<string>();
  for (const { placed } of rawFrames) {
    for (const { piece } of placed) urls.add(piece.url);
  }
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        images.set(url, await loadImage(url));
      } catch {
        // 個別部件缺圖不影響整體
      }
    }),
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const frames: PreparedFrame[] = rawFrames.map(({ placed, delay }) => {
    const ops: DrawOp[] = [];
    for (const { piece, world } of placed) {
      const img = images.get(piece.url);
      if (!img) continue;
      const x = world.x - piece.origin.x;
      const y = world.y - piece.origin.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + img.naturalWidth);
      maxY = Math.max(maxY, y + img.naturalHeight);
      ops.push({ img, x, y });
    }
    return { ops, delay };
  });

  if (!Number.isFinite(minX)) throw new Error("此組合沒有任何可繪製的部件");

  // 來回播放：附加中間 frame 的反向序列（邊界不變，只是重複引用）
  if (PING_PONG_ACTIONS.has(action) && frames.length > 2) {
    frames.push(...frames.slice(1, -1).reverse());
  }

  const PADDING = 4;
  return {
    frames,
    width: Math.ceil(maxX - minX) + PADDING * 2,
    height: Math.ceil(maxY - minY) + PADDING * 2,
    offsetX: -minX + PADDING,
    offsetY: -minY + PADDING,
    missing,
  };
}

/** 把一個 frame 畫到 canvas 上（呼叫端負責清空與尺寸） */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedAnimation,
  frameIndex: number,
  flipX: boolean,
) {
  const frame = prepared.frames[frameIndex % prepared.frames.length];
  if (!frame) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flipX) {
    ctx.translate(prepared.width, 0);
    ctx.scale(-1, 1);
  }
  for (const op of frame.ops) {
    ctx.drawImage(
      op.img,
      Math.round(op.x + prepared.offsetX),
      Math.round(op.y + prepared.offsetY),
    );
  }
  ctx.restore();
}
