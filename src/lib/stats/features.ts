/**
 * 错题特征提取（#45 弱项统计的 seam：纯函数，可直接单测）。
 *
 * answer_record.question 是题目 JSONB 特征快照（ADR 0006「特征即数据」），
 * 各插件题型的特征形状不同；本模块按题型判别字段把快照映射为统一的
 * 弱项聚合特征项（类别 + 键 + 展示名），供 weakness.ts 做频次聚合。
 *
 * 按题型注册提取规则 = question-stages.tsx 题面组件注册表的同款定式：
 * 中央判别、插件模块只提供纯展示辅助函数（音名 / 音节串 / 轮廓描述 / 音组标签）。
 *
 * 归类口径（每题型一族特征）：
 * - landmark-note / keyboard-geo → 音名（这两技巧教的正是音名定位）；
 * - interval-melody → 音程与轮廓关系，**不归音名**——该技巧的教学立场是
 *   「读关系不读名」（#40），把错答归到目标音名会误导弱项分布；
 * - rhythm-syllable-quiz / rhythm-ear-quiz → 节奏型（Kodály 音节串展示）；
 * - group-* → 功能音组（groupId，#44 落库时预留的聚合特征）；
 * - key-sequence / block-chord → 音型与和弦（教学 label，如「C 大三和弦分解」）。
 *
 * 防御性口径：快照缺字段 / 形状异常 / 未知题型一律返回空特征（聚合层跳过），
 * 统计视图不因脏数据崩溃；该条记录仍计入作答总数（见 weakness.ts）。
 */

import { midiToNoteName } from "@/lib/music/midi";
import { asInteger, asRecord, asString } from "@/lib/persistence/narrow";
import { describeContour } from "@/plugins/direction-intervals/intervals";
import {
  ALL_GROUP_IDS,
  figureLabel,
  FUNCTIONAL_GROUPS,
  type GroupId,
} from "@/plugins/functional-groups";
import { patternSyllables, UNIT_BEATS, type RhythmUnit } from "@/plugins/rhythm-reading";

/** 弱项特征类别；数组顺序 = 统计页展示顺序。 */
export type FeatureCategory = "note" | "interval" | "rhythm" | "group" | "figure";

export const FEATURE_CATEGORIES: readonly { id: FeatureCategory; title: string }[] = [
  { id: "note", title: "音名" },
  { id: "interval", title: "音程与轮廓" },
  { id: "rhythm", title: "节奏型" },
  { id: "group", title: "功能音组" },
  { id: "figure", title: "音型与和弦" },
];

/** 一条特征项：类别内以 key 去重聚合，label 为展示名（可与 key 相同）。 */
export type QuestionFeature = {
  category: FeatureCategory;
  key: string;
  label: string;
};

/** MIDI 有效域收窄（midiToNoteName / describeContour 的前置校验）。 */
function validMidi(v: unknown): number | null {
  const n = asInteger(v);
  return n !== null && n >= 0 && n <= 127 ? n : null;
}

/** MIDI 序列收窄：长度 [min, 8]、逐项有效（旋律组 2–3 音，防御上限 8）。 */
function validMidiList(v: unknown, min: number): number[] | null {
  if (!Array.isArray(v) || v.length < min || v.length > 8) return null;
  const out: number[] = [];
  for (const item of v) {
    const n = validMidi(item);
    if (n === null) return null;
    out.push(n);
  }
  return out;
}

/** 节奏型收窄：非空 RhythmUnit 序列（一小节 ≤ 16 个单位的防御上限）。 */
function validPattern(v: unknown): RhythmUnit[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 16) return null;
  const out: RhythmUnit[] = [];
  for (const item of v) {
    const unit = asString(item);
    if (unit === null || !(unit in UNIT_BEATS)) return null;
    out.push(unit as RhythmUnit);
  }
  return out;
}

/** 题目 JSONB 特征快照 → 弱项特征项（0 或 1 条；脏数据 / 未知题型为空）。 */
export function extractQuestionFeatures(question: unknown): QuestionFeature[] {
  const q = asRecord(question);
  if (!q) return [];
  switch (asString(q["type"])) {
    case "landmark-note":
    case "keyboard-geo": {
      const midi = validMidi(q["midi"]);
      if (midi === null) return [];
      return [{ category: "note", key: String(midi), label: midiToNoteName(midi) }];
    }
    case "interval-melody": {
      const notes = validMidiList(q["notes"], 2);
      if (notes === null) return [];
      const relation = describeContour(notes);
      if (relation === "") return [];
      return [{ category: "interval", key: relation, label: relation }];
    }
    case "rhythm-syllable-quiz":
    case "rhythm-ear-quiz": {
      const pattern = validPattern(q["pattern"]);
      if (pattern === null) return [];
      return [
        { category: "rhythm", key: pattern.join(" "), label: patternSyllables(pattern) },
      ];
    }
    case "group-notation-quiz":
    case "group-ear-quiz":
    case "group-play": {
      const groupId = asString(q["groupId"]);
      if (groupId === null || !(ALL_GROUP_IDS as readonly string[]).includes(groupId)) {
        return [];
      }
      // 展示名用音组的特征唱名序（组身份），不用题面具体排列音型。
      const group = FUNCTIONAL_GROUPS[groupId as GroupId];
      return [{ category: "group", key: groupId, label: figureLabel(group.syllables) }];
    }
    case "key-sequence":
    case "block-chord": {
      const label = asString(q["label"]);
      if (label === null || label.length === 0) return [];
      return [{ category: "figure", key: label, label }];
    }
    default:
      return [];
  }
}
