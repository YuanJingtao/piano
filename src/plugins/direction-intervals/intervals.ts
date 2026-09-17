import { isBlackKey } from "@/lib/music/midi";
import { LANDMARK_BY_ID, type Clef, type LandmarkId } from "@/plugins/landmark-notes/landmarks";

/**
 * 方向与音程阅读领域数据（工单 #40，pedagogy 调研 C1/C2/C3）：
 * 全音阶移位（C 大调白键）、音程关系、轮廓模板、谱表可读范围与题池生成。
 *
 * 教学口径「读关系不读名」：题目从地标锚点音出发，按谱面形状（二度挪一格 /
 * 三度隔一格 / 五度线-间-线-间 / 八度同名跨谱表 / 轮廓 = 步进与跳进回填的组合）
 * 走到末音；判定只认末音音高，关系词汇（上二度 / 下五度…）仅用于行内反馈与教程。
 *
 * 单一真源：manifest 题池、judge 反馈、MDX 教程页、训练渲染全部从这里取数。
 * 纯 TypeScript，无 DOM / 浏览器 API 依赖（服务端渲染与 vitest 均可直接 import）。
 */

/** 音程关系 id（二度含同音重复；音程度数按全音阶步数计，不区分大小/纯音程——形状阅读阶段刻意不涉及音程性质）。 */
export type RelationId = "repeat" | "2nd" | "3rd" | "5th" | "octave";

/** 三音轮廓模板 id（上行/下行级进 ×2、三度/五度跳进后回填一步）。 */
export type ContourId =
  | "up-up"
  | "down-down"
  | "up-third-fill"
  | "down-third-fill"
  | "up-fifth-fill"
  | "down-fifth-fill";

/** C 大调白键音级在一个八度内的半音偏移（do re mi fa so la ti）。 */
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/** 全音阶下标：白键按遍历顺序编号（C4 = 60 → 28）；黑键无全音阶位置，直接抛。 */
export function diatonicIndex(midi: number): number {
  if (isBlackKey(midi)) {
    throw new RangeError(`diatonicIndex: 黑键没有全音阶位置，收到 midi ${midi}`);
  }
  const octave = Math.floor(midi / 12) - 1;
  return octave * 7 + WHITE_SEMITONES.indexOf(midi % 12 as (typeof WHITE_SEMITONES)[number]);
}

/** 全音阶下标 → MIDI note number（diatonicIndex 的逆变换）。 */
export function midiFromDiatonicIndex(index: number): number {
  const octave = Math.floor(index / 7);
  const letter = index - octave * 7;
  return (octave + 1) * 12 + WHITE_SEMITONES[letter];
}

/** 全音阶移位：steps > 0 向上、< 0 向下，按白键步进（二度 = 1 步、三度 = 2、五度 = 4、八度 = 7）。 */
export function diatonicShift(midi: number, steps: number): number {
  return midiFromDiatonicIndex(diatonicIndex(midi) + steps);
}

/** 两个白键之间的全音阶步数（正 = 向上）。 */
export function diatonicDistance(fromMidi: number, toMidi: number): number {
  return diatonicIndex(toMidi) - diatonicIndex(fromMidi);
}

/** 音程关系定义：全音阶步数 + 中文教学名。 */
export const RELATIONS: Readonly<Record<RelationId, { steps: number; name: string }>> = {
  repeat: { steps: 0, name: "同音重复" },
  "2nd": { steps: 1, name: "二度" },
  "3rd": { steps: 2, name: "三度" },
  "5th": { steps: 4, name: "五度" },
  octave: { steps: 7, name: "八度" },
};

/** 全音阶步数绝对值 → 度数中文词汇（行内反馈 / 教程页共用）。 */
const SIZE_NAMES: Readonly<Record<number, string>> = {
  0: "同音",
  1: "二度",
  2: "三度",
  3: "四度",
  4: "五度",
  5: "六度",
  6: "七度",
  7: "八度",
};

export type ContourTemplate = {
  id: ContourId;
  /** 教学名（行内反馈 / 教程页轮廓总表用）。 */
  name: string;
  /** 相对锚点音的全音阶步数偏移序列（首项恒为 0；三音轮廓）。 */
  offsets: readonly number[];
};

/**
 * 三音轮廓模板（C3 轮廓阅读）：级进两连（上/下）+ 跳进后回填（三度/五度，上/下）。
 * 「跳进回填」是旋律写作最基础的轮廓词汇——跳出去一步反向填回来，波浪形。
 */
export const CONTOURS: readonly ContourTemplate[] = [
  { id: "up-up", name: "级进上行 ×2", offsets: [0, 1, 2] },
  { id: "down-down", name: "级进下行 ×2", offsets: [0, -1, -2] },
  { id: "up-third-fill", name: "上跳三度 · 回填", offsets: [0, 2, 1] },
  { id: "down-third-fill", name: "下跳三度 · 回填", offsets: [0, -2, -1] },
  { id: "up-fifth-fill", name: "上跳五度 · 回填", offsets: [0, 4, 3] },
  { id: "down-fifth-fill", name: "下跳五度 · 回填", offsets: [0, -4, -3] },
];

export const CONTOUR_BY_ID: ReadonlyMap<ContourId, ContourTemplate> = new Map(
  CONTOURS.map((c) => [c.id, c]),
);

/**
 * 谱表可读范围（初学者友好：加线 ≤2 条），同时保证全部音符落在虚拟钢琴
 * 默认音域 C3–C6（48–84）内可作答：高音谱 A3–G5 / 低音谱 C3–D4。
 * 超出范围的锚点 + 关系组合由 generatePool 静默过滤（manifest 声明的是采样意图，
 * 题池实际内容 = 意图 ∩ 可读范围，seam 2 单测锁定精确结果）。
 */
export const READABLE_RANGE: Readonly<Record<Clef, { min: number; max: number }>> = {
  treble: { min: 57, max: 79 },
  bass: { min: 48, max: 62 },
};

/** 音符是否落在该谱表的可读范围内。 */
export function inReadableRange(clef: Clef, midi: number): boolean {
  const range = READABLE_RANGE[clef];
  return midi >= range.min && midi <= range.max;
}

/** 单步关系描述：上二度 / 下五度 / 八度上 / 八度下 / 同音重复。 */
export function describeMove(fromMidi: number, toMidi: number): string {
  const steps = diatonicDistance(fromMidi, toMidi);
  if (steps === 0) return "同音重复";
  const sizeName = SIZE_NAMES[Math.abs(steps)] ?? `${Math.abs(steps) + 1}度`;
  if (Math.abs(steps) === 7) return steps > 0 ? "八度上" : "八度下";
  return steps > 0 ? `上${sizeName}` : `下${sizeName}`;
}

/**
 * 题目整体关系描述（judge 行内反馈用）：
 * 二音组 = 单步关系（上二度…）；三音轮廓 = 模板教学名（级进上行 ×2…），
 * 模板未命中时逐步列出（防御性兜底，正常题池不会走到）。
 */
export function describeContour(notes: readonly number[]): string {
  if (notes.length < 2) return "";
  if (notes.length === 2) return describeMove(notes[0], notes[1]);
  const base = diatonicIndex(notes[0]);
  const offsets = notes.map((m) => diatonicIndex(m) - base);
  const template = CONTOURS.find(
    (c) => c.offsets.length === offsets.length && c.offsets.every((o, i) => o === offsets[i]),
  );
  if (template) return template.name;
  return notes
    .slice(1)
    .map((m, i) => describeMove(notes[i], m))
    .join("→");
}

/** 题目：锚点地标音出发的旋律组（二音音程对或三音轮廓），末音为作答目标。 */
export type IntervalMelodyQuestion = {
  type: "interval-melody";
  clef: Clef;
  /** 旋律音序列（MIDI note number，音高唯一真源）；首音 = 地标锚点，末音 = 目标。 */
  notes: number[];
};

/** level.pool 的技巧自定义形状：锚点地标 + 音程关系 / 轮廓模板声明。 */
export type IntervalPoolSpec = {
  /** 锚点音（地标音 id）；中央 C 按双谱表展开（与地标音插件同口径）。 */
  anchors: readonly LandmarkId[];
  /** 二音音程对关系（每个关系生成上行 + 下行两题；repeat 生成同音重复一题）。 */
  relations?: readonly RelationId[];
  /** 三音轮廓模板。 */
  contours?: readonly ContourId[];
};

/**
 * 题池生成（samplePool 的实现体）：锚点 × 谱表 × 关系/模板的笛卡尔积，
 * 过滤出谱表可读范围（见 READABLE_RANGE 注释）。确定性顺序（声明顺序遍历），
 * 引用未知 id 抛错（manifest 声明完整性）。
 */
export function generatePool(spec: IntervalPoolSpec): IntervalMelodyQuestion[] {
  const questions: IntervalMelodyQuestion[] = [];
  for (const anchorId of spec.anchors) {
    const anchor = LANDMARK_BY_ID.get(anchorId);
    if (!anchor) {
      throw new Error(`direction-intervals: pool 引用未知地标音 "${anchorId}"`);
    }
    for (const clef of anchor.clefs) {
      for (const relationId of spec.relations ?? []) {
        const relation = RELATIONS[relationId];
        if (!relation) {
          throw new Error(`direction-intervals: pool 引用未知音程关系 "${relationId}"`);
        }
        const candidates: number[][] =
          relation.steps === 0
            ? [[anchor.midi, anchor.midi]]
            : [
                [anchor.midi, diatonicShift(anchor.midi, relation.steps)],
                [anchor.midi, diatonicShift(anchor.midi, -relation.steps)],
              ];
        for (const notes of candidates) {
          if (notes.every((m) => inReadableRange(clef, m))) {
            questions.push({ type: "interval-melody", clef, notes });
          }
        }
      }
      for (const contourId of spec.contours ?? []) {
        const contour = CONTOUR_BY_ID.get(contourId);
        if (!contour) {
          throw new Error(`direction-intervals: pool 引用未知轮廓模板 "${contourId}"`);
        }
        const notes = contour.offsets.map((offset) => diatonicShift(anchor.midi, offset));
        if (notes.every((m) => inReadableRange(clef, m))) {
          questions.push({ type: "interval-melody", clef, notes });
        }
      }
    }
  }
  return questions;
}
