import { describe, expect, it } from "vitest";
import "@/plugins"; // 触发生产静态注册（ADR 0007：注册表一行）
import { Round } from "@/domain/round";
import { getTechnique, listTechniques } from "@/domain/registry";
import type { AnswerEvent, LevelDef, Question } from "@/domain/types";
import { deriveCourseTree } from "@/lib/persistence/course-tree";
import {
  ALL_GROUP_IDS,
  FIGURE_ORDERS,
  FUNCTIONAL_GROUPS,
  OPTION_LETTERS,
  SYLLABLE_DIGIT,
  enumerateFigures,
  figureLabel,
  jianpuOf,
  noteNames,
  syllableName,
  type GroupEarQuizQuestion,
  type GroupNotationQuizQuestion,
  type GroupPlayQuestion,
} from "@/plugins/functional-groups";
import { FakeClock, hasAdjacentDuplicates } from "../domain/helpers";

/**
 * seam 2：首调功能音组插件纯逻辑两件（samplePool / judge）+ 生产注册链路
 * + 支线解锁派生（地标音毕业 → 支线开放，工单 #44）。
 *
 * 三种题型：
 * - group-notation-quiz（看谱选唱名，choice 变体）：L1–L4 快答口径；
 * - group-ear-quiz（听音选谱面，choice 变体）：L1–L4 快答口径；
 * - group-play（音组弹奏，keys 变体、严格有序判定）：L5 弹奏口径。
 */

function asNotation(q: Question): GroupNotationQuizQuestion {
  if (q.type !== "group-notation-quiz" || !Array.isArray(q.pitches)) {
    throw new Error(`unexpected group-notation-quiz question: ${JSON.stringify(q)}`);
  }
  return q as GroupNotationQuizQuestion;
}

function asEar(q: Question): GroupEarQuizQuestion {
  if (q.type !== "group-ear-quiz" || !Array.isArray(q.pitches)) {
    throw new Error(`unexpected group-ear-quiz question: ${JSON.stringify(q)}`);
  }
  return q as GroupEarQuizQuestion;
}

function asPlay(q: Question): GroupPlayQuestion {
  if (q.type !== "group-play" || !Array.isArray(q.pitches) || !q.label) {
    throw new Error(`unexpected group-play question: ${JSON.stringify(q)}`);
  }
  return q as GroupPlayQuestion;
}

function choiceAnswer(choiceId: string): AnswerEvent {
  return { kind: "choice", choiceId, timestamp: 0 };
}

function keysAnswer(midis: readonly number[]): AnswerEvent {
  return { kind: "keys", midis, timestamp: 0 };
}

const plugin = () => getTechnique("functional-groups");
const levelOf = (id: string): LevelDef => plugin().manifest.levels.find((l) => l.id === id)!;
const poolOf = (levelId: string) => plugin().samplePool(levelOf(levelId));

describe("功能音组插件 × 生产注册表", () => {
  it("import '@/plugins' 后可按 id 取到；注册在主线五站之后（支线区独立呈现）", () => {
    expect(plugin().manifest.id).toBe("functional-groups");
    const ids = listTechniques().map((p) => p.manifest.id);
    expect(ids).toContain("functional-groups");
    expect(ids.indexOf("functional-groups")).toBeGreaterThan(ids.indexOf("five-finger-triads"));
  });

  it("manifest：首版唯一支线、前置为地标音系统（毕业即解锁，#4 决议学习路径）", () => {
    const { manifest } = plugin();
    expect(manifest.track).toBe("side");
    expect(manifest.title).toBe("首调功能音组");
    expect(manifest.prerequisites).toEqual(["landmark-notes"]);
    expect(manifest.levels.map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4", "L5"]);
  });

  it("关卡口径：L1–L4 快答（12 题 ≥90% 中位 ≤3s）、L5 弹奏（8 题 ≥85%）；全部无限时", () => {
    for (const level of plugin().manifest.levels) {
      expect(level.timeLimitMs, level.id).toBeUndefined(); // 限时模式仅节奏关卡（ADR 0003）
      if (level.id === "L5") {
        expect(level.questionCount).toBe(8);
        expect(level.pass).toEqual({ minAccuracy: 0.85 });
        expect(level.answerMode).toBeUndefined(); // 省略 = 键盘弹奏作答
      } else {
        expect(level.questionCount).toBe(12);
        expect(level.pass).toEqual({ minAccuracy: 0.9, maxMedianResponseMs: 3000 });
        expect(level.answerMode).toBe("choice"); // 快答 × 选择题组合（#44 契约附加）
      }
    }
  });
});

describe("教学常量：三组功能音组与简谱映射", () => {
  it("三组固定音高：do-mi-so=C4E4G4、la-so-mi=A4G4E4、la-do-mi=A3C4E4（a 小调主和弦）", () => {
    expect(FUNCTIONAL_GROUPS["do-mi-so"].pitchOf).toEqual({ do: 60, mi: 64, so: 67 });
    expect(FUNCTIONAL_GROUPS["la-so-mi"].pitchOf).toEqual({ la: 69, so: 67, mi: 64 });
    expect(FUNCTIONAL_GROUPS["la-do-mi"].pitchOf).toEqual({ la: 57, do: 60, mi: 64 });
    expect(FUNCTIONAL_GROUPS["do-mi-so"].keyContext).toBe("C 大调");
    expect(FUNCTIONAL_GROUPS["la-do-mi"].keyContext).toBe("a 小调");
  });

  it("简谱数字映射（1=do 迁移桥，pedagogy D5）与唱名拼写（so 非 sol）", () => {
    expect(SYLLABLE_DIGIT).toEqual({ do: 1, re: 2, mi: 3, fa: 4, so: 5, la: 6, ti: 7 });
    expect(jianpuOf(["la", "so", "mi"])).toBe("6-5-3");
    expect(syllableName(["la", "do", "mi"])).toBe("la-do-mi");
    expect(figureLabel(["do", "mi", "so"])).toBe("1-3-5（do-mi-so）");
    expect(noteNames([57, 60, 64])).toBe("A3-C4-E4");
  });

  it("enumerateFigures：每组 6 个全排列、组名序居首，确定性枚举", () => {
    expect(FIGURE_ORDERS).toHaveLength(6);
    const figures = enumerateFigures(["do-mi-so"]);
    expect(figures).toHaveLength(6);
    expect(figures[0]).toEqual({
      groupId: "do-mi-so",
      syllables: ["do", "mi", "so"],
      pitches: [60, 64, 67],
    });
    expect(figures.map((f) => syllableName(f.syllables))).toEqual([
      "do-mi-so",
      "do-so-mi",
      "mi-do-so",
      "mi-so-do",
      "so-do-mi",
      "so-mi-do",
    ]);
    // 确定性：两次枚举深比较一致（错题池 questionKey 匹配的前提）
    expect(enumerateFigures(ALL_GROUP_IDS)).toEqual(enumerateFigures(ALL_GROUP_IDS));
  });

  it("enumerateFigures：多组按组序拼接（18 个音型）；空列表抛错", () => {
    expect(enumerateFigures(ALL_GROUP_IDS)).toHaveLength(18);
    expect(() => enumerateFigures([])).toThrow(/不得为空/);
  });
});

describe("samplePool：题池采样空间符合 manifest 声明", () => {
  it("识别关 = 音型 × 两题型（L1–L3 各 12 题、L4 混合 36 题）；弹奏关 L5 = 18 题", () => {
    const expected: Record<string, number> = { L1: 12, L2: 12, L3: 12, L4: 36, L5: 18 };
    for (const level of plugin().manifest.levels) {
      expect(poolOf(level.id), level.id).toHaveLength(expected[level.id]!);
    }
    for (const levelId of ["L1", "L2", "L3", "L4"]) {
      const notation = poolOf(levelId).filter((q) => q.type === "group-notation-quiz");
      const ear = poolOf(levelId).filter((q) => q.type === "group-ear-quiz");
      expect(notation.length, levelId).toBe(ear.length);
      // 每个音型两题型各一题，且音型集合一致
      const notationKeys = new Set(notation.map((q) => JSON.stringify(asNotation(q).pitches)));
      const earKeys = new Set(ear.map((q) => JSON.stringify(asEar(q).pitches)));
      expect(notationKeys.size).toBe(notation.length);
      expect(earKeys).toEqual(notationKeys);
    }
    expect(poolOf("L5").every((q) => q.type === "group-play")).toBe(true);
  });

  it("L1–L3 题目全部落在声明的音组内：音高 = 该组三音的排列", () => {
    const byLevel: Record<string, string> = {
      L1: "do-mi-so",
      L2: "la-so-mi",
      L3: "la-do-mi",
    };
    for (const [levelId, groupId] of Object.entries(byLevel)) {
      const group = FUNCTIONAL_GROUPS[groupId as keyof typeof FUNCTIONAL_GROUPS];
      const pitchSet = new Set(Object.values(group.pitchOf));
      for (const q of poolOf(levelId)) {
        const pitches =
          q.type === "group-play" ? asPlay(q).pitches : (q as GroupNotationQuizQuestion).pitches;
        expect((q as GroupNotationQuizQuestion).groupId, levelId).toBe(groupId);
        expect(pitches).toHaveLength(3);
        for (const midi of pitches) expect(pitchSet.has(midi), `${levelId} ${midi}`).toBe(true);
        expect(new Set(pitches).size).toBe(3); // 排列无重音
      }
    }
  });

  it("L1 识别题池 = do-mi-so 六个排列的精确枚举序（组名序居首）", () => {
    const notation = poolOf("L1").filter((q) => q.type === "group-notation-quiz").map(asNotation);
    expect(notation.map((q) => [...q.pitches])).toEqual([
      [60, 64, 67],
      [60, 67, 64],
      [64, 60, 67],
      [64, 67, 60],
      [67, 60, 64],
      [67, 64, 60],
    ]);
    expect(notation.map((q) => q.options[q.correctIndex])).toEqual([
      "1-3-5（do-mi-so）",
      "1-5-3（do-so-mi）",
      "3-1-5（mi-do-so）",
      "3-5-1（mi-so-do）",
      "5-1-3（so-do-mi）",
      "5-3-1（so-mi-do）",
    ]);
  });

  it("L3 识别题池 = la-do-mi 六个排列（a 小调音区：A3 下加二线起）", () => {
    const notation = poolOf("L3").filter((q) => q.type === "group-notation-quiz").map(asNotation);
    expect(notation.map((q) => [...q.pitches])).toEqual([
      [57, 60, 64],
      [57, 64, 60],
      [60, 57, 64],
      [60, 64, 57],
      [64, 57, 60],
      [64, 60, 57],
    ]);
  });

  it("看谱选唱名：正确项在 correctIndex 位、四选项互异且为本关合法标签；位置随题轮换", () => {
    for (const levelId of ["L1", "L2", "L3", "L4"]) {
      const quizzes = poolOf(levelId).filter((q) => q.type === "group-notation-quiz").map(asNotation);
      const legal = new Set(quizzes.map((q) => q.options[q.correctIndex]!));
      for (const quiz of quizzes) {
        expect(quiz.options, levelId).toHaveLength(4);
        expect(quiz.options[quiz.correctIndex]).toBe(figureLabel(quiz.syllables));
        expect(new Set(quiz.options).size, levelId).toBe(4);
        for (const option of quiz.options) expect(legal.has(option), option).toBe(true);
      }
      expect(new Set(quizzes.map((q) => q.correctIndex)).size).toBe(4);
    }
  });

  it("听音选谱面：正确谱面在 correctIndex 位、四候选互不相同", () => {
    for (const levelId of ["L1", "L2", "L3", "L4"]) {
      for (const q of poolOf(levelId).filter((q) => q.type === "group-ear-quiz")) {
        const quiz = asEar(q);
        expect(quiz.options).toHaveLength(4);
        expect(quiz.options[quiz.correctIndex]).toEqual(quiz.pitches);
        expect(new Set(quiz.options.map((o) => JSON.stringify(o))).size).toBe(4);
      }
    }
  });

  it("L4 混合识别：干扰项跨组出现（三组边界处正确项的下一题即换组）", () => {
    const notation = poolOf("L4").filter((q) => q.type === "group-notation-quiz").map(asNotation);
    expect(notation).toHaveLength(18);
    // 枚举序：do-mi-so 组 6 题 → la-so-mi 组 6 题 → la-do-mi 组 6 题
    expect([...new Set(notation.slice(0, 6).map((q) => q.groupId))]).toEqual(["do-mi-so"]);
    expect([...new Set(notation.slice(6, 12).map((q) => q.groupId))]).toEqual(["la-so-mi"]);
    expect([...new Set(notation.slice(12).map((q) => q.groupId))]).toEqual(["la-do-mi"]);
    // 组内第 6 个音型（枚举下标 5）的干扰项取 6,7,8 = 下一组前三音型 → 跨组干扰
    const boundary = notation[5]!;
    expect(boundary.groupId).toBe("do-mi-so");
    const distractors = boundary.options.filter((_, i) => i !== boundary.correctIndex);
    expect(distractors).toContain("6-5-3（la-so-mi）");
  });

  it("L5 弹奏题池 = 18 个音型、标签为「简谱（唱名）」，音高与识别关同源", () => {
    const plays = poolOf("L5").map(asPlay);
    expect(plays).toHaveLength(18);
    for (const q of plays) {
      expect(q.label).toBe(figureLabel(q.syllables));
      expect(q.pitches).toHaveLength(3);
    }
    const recognitionKeys = new Set(
      poolOf("L4")
        .filter((q) => q.type === "group-notation-quiz")
        .map((q) => JSON.stringify(asNotation(q).pitches)),
    );
    for (const q of plays) expect(recognitionKeys.has(JSON.stringify(q.pitches))).toBe(true);
  });

  it("确定性：同关卡两次 samplePool 深比较一致（错题池按 questionKey 匹配的前提）", () => {
    expect(poolOf("L4")).toEqual(poolOf("L4"));
    expect(poolOf("L5")).toEqual(poolOf("L5"));
  });

  it("空音组列表抛错（枚举先于选项装配拦截；每组恒 6 音型 ≥4，无「不足四选项」实态）", () => {
    const fake: LevelDef = { ...levelOf("L1"), pool: { kind: "recognition", groups: [] } };
    expect(() => plugin().samplePool(fake)).toThrow(/不得为空/);
  });
});

describe("judge：判定与行内反馈", () => {
  const notation: GroupNotationQuizQuestion = {
    type: "group-notation-quiz",
    groupId: "do-mi-so",
    syllables: ["do", "mi", "so"],
    pitches: [60, 64, 67],
    options: ["1-3-5（do-mi-so）", "1-5-3（do-so-mi）", "3-1-5（mi-do-so）", "3-5-1（mi-so-do）"],
    correctIndex: 0,
  };
  const ear: GroupEarQuizQuestion = {
    type: "group-ear-quiz",
    groupId: "la-do-mi",
    syllables: ["la", "do", "mi"],
    pitches: [57, 60, 64],
    options: [
      [57, 60, 64],
      [57, 64, 60],
      [60, 57, 64],
      [60, 64, 57],
    ],
    correctIndex: 0,
  };
  const play: GroupPlayQuestion = {
    type: "group-play",
    groupId: "la-so-mi",
    syllables: ["la", "so", "mi"],
    pitches: [69, 67, 64],
    label: "6-5-3（la-so-mi）",
  };

  it("看谱选唱名：选对 → ok，反馈含 ✓ 与「简谱（唱名）」标签", () => {
    const j = plugin().judge(notation, choiceAnswer("A"));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("✓");
    expect(j.feedback).toContain("1-3-5（do-mi-so）");
  });

  it("看谱选唱名：选错 → 非 ok，反馈报出所选与正确标签", () => {
    const j = plugin().judge(notation, choiceAnswer("D"));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("你选「3-5-1（mi-so-do）」");
    expect(j.feedback).toContain("正确是「1-3-5（do-mi-so）」");
  });

  it("听音选谱面：选对/选错，反馈含选项字母与标签", () => {
    const ok = plugin().judge(ear, choiceAnswer("A"));
    expect(ok.ok).toBe(true);
    expect(ok.feedback).toContain("✓");
    expect(ok.feedback).toContain("6-1-3（la-do-mi）");

    const bad = plugin().judge(ear, choiceAnswer("C"));
    expect(bad.ok).toBe(false);
    expect(bad.feedback).toContain("你选了 C");
    expect(bad.feedback).toContain("正确是 A");
  });

  it("音组弹奏：严格有序——顺序全对 → ok；同集合换序 → 非 ok（乐句有先后语义）", () => {
    const ok = plugin().judge(play, keysAnswer([69, 67, 64]));
    expect(ok.ok).toBe(true);
    expect(ok.feedback).toContain("✓");
    expect(ok.feedback).toContain("A4-G4-E4");
    expect(ok.feedback).toContain("6-5-3（la-so-mi）");

    const reversed = plugin().judge(play, keysAnswer([64, 67, 69]));
    expect(reversed.ok).toBe(false);
    expect(reversed.feedback).toContain("你弹了 E4-G4-A4");
    expect(reversed.feedback).toContain("正确是 A4-G4-E4");
  });

  it("音组弹奏：长度不符（少弹 / 多弹）→ 非 ok", () => {
    expect(plugin().judge(play, keysAnswer([69, 67])).ok).toBe(false);
    expect(plugin().judge(play, keysAnswer([69, 67, 64, 64])).ok).toBe(false);
  });

  it("作答变体不符 → 非 ok 兜底文案；未知题型 → 抛错", () => {
    expect(plugin().judge(notation, { kind: "midi", midi: 60, velocity: 0.8, timestamp: 0 }).feedback).toBe(
      "✗ 非选项作答",
    );
    expect(plugin().judge(ear, keysAnswer([60])).feedback).toBe("✗ 非选项作答");
    expect(plugin().judge(play, choiceAnswer("A")).feedback).toBe("✗ 非多键作答");
    expect(() => plugin().judge({ type: "other" }, choiceAnswer("A"))).toThrow(
      /unexpected question type/,
    );
  });

  it("选项字母与 correctIndex 同源（A–D 四个）", () => {
    expect(OPTION_LETTERS).toEqual(["A", "B", "C", "D"]);
  });
});

describe("支线解锁派生（地标音系统毕业 → 首调功能音组开放）", () => {
  const techniques = [getTechnique("landmark-notes").manifest, plugin().manifest];
  const landmarkPassed = (levelId: string) => ({
    techniqueId: "landmark-notes",
    levelId,
    passed: true,
    best: null,
  });

  it("地标音未毕业：支线锁定，首关也不开", () => {
    const tree = deriveCourseTree(techniques, [
      landmarkPassed("L1"),
      landmarkPassed("L2"),
      landmarkPassed("L3"),
    ]);
    const side = tree.find((t) => t.id === "functional-groups")!;
    expect(side.unlocked).toBe(false);
    expect(side.levels.every((l) => !l.unlocked)).toBe(true);
  });

  it("地标音四关全过 = 毕业：支线解锁、首关即开；五关全过 = 支线毕业", () => {
    const unlocked = deriveCourseTree(techniques, [
      landmarkPassed("L1"),
      landmarkPassed("L2"),
      landmarkPassed("L3"),
      landmarkPassed("L4"),
    ]);
    const side = unlocked.find((t) => t.id === "functional-groups")!;
    expect(side.unlocked).toBe(true);
    expect(side.track).toBe("side");
    expect(side.levels[0]!.unlocked).toBe(true);
    expect(side.levels[1]!.unlocked).toBe(false); // 关卡内线性
    expect(side.graduated).toBe(false);

    const graduated = deriveCourseTree(techniques, [
      ...["L1", "L2", "L3", "L4", "L5"].map((levelId) => ({
        techniqueId: "functional-groups",
        levelId,
        passed: true,
        best: null,
      })),
    ]);
    expect(graduated.find((t) => t.id === "functional-groups")!.graduated).toBe(true);
  });
});

describe("整轮模拟（Round 引擎 × 功能音组插件）", () => {
  /** 识别题的正确选项字母。 */
  function correctLetter(q: Question): string {
    const correctIndex =
      q.type === "group-notation-quiz" ? asNotation(q).correctIndex : asEar(q).correctIndex;
    return OPTION_LETTERS[correctIndex]!;
  }

  it("L1 快答轮 12 题全对（响应 1.5s）→ 通过、分母恒定、相邻不连出、错题池即弃", () => {
    const level = levelOf("L1");
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(1500);
      expect(round.submit(choiceAnswer(correctLetter(issued.question))).ok).toBe(true);
      count++;
    }
    const result = round.settle();
    expect(count).toBe(12);
    expect(result.passed).toBe(true);
    expect(result.accuracy).toBe(1);
    expect(result.medianResponseMs).toBe(1500);
    expect(result.nextMistakePool).toEqual([]);
    expect(hasAdjacentDuplicates(result.records)).toBe(false);
  });

  it("L4 混合快答轮：错 1 题（11/12 ≥90%、中位 ≤3s）→ 仍达标；错题入池", () => {
    const level = levelOf("L4");
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let index = 0;
    let wrongQuestion: Question | null = null;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(1200);
      if (index === 3) {
        // 故意选正确项之外的一个字母
        const wrongLetter = OPTION_LETTERS.find((l) => l !== correctLetter(issued.question))!;
        const judgement = round.submit(choiceAnswer(wrongLetter));
        expect(judgement.ok).toBe(false);
        wrongQuestion = issued.question;
      } else {
        expect(round.submit(choiceAnswer(correctLetter(issued.question))).ok).toBe(true);
      }
      index++;
    }
    const result = round.settle();
    expect(result.questionCount).toBe(12);
    expect(result.correctCount).toBe(11);
    expect(result.passed).toBe(true);
    expect(result.nextMistakePool).toEqual([]); // 达标即弃（ADR 0004）
    expect(wrongQuestion).not.toBeNull();
  });

  it("L5 弹奏轮 8 题全对（慢响应不受限）→ 通过；keys 变体经引擎全程不透明", () => {
    const level = levelOf("L5");
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(5000); // 弹奏关卡无响应时限
      const q = asPlay(issued.question);
      expect(round.submit(keysAnswer(q.pitches)).ok, q.label).toBe(true);
      count++;
    }
    const result = round.settle();
    expect(count).toBe(8);
    expect(result.passed).toBe(true);
    expect(result.accuracy).toBe(1);
    expect(hasAdjacentDuplicates(result.records)).toBe(false);
  });

  it("快答轮中位响应超 3s：正确率满分也不达标（快答双条件）", () => {
    const level = levelOf("L2");
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(3500); // 每题 3.5s > 中位上限
      round.submit(choiceAnswer(correctLetter(issued.question)));
    }
    const result = round.settle();
    expect(result.accuracy).toBe(1);
    expect(result.passed).toBe(false);
  });
});
