/**
 * 弱项聚合（#45，纯函数 seam）：作答记录 → 各类别错题频次分布。
 *
 * 口径：
 * - 查询时计算、不落库（ADR 0006/0007 派生查询层；特征即数据，无 schema 变更）；
 * - 弱项条目 = 至少答错 1 次的特征（wrongCount ≥ 1），按答错频次降序、
 *   出现次数降序、键升序（并列确定性）；
 * - totalCount 为该特征出现总次数（作答即计，含答对），供「答错 N 次 / 出现 M 次」
 *   的诚实展示——只答错频次会误导（出现 50 次错 10 次 ≠ 出现 2 次错 5 次）；
 * - totalAnswers / totalWrong 按记录数计（未知题型 / 脏快照提不出特征也计入总数，
 *   但不进任何类别）；
 * - 只读展示，不做任何自动调度（ADR 0004：复习节奏由用户掌控）。
 */

import {
  extractQuestionFeatures,
  FEATURE_CATEGORIES,
  type FeatureCategory,
} from "./features";

/** 单个特征的弱项条目。 */
export type WeaknessEntry = {
  key: string;
  label: string;
  /** 答错次数（排序主键）。 */
  wrongCount: number;
  /** 出现总次数（含答对；展示上下文）。 */
  totalCount: number;
};

/** 单个类别的弱项分布（entries 非空才出现在结果里）。 */
export type WeaknessCategoryStats = {
  category: FeatureCategory;
  title: string;
  entries: WeaknessEntry[];
};

/** 弱项统计全量结果。 */
export type WeaknessStats = {
  /** 作答记录总数（全部结算轮的全部题目）。 */
  totalAnswers: number;
  /** 答错记录总数（含超时记错，限时模式口径 ADR 0004）。 */
  totalWrong: number;
  /** 有弱项条目的类别，按 FEATURE_CATEGORIES 固定顺序。 */
  categories: WeaknessCategoryStats[];
};

/** 空结果（无作答数据 / DB 不可用降级共用）。 */
export const EMPTY_WEAKNESS_STATS: WeaknessStats = {
  totalAnswers: 0,
  totalWrong: 0,
  categories: [],
};

/** 聚合输入：answer_record 的最小视图（题目快照 + 对错）。 */
export type WeaknessInput = {
  question: unknown;
  ok: boolean;
};

type Counter = { label: string; wrongCount: number; totalCount: number };

export function aggregateWeaknesses(records: readonly WeaknessInput[]): WeaknessStats {
  const byCategory = new Map<FeatureCategory, Map<string, Counter>>();
  let totalWrong = 0;

  for (const record of records) {
    if (!record.ok) totalWrong += 1;
    for (const feature of extractQuestionFeatures(record.question)) {
      let keys = byCategory.get(feature.category);
      if (!keys) {
        keys = new Map();
        byCategory.set(feature.category, keys);
      }
      const counter = keys.get(feature.key) ?? {
        label: feature.label,
        wrongCount: 0,
        totalCount: 0,
      };
      counter.totalCount += 1;
      if (!record.ok) counter.wrongCount += 1;
      keys.set(feature.key, counter);
    }
  }

  const categories: WeaknessCategoryStats[] = [];
  for (const { id, title } of FEATURE_CATEGORIES) {
    const keys = byCategory.get(id);
    if (!keys) continue;
    const entries = [...keys.entries()]
      .filter(([, c]) => c.wrongCount >= 1)
      .map(([key, c]) => ({ key, label: c.label, wrongCount: c.wrongCount, totalCount: c.totalCount }))
      .sort(
        (a, b) =>
          b.wrongCount - a.wrongCount ||
          b.totalCount - a.totalCount ||
          a.key.localeCompare(b.key),
      );
    if (entries.length > 0) categories.push({ category: id, title, entries });
  }

  return { totalAnswers: records.length, totalWrong, categories };
}
