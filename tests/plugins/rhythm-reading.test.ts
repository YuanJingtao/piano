import { describe, expect, it } from "vitest";
import "@/plugins"; // 触发生产静态注册（ADR 0007：注册表一行）
import { Round } from "@/domain/round";
import { getTechnique, listTechniques } from "@/domain/registry";
import type { AnswerEvent, LevelDef, Question } from "@/domain/types";
import { buildSettlementPayload } from "@/lib/training/settlement-payload";
import {
  OPTION_LETTERS,
  UNIT_BEATS,
  enumerateMeasures,
  patternBeats,
  patternSyllables,
  patternToBeats,
  type RhythmEarQuizQuestion,
  type RhythmSyllableQuizQuestion,
  type RhythmUnit,
} from "@/plugins/rhythm-reading";
import { FakeClock } from "../domain/helpers";

/**
 * seam 2：节奏阅读基础插件纯逻辑两件（samplePool / judge）+ 生产注册链路
 * + 限时模式口径（Round 引擎 × 结算快照，工单 #41，ADR 0001/0003）。
 */

function asSyllableQuiz(q: Question): RhythmSyllableQuizQuestion {
  if (q.type !== "rhythm-syllable-quiz") {
    throw new Error(`unexpected question: ${JSON.stringify(q)}`);
  }
  return q as RhythmSyllableQuizQuestion;
}

function asEarQuiz(q: Question): RhythmEarQuizQuestion {
  if (q.type !== "rhythm-ear-quiz") {
    throw new Error(`unexpected question: ${JSON.stringify(q)}`);
  }
  return q as RhythmEarQuizQuestion;
}

function choiceAnswer(choiceId: string): AnswerEvent {
  return { kind: "choice", choiceId, timestamp: 0 };
}

const plugin = () => getTechnique("rhythm-reading");
const levelOf = (id: string): LevelDef => plugin().manifest.levels.find((l) => l.id === id)!;
const unitsOf = (level: LevelDef) => (level.pool as { units: RhythmUnit[] }).units;

describe("节奏插件 × 生产注册表", () => {
  it("import '@/plugins' 后可按 id 取到", () => {
    expect(plugin().manifest.id).toBe("rhythm-reading");
    expect(listTechniques().map((p) => p.manifest.id)).toContain("rhythm-reading");
  });

  it("manifest：主线、前置为方向与音程（#40）、三关卡选择匹配口径", () => {
    const { manifest } = plugin();
    expect(manifest.track).toBe("main");
    expect(manifest.prerequisites).toEqual(["direction-intervals"]);
    expect(manifest.levels.map((l) => l.id)).toEqual(["L1", "L2", "L3"]);
    for (const level of manifest.levels) {
      expect(level.questionCount).toBe(10);
      // 通过口径仅正确率：不设中位上限（否则等同强制限时，违背 ADR 0003 可选语义）。
      expect(level.pass).toEqual({ minAccuracy: 0.8 });
      // 首版限时模式仅节奏关卡：三关全部声明时限值。
      expect(level.timeLimitMs).toBeGreaterThan(0);
      // 选择·匹配题显式声明（#44 契约附加，PracticeStage 文案消费；行为不变）。
      expect(level.answerMode).toBe("choice");
    }
    expect(levelOf("L1").timeLimitMs).toBe(8000);
    expect(levelOf("L2").timeLimitMs).toBe(8000);
    expect(levelOf("L3").timeLimitMs).toBe(10000);
  });
});

describe("enumerateMeasures：4/4 小节节奏型枚举（题池采样空间生成器）", () => {
  it("L1 词汇 {w,h,q} → 6 个节奏型，全部恰好 4 拍", () => {
    const measures = enumerateMeasures(["w", "h", "q"]);
    expect(measures).toHaveLength(6);
    expect(measures).toContainEqual(["w"]);
    expect(measures).toContainEqual(["q", "q", "q", "q"]);
    for (const m of measures) {
      expect(patternBeats(m)).toBe(4);
      expect(m.every((u) => ["w", "h", "q"].includes(u))).toBe(true);
    }
  });

  it("L2 词汇 {q,tt} → 2^4 = 16 个节奏型（每拍四分或八分对）", () => {
    const measures = enumerateMeasures(["q", "tt"]);
    expect(measures).toHaveLength(16);
    for (const m of measures) {
      expect(patternBeats(m)).toBe(4);
      expect(m.every((u) => u === "q" || u === "tt")).toBe(true);
    }
  });

  it("L3 全词汇 {w,h,q,tt} → 30 个节奏型，无重复", () => {
    const measures = enumerateMeasures(["w", "h", "q", "tt"]);
    expect(measures).toHaveLength(30);
    const keys = new Set(measures.map((m) => JSON.stringify(m)));
    expect(keys.size).toBe(30);
    for (const m of measures) expect(patternBeats(m)).toBe(4);
  });

  it("确定性：同词汇表两次枚举结果一致（错题池 questionKey 匹配的前提）", () => {
    expect(enumerateMeasures(["w", "h", "q", "tt"])).toEqual(
      enumerateMeasures(["w", "h", "q", "tt"]),
    );
  });

  it("空词汇表抛错", () => {
    expect(() => enumerateMeasures([])).toThrow(/不得为空/);
  });

  it("Kodály 音节映射（ADR 0001）与时值展开", () => {
    expect(patternSyllables(["q", "tt", "h"])).toBe("ta ti-ti ta-a");
    expect(patternSyllables(["w"])).toBe("ta-a-a-a");
    expect(patternToBeats(["q", "tt", "h"])).toEqual([1, 0.5, 0.5, 2]);
    expect(UNIT_BEATS).toEqual({ w: 4, h: 2, q: 1, tt: 1 });
  });
});

describe("samplePool：题池采样空间符合 manifest 声明", () => {
  it("每关卡题池 = 节奏型 × 两种题型（L1 12 / L2 32 / L3 60 题）", () => {
    const expected: Record<string, number> = { L1: 12, L2: 32, L3: 60 };
    for (const level of plugin().manifest.levels) {
      const pool = plugin().samplePool(level);
      expect(pool, level.id).toHaveLength(expected[level.id]!);
      const syllable = pool.filter((q) => q.type === "rhythm-syllable-quiz");
      const ear = pool.filter((q) => q.type === "rhythm-ear-quiz");
      expect(syllable.length).toBe(ear.length);
      // 每个节奏型两种题型各一题
      const syllablePatterns = new Set(syllable.map((q) => JSON.stringify(asSyllableQuiz(q).pattern)));
      const earPatterns = new Set(ear.map((q) => JSON.stringify(asEarQuiz(q).pattern)));
      expect(syllablePatterns.size).toBe(syllable.length);
      expect(earPatterns).toEqual(syllablePatterns);
    }
  });

  it("题目节奏型全部落在本关词汇表内、恰好 4 拍", () => {
    for (const level of plugin().manifest.levels) {
      const units = unitsOf(level);
      for (const q of plugin().samplePool(level)) {
        const pattern =
          q.type === "rhythm-syllable-quiz" ? asSyllableQuiz(q).pattern : asEarQuiz(q).pattern;
        expect(patternBeats(pattern), `${level.id} ${JSON.stringify(pattern)}`).toBe(4);
        for (const u of pattern) expect(units).toContain(u);
      }
    }
  });

  it("看谱选音节：正确音节串在 correctIndex 位，四个选项互不相同、均为本关合法音节串", () => {
    const level = levelOf("L3");
    const space = enumerateMeasures(unitsOf(level));
    const legalSyllables = new Set(space.map(patternSyllables));
    for (const q of plugin().samplePool(level).filter((q) => q.type === "rhythm-syllable-quiz")) {
      const quiz = asSyllableQuiz(q);
      expect(quiz.options).toHaveLength(4);
      expect(quiz.options[quiz.correctIndex]).toBe(patternSyllables(quiz.pattern));
      expect(new Set(quiz.options).size).toBe(4);
      for (const option of quiz.options) expect(legalSyllables.has(option)).toBe(true);
    }
  });

  it("听节奏选谱面：正确谱面在 correctIndex 位，四个候选互不相同", () => {
    for (const level of plugin().manifest.levels) {
      for (const q of plugin().samplePool(level).filter((q) => q.type === "rhythm-ear-quiz")) {
        const quiz = asEarQuiz(q);
        expect(quiz.options).toHaveLength(4);
        expect(quiz.options[quiz.correctIndex]).toEqual(quiz.pattern);
        expect(new Set(quiz.options.map((o) => JSON.stringify(o))).size).toBe(4);
      }
    }
  });

  it("正确项位置随题轮换（不是永远同一个选项）", () => {
    const positions = plugin()
      .samplePool(levelOf("L2"))
      .filter((q) => q.type === "rhythm-syllable-quiz")
      .map((q) => asSyllableQuiz(q).correctIndex);
    expect(new Set(positions).size).toBe(4);
  });

  it("确定性：同关卡两次 samplePool 深比较一致", () => {
    expect(plugin().samplePool(levelOf("L1"))).toEqual(plugin().samplePool(levelOf("L1")));
  });

  it("词汇表不足 4 个节奏型时抛错（无法装配四选项）", () => {
    const fake: LevelDef = { ...levelOf("L1"), pool: { units: ["w"] } };
    expect(() => plugin().samplePool(fake)).toThrow(/不足 4 个/);
  });
});

describe("judge：判定与行内反馈", () => {
  const syllableQuiz: RhythmSyllableQuizQuestion = {
    type: "rhythm-syllable-quiz",
    pattern: ["q", "tt", "q", "q"],
    options: ["ta ta ta ta", "ta ti-ti ta ta", "ti-ti ta ta ta", "ta ta ti-ti ta"],
    correctIndex: 1,
  };
  const earQuiz: RhythmEarQuizQuestion = {
    type: "rhythm-ear-quiz",
    pattern: ["h", "q", "q"],
    options: [
      ["q", "q", "h"],
      ["h", "q", "q"],
      ["h", "h"],
      ["q", "q", "q", "q"],
    ],
    correctIndex: 1,
  };

  it("看谱选音节：选对 → ok，反馈含 ✓ 与正确音节串", () => {
    const j = plugin().judge(syllableQuiz, choiceAnswer("B"));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("✓");
    expect(j.feedback).toContain("ta ti-ti ta ta");
  });

  it("看谱选音节：选错 → 非 ok，反馈含所选与正确音节串", () => {
    const j = plugin().judge(syllableQuiz, choiceAnswer("D"));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("✗");
    expect(j.feedback).toContain("ta ta ti-ti ta");
    expect(j.feedback).toContain("ta ti-ti ta ta");
  });

  it("听节奏选谱面：选对/选错，反馈含选项字母与音节", () => {
    const ok = plugin().judge(earQuiz, choiceAnswer("B"));
    expect(ok.ok).toBe(true);
    expect(ok.feedback).toContain("✓");
    expect(ok.feedback).toContain("ta-a ta ta");

    const bad = plugin().judge(earQuiz, choiceAnswer("A"));
    expect(bad.ok).toBe(false);
    expect(bad.feedback).toContain("你选了 A");
    expect(bad.feedback).toContain("正确是 B");
  });

  it("非选项作答 → 非 ok；未知题型 → 抛错", () => {
    const j = plugin().judge(syllableQuiz, {
      kind: "midi",
      midi: 60,
      velocity: 0.8,
      timestamp: 0,
    });
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("非选项作答");
    expect(() => plugin().judge({ type: "other" }, choiceAnswer("A"))).toThrow(
      /unexpected question type/,
    );
  });

  it("选项字母与 correctIndex 同源（A–D 四个）", () => {
    expect(OPTION_LETTERS).toEqual(["A", "B", "C", "D"]);
  });
});

describe("限时模式口径（Round 引擎 × 节奏插件 × 结算快照）", () => {
  it("限时轮：超时记错题（ms = 时限值、timedOut、无作答）、轮次继续、结算照常", () => {
    const level = levelOf("L1"); // timeLimitMs = 8000
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let issuedCount = 0;
    let timeoutCount = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      issuedCount++;
      if (issuedCount % 5 === 0) {
        // 每第 5 题放任超时（超过 8s 时限）
        clock.advance(9000);
        round.timeout();
        timeoutCount++;
      } else {
        clock.advance(1500);
        const q = issued.question;
        const letter =
          q.type === "rhythm-syllable-quiz"
            ? OPTION_LETTERS[asSyllableQuiz(q).correctIndex]!
            : OPTION_LETTERS[asEarQuiz(q).correctIndex]!;
        const judgement = round.submit(choiceAnswer(letter));
        expect(judgement.ok).toBe(true);
      }
    }

    const result = round.settle();
    expect(issuedCount).toBe(10);
    expect(timeoutCount).toBe(2);
    expect(result.questionCount).toBe(10); // 分母恒定（ADR 0004）
    expect(result.correctCount).toBe(8);
    expect(result.passed).toBe(true); // 8/10 = 80% ≥ 阈值
    const timedOutRecords = result.records.filter((r) => r.timedOut);
    expect(timedOutRecords).toHaveLength(2);
    for (const r of timedOutRecords) {
      expect(r.ok).toBe(false);
      expect(r.responseMs).toBe(8000);
      expect(r.answer).toBeUndefined();
    }

    // 限时轮结算快照含时限值（落库 practice_session.time_limit_ms，ADR 0006）
    const payload = buildSettlementPayload({ techniqueId: "rhythm-reading", level, result });
    expect(payload.params.timeLimitMs).toBe(8000);
    expect(payload.answers.filter((a) => a.timedOut)).toHaveLength(2);
    expect(payload.answers.find((a) => a.timedOut)?.answer).toBeNull();
    expect(payload.params.maxMedianResponseMs).toBeNull();
  });

  it("非限时轮（开关关闭 = 剥掉 timeLimitMs）：快照时限为 null，与限时轮分开落库", () => {
    const untimed: LevelDef = { ...levelOf("L1"), timeLimitMs: undefined };
    const clock = new FakeClock();
    const round = new Round({ level: untimed, plugin: plugin(), now: clock.now });
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(5000); // 慢慢答：非限时轮无超时口径
      const q = issued.question;
      const letter =
        q.type === "rhythm-syllable-quiz"
          ? OPTION_LETTERS[asSyllableQuiz(q).correctIndex]!
          : OPTION_LETTERS[asEarQuiz(q).correctIndex]!;
      round.submit(choiceAnswer(letter));
    }
    const result = round.settle();
    expect(result.passed).toBe(true);
    expect(() => round.timeout).not.toThrow(); // settle 后无当前题，timeout 不触发时限断言路径
    const payload = buildSettlementPayload({
      techniqueId: "rhythm-reading",
      level: untimed,
      result,
    });
    expect(payload.params.timeLimitMs).toBeNull();
  });

  it("整轮模拟：10 题全对通过、达标弃错题池、相邻不连出", () => {
    const level = levelOf("L2"); // 题池 32 题
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });
    const keys: string[] = [];
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(1200);
      const q = issued.question;
      keys.push(JSON.stringify(q));
      const letter =
        q.type === "rhythm-syllable-quiz"
          ? OPTION_LETTERS[asSyllableQuiz(q).correctIndex]!
          : OPTION_LETTERS[asEarQuiz(q).correctIndex]!;
      round.submit(choiceAnswer(letter));
    }
    const result = round.settle();
    expect(result.passed).toBe(true);
    expect(result.accuracy).toBe(1);
    expect(result.nextMistakePool).toEqual([]);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).not.toBe(keys[i - 1]); // 不连出
    }
  });
});
