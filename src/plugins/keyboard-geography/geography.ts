import type { Question } from "@/domain/types";
import { isBlackKey, midiToNoteName } from "@/lib/music/midi";

/**
 * 键盘地理锚点领域数据（主线首技巧，工单 #39；教学法依据 .scratch/research/pedagogy.md A1/A2）：
 *
 * - 黑键组锚点：黑键以「2 个一组、3 个一组」循环排列——2 组左侧白键是 C、中间夹着 D；
 *   3 组左侧白键是 F、内部从左到右夹着 G 和 A；
 * - 天然半音：键盘上仅有的两对「中间没有黑键」的相邻白键 E-F 与 B-C；
 * - 音名快答：全键盘（C3–C6）任意白键，科学音高记名（中央 C = C4）。
 *
 * 本技巧「不看谱」：题目锚定键盘图与音名文字（cue），不出现五线谱——
 * 题面组件（./stage.tsx）与教程页（./tutorial.mdx）共用这里的纯函数取数。
 * 单一真源：manifest 题池、judge 反馈、题面提示文案全部从这里派生。
 *
 * 纯 TypeScript，无 DOM / 浏览器 API 依赖（服务端渲染与 vitest 均可直接 import）。
 */

/** 目标白键相对黑键组的方位（黑键 2 组：left/middle；3 组：left/inner-1/inner-2）。 */
export type BlackGroupRelation = "left" | "middle" | "inner-1" | "inner-2";

/** 题目锚定形态（cue）：键盘图上高亮什么、题面文字怎么问。 */
export type KeyboardGeoCue =
  | {
      kind: "black-group";
      /** 组内最低（最左）黑键的 MIDI。 */
      groupLowestMidi: number;
      groupSize: 2 | 3;
      relation: BlackGroupRelation;
    }
  | {
      kind: "semitone-pair";
      /** 该对中较低白键（E 或 B）的 MIDI。 */
      lowerMidi: number;
      /** 问较低还是较高的白键。 */
      ask: "lower" | "upper";
    }
  | { kind: "note-name" };

/** 题目：键盘上的一个目标白键。midi 为音高唯一真源，judge 只认它。 */
export type KeyboardGeoQuestion = Question & {
  type: "keyboard-geo";
  midi: number;
  cue: KeyboardGeoCue;
};

/** level.pool 的技巧自定义形状：三种题池，各带音域边界（白键）。 */
export type KeyboardGeoPoolSpec =
  | { kind: "black-group-anchors"; lowestMidi: number; highestMidi: number }
  | { kind: "semitone-pairs"; lowestMidi: number; highestMidi: number }
  | { kind: "white-key-names"; lowestMidi: number; highestMidi: number };

/** 题面/教程页键盘图高亮色：黑键组 = 蓝、天然半音对 = 紫（与地标五色不冲突）。 */
export const GEO_COLORS = {
  blackGroup: "#2563eb", // blue-600
  semitonePair: "#7c3aed", // violet-600
} as const;

/** 锚点关卡（L1/L2）音域：C3–C5（中央 C 两侧各一个八度，与键盘图默认一致）。 */
export const ANCHOR_RANGE = { lowestMidi: 48, highestMidi: 72 } as const;

/** 快答关卡（L3）音域：C3–C6（虚拟钢琴全音域，即本产品的「全键盘」）。 */
export const FULL_RANGE = { lowestMidi: 48, highestMidi: 84 } as const;

/** cue → 目标键推导（题池枚举与一致性校验共用）；note-name 无推导目标。 */
export function targetOfCue(cue: KeyboardGeoCue): number {
  switch (cue.kind) {
    case "black-group": {
      const g = cue.groupLowestMidi;
      if (cue.groupSize === 2) {
        if (cue.relation === "left") return g - 1; // 2 组左侧 = C
        if (cue.relation === "middle") return g + 1; // 2 组中间 = D
      } else {
        if (cue.relation === "left") return g - 1; // 3 组左侧 = F
        if (cue.relation === "inner-1") return g + 1; // 3 组内部第一 = G
        if (cue.relation === "inner-2") return g + 3; // 3 组内部第二 = A
      }
      throw new Error(
        `keyboard-geography: 黑键 ${cue.groupSize} 组与方位 "${cue.relation}" 不匹配`,
      );
    }
    case "semitone-pair":
      return cue.ask === "lower" ? cue.lowerMidi : cue.lowerMidi + 1;
    case "note-name":
      throw new Error("keyboard-geography: note-name 锚定无推导目标（midi 随题给出）");
  }
}

/** cue 在键盘图上高亮的键（黑键组的黑键 / 半音对的两白键；note-name 无高亮）。 */
export function cueHighlightMidis(cue: KeyboardGeoCue): number[] {
  switch (cue.kind) {
    case "black-group": {
      const g = cue.groupLowestMidi;
      return cue.groupSize === 2 ? [g, g + 2] : [g, g + 2, g + 4];
    }
    case "semitone-pair":
      return [cue.lowerMidi, cue.lowerMidi + 1];
    case "note-name":
      return [];
  }
}

/** cue 的高亮色（题面与教程页统一口径）。 */
export function cueColor(cue: KeyboardGeoCue): string {
  return cue.kind === "semitone-pair" ? GEO_COLORS.semitonePair : GEO_COLORS.blackGroup;
}

/** 题面提示文字（题面组件大字呈现；纯函数，可单测）。 */
export function cuePrompt(midi: number, cue: KeyboardGeoCue): string {
  switch (cue.kind) {
    case "black-group": {
      const group = cue.groupSize === 2 ? "2 个黑键组" : "3 个黑键组";
      switch (cue.relation) {
        case "left":
          return `按下高亮${group}左边紧挨着的白键`;
        case "middle":
          return "按下高亮 2 个黑键组中间夹着的白键";
        case "inner-1":
          return "按下高亮 3 个黑键组内部夹着的第 1 个白键（从左往右）";
        case "inner-2":
          return "按下高亮 3 个黑键组内部夹着的第 2 个白键（从左往右）";
      }
      throw new Error(
        `keyboard-geography: 黑键 ${cue.groupSize} 组与方位 "${cue.relation}" 不匹配`,
      );
    }
    case "semitone-pair":
      return `高亮的两个白键之间没有黑键——这是一对「天然半音」。按下其中${
        cue.ask === "lower" ? "较低" : "较高"
      }的那个白键`;
    case "note-name":
      return `听声音，在键盘上按下 ${midiToNoteName(midi)}`;
  }
}

/** 答错反馈的规则提示（把教学法口诀落在行内反馈里）；音名快答无提示。 */
export function cueRuleHint(cue: KeyboardGeoCue): string | null {
  switch (cue.kind) {
    case "black-group":
      if (cue.groupSize === 2) {
        return cue.relation === "left"
          ? "2 个黑键组左边的白键是 C"
          : "2 个黑键组中间夹着的白键是 D";
      }
      return cue.relation === "left"
        ? "3 个黑键组左边的白键是 F"
        : "3 个黑键组内部夹着的白键从左到右是 G 和 A";
    case "semitone-pair":
      return cue.ask === "lower"
        ? "中间没有黑键的白键对只有 E-F 和 B-C，较低的是 E 或 B"
        : "中间没有黑键的白键对只有 E-F 和 B-C，较高的是 F 或 C";
    case "note-name":
      return null;
  }
}

/**
 * 题池采样空间：按 pool spec 确定性枚举全部候选题（随机抽取在核心 Round 引擎）。
 * 未知 kind 抛错（manifest 声明完整性，与地标音插件同口径）。
 */
export function enumerateQuestions(spec: KeyboardGeoPoolSpec): KeyboardGeoQuestion[] {
  switch (spec.kind) {
    case "black-group-anchors":
      return blackGroupQuestions(spec.lowestMidi, spec.highestMidi);
    case "semitone-pairs":
      return semitonePairQuestions(spec.lowestMidi, spec.highestMidi);
    case "white-key-names":
      return whiteKeyQuestions(spec.lowestMidi, spec.highestMidi);
    default:
      throw new Error(
        `keyboard-geography: 未知题池种类 "${(spec as { kind: string }).kind}"`,
      );
  }
}

/** 黑键组锚点题：音域内每个完整黑键组 × 各方位白键（C/D 与 F/G/A）。 */
function blackGroupQuestions(lowestMidi: number, highestMidi: number): KeyboardGeoQuestion[] {
  const out: KeyboardGeoQuestion[] = [];
  for (let g = lowestMidi; g <= highestMidi; g++) {
    if (!isBlackKey(g)) continue;
    if (g - 2 >= 0 && isBlackKey(g - 2)) continue; // 非组首（组内黑键相隔 2 个半音）
    // 收集完整组；若组被音域上界截断则跳过（保证「组图案」完整可认）。
    let size = 0;
    while (isBlackKey(g + size * 2)) size++;
    if (size !== 2 && size !== 3) continue;
    if (g + (size - 1) * 2 > highestMidi) continue;
    const relations: readonly BlackGroupRelation[] =
      size === 2 ? ["left", "middle"] : ["left", "inner-1", "inner-2"];
    for (const relation of relations) {
      const cue: KeyboardGeoCue = {
        kind: "black-group",
        groupLowestMidi: g,
        groupSize: size as 2 | 3,
        relation,
      };
      const midi = targetOfCue(cue);
      if (midi < lowestMidi || midi > highestMidi || isBlackKey(midi)) continue;
      out.push({ type: "keyboard-geo", midi, cue });
    }
  }
  return out;
}

/** 天然半音题：音域内每对「中间无黑键」的相邻白键（E-F / B-C）× 问较低/较高。 */
function semitonePairQuestions(lowestMidi: number, highestMidi: number): KeyboardGeoQuestion[] {
  const out: KeyboardGeoQuestion[] = [];
  for (let w = lowestMidi; w < highestMidi; w++) {
    if (isBlackKey(w) || isBlackKey(w + 1)) continue; // 两键皆白且相邻 = 天然半音对
    for (const ask of ["lower", "upper"] as const) {
      const cue: KeyboardGeoCue = { kind: "semitone-pair", lowerMidi: w, ask };
      out.push({ type: "keyboard-geo", midi: targetOfCue(cue), cue });
    }
  }
  return out;
}

/** 音名快答题：音域内全部白键各一题。 */
function whiteKeyQuestions(lowestMidi: number, highestMidi: number): KeyboardGeoQuestion[] {
  const out: KeyboardGeoQuestion[] = [];
  for (let midi = lowestMidi; midi <= highestMidi; midi++) {
    if (isBlackKey(midi)) continue;
    out.push({ type: "keyboard-geo", midi, cue: { kind: "note-name" } });
  }
  return out;
}
