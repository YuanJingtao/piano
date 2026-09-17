import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  TechniqueManifest,
  TechniquePlugin,
} from "@/domain/types";
import { midiToNoteName } from "@/lib/music/midi";
import type { LandmarkId } from "@/plugins/landmark-notes/landmarks";

import {
  describeContour,
  generatePool,
  type IntervalMelodyQuestion,
  type IntervalPoolSpec,
} from "./intervals";

/**
 * 方向与音程阅读技巧插件（P3 主线第三站，工单 #40）。
 *
 * 题型「旋律组末音」（interval-melody）：题目 = 从地标锚点音出发的二音音程对
 * 或三音轮廓，作答 = 在键盘上弹出末音。读关系不读名（pedagogy C1/C2/C3）——
 * 目标音全部避开地标音之外的「背名」路径，靠谱面形状（挪格/隔格/跨八度）+
 * 耳朵（出题即发声按序播旋律）从锚点推算。核心引擎零改动（ADR 0007）。
 *
 * 关卡按教学子步骤递进：二度（步进/重复/方向）→ 三度/五度形状 → 八度与混合 → 简单轮廓。
 *
 * 纯逻辑两件（samplePool / judge）在本文件（seam 2 单测覆盖）；
 * 浏览器两件落为 ./stage.tsx 的 React 题面组件
 * （按题型注册于 src/components/training/question-stages.tsx，#38 定形）。
 */

/** 五个地标音全部作为锚点（中央 C 双谱表展开）。 */
const ALL_ANCHORS: readonly LandmarkId[] = [
  "middle-c",
  "treble-g",
  "bass-f",
  "treble-c",
  "bass-c",
];

/** 快答关卡统一参数（ADR 0001）：12 题 / ≥90% / 中位 ≤3s；本技巧无限时模式（限时仅节奏关卡）。 */
const QUICK_ANSWER = {
  questionCount: 12,
  pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
} as const;

export const directionIntervalsManifest: TechniqueManifest = {
  id: "direction-intervals",
  title: "方向与音程阅读",
  track: "main",
  /** 主线线性解锁：地标音毕业后开放（设计文档 #31 学习路径）。 */
  prerequisites: ["landmark-notes"],
  levels: [
    {
      id: "L1",
      title: "二度步进 / 重复 / 方向",
      ...QUICK_ANSWER,
      pool: { anchors: ALL_ANCHORS, relations: ["2nd", "repeat"] } satisfies IntervalPoolSpec,
    },
    {
      id: "L2",
      title: "三度与五度形状",
      ...QUICK_ANSWER,
      pool: { anchors: ALL_ANCHORS, relations: ["3rd", "5th"] } satisfies IntervalPoolSpec,
    },
    {
      id: "L3",
      title: "八度与形状混合",
      ...QUICK_ANSWER,
      pool: {
        anchors: ALL_ANCHORS,
        relations: ["octave", "3rd", "5th"],
      } satisfies IntervalPoolSpec,
    },
    {
      id: "L4",
      title: "简单轮廓",
      ...QUICK_ANSWER,
      pool: {
        anchors: ALL_ANCHORS,
        contours: [
          "up-up",
          "down-down",
          "up-third-fill",
          "down-third-fill",
          "up-fifth-fill",
          "down-fifth-fill",
        ],
      } satisfies IntervalPoolSpec,
    },
  ],
};

export const directionIntervalsPlugin: TechniquePlugin = {
  manifest: directionIntervalsManifest,

  samplePool(level: LevelDef): Question[] {
    return generatePool(level.pool as IntervalPoolSpec);
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (q.type !== "interval-melody") {
      throw new Error(`direction-intervals: unexpected question type "${q.type}"`);
    }
    const question = q as IntervalMelodyQuestion;
    if (a.kind !== "midi") return { ok: false, feedback: "✗ 非琴键作答" };
    const target = question.notes[question.notes.length - 1];
    const relation = describeContour(question.notes);
    if (a.midi === target) {
      return { ok: true, feedback: `✓ ${midiToNoteName(target)}（${relation}）` };
    }
    return {
      ok: false,
      feedback: `✗ 你弹了 ${midiToNoteName(a.midi)}，正确是 ${midiToNoteName(target)}（${relation}）`,
    };
  },
};

export type { IntervalMelodyQuestion, IntervalPoolSpec };
export default directionIntervalsPlugin;
