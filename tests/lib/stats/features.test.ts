/**
 * seam：错题特征提取纯函数（#45）。
 * 覆盖 10 种产品题型的特征归类 + 脏数据 / 未知题型防御口径。
 */

import { describe, expect, it } from "vitest";

import { extractQuestionFeatures, FEATURE_CATEGORIES } from "@/lib/stats/features";

describe("extractQuestionFeatures：题型 → 弱项特征归类", () => {
  it("landmark-note → 音名（midi 真源，key = midi 字符串，label = 科学音高记名）", () => {
    expect(extractQuestionFeatures({ type: "landmark-note", midi: 60, clef: "treble" })).toEqual([
      { category: "note", key: "60", label: "C4" },
    ]);
    expect(extractQuestionFeatures({ type: "landmark-note", midi: 61, clef: "bass" })).toEqual([
      { category: "note", key: "61", label: "C#4" },
    ]);
  });

  it("keyboard-geo → 音名（cue 不参与特征，目标 midi 即判定真源同口径）", () => {
    expect(
      extractQuestionFeatures({
        type: "keyboard-geo",
        midi: 71,
        cue: { kind: "black-group", ask: "lower" },
      }),
    ).toEqual([{ category: "note", key: "71", label: "B4" }]);
    expect(extractQuestionFeatures({ type: "keyboard-geo", midi: 72, cue: { kind: "note-name" } }))
      .toEqual([{ category: "note", key: "72", label: "C5" }]);
  });

  it("interval-melody → 音程与轮廓关系（不归音名：读关系不读名，#40 口径）", () => {
    // 二音组：单步关系描述
    expect(extractQuestionFeatures({ type: "interval-melody", clef: "treble", notes: [60, 62] }))
      .toEqual([{ category: "interval", key: "上二度", label: "上二度" }]);
    expect(extractQuestionFeatures({ type: "interval-melody", clef: "treble", notes: [71, 59] }))
      .toEqual([{ category: "interval", key: "八度下", label: "八度下" }]);
    // 三音轮廓：模板教学名
    expect(
      extractQuestionFeatures({ type: "interval-melody", clef: "treble", notes: [60, 62, 64] }),
    ).toEqual([{ category: "interval", key: "级进上行 ×2", label: "级进上行 ×2" }]);
    expect(
      extractQuestionFeatures({ type: "interval-melody", clef: "treble", notes: [60, 64, 62] }),
    ).toEqual([{ category: "interval", key: "上跳三度 · 回填", label: "上跳三度 · 回填" }]);
  });

  it("节奏两题型 → 节奏型（key = 单位序列，label = Kodály 音节串）", () => {
    const expected = [{ category: "rhythm", key: "q tt q q", label: "ta ti-ti ta ta" }];
    expect(
      extractQuestionFeatures({
        type: "rhythm-syllable-quiz",
        pattern: ["q", "tt", "q", "q"],
        options: ["ta ti-ti ta ta", "x", "y", "z"],
        correctIndex: 0,
      }),
    ).toEqual(expected);
    expect(
      extractQuestionFeatures({
        type: "rhythm-ear-quiz",
        pattern: ["q", "tt", "q", "q"],
        options: [],
        correctIndex: 0,
      }),
    ).toEqual(expected);
  });

  it("同节奏型跨题型聚合到同一条目（key 与题型无关）", () => {
    const a = extractQuestionFeatures({ type: "rhythm-syllable-quiz", pattern: ["h", "h"] });
    const b = extractQuestionFeatures({ type: "rhythm-ear-quiz", pattern: ["h", "h"] });
    expect(a).toEqual(b);
    expect(a[0]).toEqual({ category: "rhythm", key: "h h", label: "ta-a ta-a" });
  });

  it("功能音组三题型 → groupId 特征（#44 预留口径），label = 组特征唱名序", () => {
    const expected = [{ category: "group", key: "do-mi-so", label: "1-3-5（do-mi-so）" }];
    for (const type of ["group-notation-quiz", "group-ear-quiz", "group-play"]) {
      expect(
        extractQuestionFeatures({
          type,
          groupId: "do-mi-so",
          syllables: ["so", "do", "mi"], // 题面排列音型不影响组身份特征
          pitches: [67, 60, 64],
        }),
      ).toEqual(expected);
    }
    expect(extractQuestionFeatures({ type: "group-play", groupId: "la-do-mi", label: "x" }))
      .toEqual([{ category: "group", key: "la-do-mi", label: "6-1-3（la-do-mi）" }]);
  });

  it("五指位置两题型 → 教学 label 特征（音型与和弦）", () => {
    expect(
      extractQuestionFeatures({ type: "key-sequence", midis: [60, 62, 64], label: "C 位置级进" }),
    ).toEqual([{ category: "figure", key: "C 位置级进", label: "C 位置级进" }]);
    expect(
      extractQuestionFeatures({ type: "block-chord", midis: [60, 64, 67], label: "C 大三和弦" }),
    ).toEqual([{ category: "figure", key: "C 大三和弦", label: "C 大三和弦" }]);
    expect(
      extractQuestionFeatures({ type: "key-sequence", midis: [60, 64, 67, 64], label: "C 大三和弦分解" }),
    ).toEqual([{ category: "figure", key: "C 大三和弦分解", label: "C 大三和弦分解" }]);
  });

  it("类别固定顺序 = 统计页展示顺序（音名 → 音程 → 节奏 → 音组 → 音型）", () => {
    expect(FEATURE_CATEGORIES.map((c) => c.id)).toEqual([
      "note",
      "interval",
      "rhythm",
      "group",
      "figure",
    ]);
  });
});

describe("extractQuestionFeatures：脏数据 / 未知题型防御（返回空特征，不抛异常）", () => {
  it("非对象 / null / 缺题型", () => {
    expect(extractQuestionFeatures(null)).toEqual([]);
    expect(extractQuestionFeatures("nope")).toEqual([]);
    expect(extractQuestionFeatures([1, 2])).toEqual([]);
    expect(extractQuestionFeatures({ midi: 60 })).toEqual([]);
  });

  it("未知题型（含测试 fixture 的 note-choice 与未来新题型）", () => {
    expect(extractQuestionFeatures({ type: "note-choice", midi: 60 })).toEqual([]);
    expect(extractQuestionFeatures({ type: "future-type", whatever: true })).toEqual([]);
  });

  it("音名类：midi 缺失 / 非整数 / 越界", () => {
    expect(extractQuestionFeatures({ type: "landmark-note", clef: "treble" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "landmark-note", midi: "60" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "keyboard-geo", midi: 60.5 })).toEqual([]);
    expect(extractQuestionFeatures({ type: "keyboard-geo", midi: 128 })).toEqual([]);
    expect(extractQuestionFeatures({ type: "keyboard-geo", midi: -1 })).toEqual([]);
  });

  it("音程类：notes 缺失 / 单音 / 含非法项", () => {
    expect(extractQuestionFeatures({ type: "interval-melody" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "interval-melody", notes: [60] })).toEqual([]);
    expect(extractQuestionFeatures({ type: "interval-melody", notes: [60, "62"] })).toEqual([]);
    expect(extractQuestionFeatures({ type: "interval-melody", notes: "60,62" })).toEqual([]);
  });

  it("节奏类：pattern 缺失 / 空 / 含未知单位", () => {
    expect(extractQuestionFeatures({ type: "rhythm-syllable-quiz" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "rhythm-ear-quiz", pattern: [] })).toEqual([]);
    expect(extractQuestionFeatures({ type: "rhythm-ear-quiz", pattern: ["q", "x"] })).toEqual([]);
    expect(extractQuestionFeatures({ type: "rhythm-ear-quiz", pattern: "q q" })).toEqual([]);
  });

  it("音组类：groupId 缺失 / 不在三组清单", () => {
    expect(extractQuestionFeatures({ type: "group-play" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "group-play", groupId: "re-fa-la" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "group-ear-quiz", groupId: 42 })).toEqual([]);
  });

  it("音型类：label 缺失 / 空串 / 非字符串", () => {
    expect(extractQuestionFeatures({ type: "key-sequence", midis: [60] })).toEqual([]);
    expect(extractQuestionFeatures({ type: "block-chord", label: "" })).toEqual([]);
    expect(extractQuestionFeatures({ type: "block-chord", label: 7 })).toEqual([]);
  });
});
