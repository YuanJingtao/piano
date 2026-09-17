import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  TechniqueManifest,
  TechniquePlugin,
} from "@/domain/types";
import { midiToNoteName } from "@/lib/music/midi";

import {
  ANCHOR_RANGE,
  FULL_RANGE,
  cueRuleHint,
  enumerateQuestions,
  targetOfCue,
  type KeyboardGeoPoolSpec,
  type KeyboardGeoQuestion,
} from "./geography";

export type { KeyboardGeoCue, KeyboardGeoPoolSpec, KeyboardGeoQuestion } from "./geography";

/**
 * 键盘地理锚点技巧插件（主线第一技巧，工单 #39）。
 *
 * 题型「键盘找键」（keyboard-geo）：不看谱——题目以键盘图/音名文字为锚（cue），
 * 作答 = 在键盘上按出目标白键。内容 = 黑键 2/3 组定位 C/D/F/G/A（教学法 A1）
 * + 天然半音 E-F / B-C 定位 E/B/F/C（A2）+ 全键盘音名快答。
 * 关卡划分与考核口径源自 #4 决议：L1/L2 弹奏类（8 题 ≥85%）、L3 快答类（12 题 ≥90% 中位 ≤3s）。
 *
 * 纯逻辑两件（samplePool / judge）在本文件（seam 2 单测覆盖）；
 * 浏览器两件落为 ./stage.tsx 的 React 题面组件
 * （按题型注册于 src/components/training/question-stages.tsx，#38 定形）。
 */

/** 弹奏关卡统一参数（ADR 0001）：8 题 / ≥85%，无中位响应约束；无限时（限时仅节奏关卡）。 */
const PLAY_LEVEL = {
  questionCount: 8,
  pass: { minAccuracy: 0.85 },
} as const;

/** 快答关卡统一参数（ADR 0001）：12 题 / ≥90% / 中位 ≤3s。 */
const QUICK_ANSWER = {
  questionCount: 12,
  pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
} as const;

export const keyboardGeographyManifest: TechniqueManifest = {
  id: "keyboard-geography",
  title: "键盘地理锚点",
  track: "main",
  /** 主线第一站：零乐理门槛（pedagogy「第 0 课」），无前置。 */
  prerequisites: [],
  levels: [
    {
      id: "L1",
      title: "黑键组与相邻白键",
      ...PLAY_LEVEL,
      pool: { kind: "black-group-anchors", ...ANCHOR_RANGE } satisfies KeyboardGeoPoolSpec,
    },
    {
      id: "L2",
      title: "天然半音 E-F / B-C",
      ...PLAY_LEVEL,
      pool: { kind: "semitone-pairs", ...ANCHOR_RANGE } satisfies KeyboardGeoPoolSpec,
    },
    {
      id: "L3",
      title: "全键盘音名快答",
      ...QUICK_ANSWER,
      pool: { kind: "white-key-names", ...FULL_RANGE } satisfies KeyboardGeoPoolSpec,
    },
  ],
};

export const keyboardGeographyPlugin: TechniquePlugin = {
  manifest: keyboardGeographyManifest,

  samplePool(level: LevelDef): Question[] {
    const spec = level.pool as KeyboardGeoPoolSpec;
    if (typeof spec?.kind !== "string") {
      throw new Error("keyboard-geography: level.pool 缺少题池种类声明");
    }
    const questions = enumerateQuestions(spec);
    // 锚点题自检：cue 推导目标必须与题目 midi 一致（manifest 声明完整性）。
    for (const q of questions) {
      if (q.cue.kind !== "note-name" && targetOfCue(q.cue) !== q.midi) {
        throw new Error(`keyboard-geography: cue 与目标键不一致（midi ${q.midi}）`);
      }
    }
    return questions;
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (q.type !== "keyboard-geo") {
      throw new Error(`keyboard-geography: unexpected question type "${q.type}"`);
    }
    const question = q as KeyboardGeoQuestion;
    if (a.kind !== "midi") return { ok: false, feedback: "✗ 非琴键作答" };
    const target = midiToNoteName(question.midi);
    if (a.midi === question.midi) {
      return { ok: true, feedback: `✓ ${target}` };
    }
    const hint = cueRuleHint(question.cue);
    return {
      ok: false,
      feedback: `✗ 你弹了 ${midiToNoteName(a.midi)}，正确是 ${target}${hint ? ` —— ${hint}` : ""}`,
    };
  },
};

export default keyboardGeographyPlugin;
