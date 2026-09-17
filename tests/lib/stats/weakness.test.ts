/**
 * seam：弱项聚合纯函数（#45）。
 * 覆盖频次口径（答错 / 出现）、条目与类别过滤、排序确定性、脏数据总数口径。
 */

import { describe, expect, it } from "vitest";

import {
  aggregateWeaknesses,
  EMPTY_WEAKNESS_STATS,
  type WeaknessInput,
} from "@/lib/stats/weakness";

/** 便捷构造：音名题（landmark-note 形状）作答记录。 */
function note(midi: number, ok: boolean): WeaknessInput {
  return { question: { type: "landmark-note", midi, clef: "treble" }, ok };
}

function rhythm(pattern: readonly string[], ok: boolean): WeaknessInput {
  return {
    question: { type: "rhythm-ear-quiz", pattern, options: [], correctIndex: 0 },
    ok,
  };
}

function group(groupId: string, ok: boolean): WeaknessInput {
  return { question: { type: "group-notation-quiz", groupId }, ok };
}

describe("aggregateWeaknesses：空输入", () => {
  it("零记录 → 空统计（统计页空态的数据形状）", () => {
    expect(aggregateWeaknesses([])).toEqual({ ...EMPTY_WEAKNESS_STATS, categories: [] });
    expect(aggregateWeaknesses([]).totalAnswers).toBe(0);
  });

  it("全部答对 → 有总数但无任何弱项类别（「还没有答错的题」态）", () => {
    const stats = aggregateWeaknesses([note(60, true), note(62, true)]);
    expect(stats.totalAnswers).toBe(2);
    expect(stats.totalWrong).toBe(0);
    expect(stats.categories).toEqual([]);
  });
});

describe("aggregateWeaknesses：频次口径", () => {
  it("答错频次 / 出现总次数分开计（答对也计入出现）", () => {
    const stats = aggregateWeaknesses([note(60, false), note(60, true), note(60, false)]);
    expect(stats).toMatchObject({ totalAnswers: 3, totalWrong: 2 });
    expect(stats.categories).toHaveLength(1);
    expect(stats.categories[0].entries).toEqual([
      { key: "60", label: "C4", wrongCount: 2, totalCount: 3 },
    ]);
  });

  it("跨题型同特征聚合：看谱选音节与听音选谱面的同节奏型合并计数", () => {
    const stats = aggregateWeaknesses([
      {
        question: { type: "rhythm-syllable-quiz", pattern: ["q", "tt", "q", "q"] },
        ok: false,
      },
      rhythm(["q", "tt", "q", "q"], true),
      rhythm(["q", "tt", "q", "q"], false),
    ]);
    expect(stats.categories[0]).toMatchObject({ category: "rhythm", title: "节奏型" });
    expect(stats.categories[0].entries).toEqual([
      { key: "q tt q q", label: "ta ti-ti ta ta", wrongCount: 2, totalCount: 3 },
    ]);
  });

  it("多类别并存：类别顺序固定（音名 → 节奏 → 音组），与记录顺序无关", () => {
    const stats = aggregateWeaknesses([
      group("do-mi-so", false),
      rhythm(["h", "h"], false),
      note(60, false),
    ]);
    expect(stats.categories.map((c) => c.category)).toEqual(["note", "rhythm", "group"]);
    expect(stats.categories.map((c) => c.title)).toEqual(["音名", "节奏型", "功能音组"]);
  });

  it("未知题型 / 脏快照：提不出特征但计入作答总数，不进任何类别", () => {
    const stats = aggregateWeaknesses([
      { question: { type: "note-choice", midi: 60 }, ok: false }, // 测试 fixture 形状
      { question: { type: "landmark-note" }, ok: false }, // 缺 midi 脏数据
      note(60, false),
    ]);
    expect(stats.totalAnswers).toBe(3);
    expect(stats.totalWrong).toBe(3);
    expect(stats.categories).toHaveLength(1); // 仅音名类
    expect(stats.categories[0].entries).toEqual([
      { key: "60", label: "C4", wrongCount: 1, totalCount: 1 },
    ]);
  });
});

describe("aggregateWeaknesses：排序（并列确定性）", () => {
  it("答错频次降序为主键", () => {
    const stats = aggregateWeaknesses([
      note(60, false),
      note(62, false),
      note(62, false),
      note(64, false),
      note(64, false),
      note(64, false),
    ]);
    expect(stats.categories[0].entries.map((e) => e.label)).toEqual(["E4", "D4", "C4"]);
  });

  it("答错并列时出现次数降序（更常出现的排前）", () => {
    const stats = aggregateWeaknesses([
      note(60, false), // C4：错 1 / 出现 1
      note(62, false), // D4：错 1 / 出现 2
      note(62, true),
    ]);
    expect(stats.categories[0].entries.map((e) => e.key)).toEqual(["62", "60"]);
  });

  it("答错与出现都并列时按 key 升序（结果稳定可断言）", () => {
    const stats = aggregateWeaknesses([group("la-so-mi", false), group("do-mi-so", false)]);
    expect(stats.categories[0].entries.map((e) => e.key)).toEqual(["do-mi-so", "la-so-mi"]);
  });
});
