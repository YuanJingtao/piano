import { describe, expect, it } from "vitest";
import type { LevelDef, Question, QuestionRecord, RoundResult } from "@/domain/types";
import { buildSettlementPayload } from "@/lib/training/settlement-payload";
import { parseSettlementPayload } from "@/lib/persistence/settlement";

/**
 * RoundResult → SettlementPayload 映射（#38 接线层）：
 * 口径对齐 #35 契约（params 快照、整数化、分母恒定、超时 answer=null），
 * 并验证产物能通过服务端 parseSettlementPayload 结构校验（同一契约两端）。
 */

const quickLevel: LevelDef = {
  id: "L1",
  title: "中央 C",
  questionCount: 3,
  pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
  pool: { landmarkIds: ["middle-c"] },
};

const playLevel: LevelDef = {
  id: "L2",
  title: "弹奏关",
  questionCount: 2,
  pass: { minAccuracy: 0.85 },
  pool: {},
};

function record(partial: Partial<QuestionRecord> & { question: Question }): QuestionRecord {
  return {
    answer: { kind: "midi", midi: 60, velocity: 0.8, timestamp: 100 },
    ok: true,
    responseMs: 500,
    timedOut: false,
    ...partial,
  };
}

function roundResult(records: QuestionRecord[], passed: boolean): RoundResult {
  const correctCount = records.filter((r) => r.ok).length;
  return {
    passed,
    questionCount: records.length,
    correctCount,
    accuracy: correctCount / records.length,
    medianResponseMs: 500,
    records,
    nextMistakePool: passed ? [] : records.filter((r) => !r.ok).map((r) => r.question),
  };
}

describe("buildSettlementPayload", () => {
  it("快答关卡：params 快照来自 LevelDef，result/answers 来自 RoundResult", () => {
    const q: Question = { type: "landmark-note", midi: 60, clef: "treble" };
    const result = roundResult(
      [record({ question: q }), record({ question: q }), record({ question: q })],
      true,
    );
    const payload = buildSettlementPayload({ techniqueId: "landmark-notes", level: quickLevel, result });

    expect(payload).toEqual({
      techniqueId: "landmark-notes",
      levelId: "L1",
      params: {
        questionType: "landmark-note",
        questionCount: 3,
        minAccuracy: 0.9,
        maxMedianResponseMs: 3000,
        timeLimitMs: null,
      },
      result: { passed: true, correctCount: 3, accuracy: 1, medianResponseMs: 500 },
      answers: [
        {
          question: q,
          answer: { kind: "midi", midi: 60, velocity: 0.8, timestamp: 100 },
          ok: true,
          responseMs: 500,
          timedOut: false,
        },
        {
          question: q,
          answer: { kind: "midi", midi: 60, velocity: 0.8, timestamp: 100 },
          ok: true,
          responseMs: 500,
          timedOut: false,
        },
        {
          question: q,
          answer: { kind: "midi", midi: 60, velocity: 0.8, timestamp: 100 },
          ok: true,
          responseMs: 500,
          timedOut: false,
        },
      ],
    });
    // 同一契约两端：产物必须通过服务端结构校验
    expect(parseSettlementPayload(payload).ok).toBe(true);
  });

  it("弹奏关卡（无中位阈值）→ maxMedianResponseMs 为 null；限时值缺省为 null", () => {
    const q: Question = { type: "play-echo", midi: 64 };
    const result = roundResult([record({ question: q }), record({ question: q })], true);
    const payload = buildSettlementPayload({ techniqueId: "t", level: playLevel, result });
    expect(payload.params.maxMedianResponseMs).toBeNull();
    expect(payload.params.timeLimitMs).toBeNull();
    expect(payload.params.questionType).toBe("play-echo");
    expect(parseSettlementPayload(payload).ok).toBe(true);
  });

  it("限时关卡：timeLimitMs 进快照；超时记录 answer=null、timedOut=true、ms=时限值", () => {
    const timed: LevelDef = { ...quickLevel, timeLimitMs: 5000 };
    const q: Question = { type: "landmark-note", midi: 60, clef: "bass" };
    const result = roundResult(
      [
        record({ question: q }),
        record({ question: q }),
        record({ question: q, answer: undefined, ok: false, responseMs: 5000, timedOut: true }),
      ],
      false,
    );
    const payload = buildSettlementPayload({ techniqueId: "t", level: timed, result });
    expect(payload.params.timeLimitMs).toBe(5000);
    expect(payload.answers[2]).toEqual({ question: q, answer: null, ok: false, responseMs: 5000, timedOut: true });
    expect(payload.result.passed).toBe(false);
    expect(parseSettlementPayload(payload).ok).toBe(true);
  });

  it("偶数题数中位数为 x.5 → 取整（服务端要求整数）", () => {
    const q: Question = { type: "landmark-note", midi: 60, clef: "treble" };
    const result: RoundResult = {
      ...roundResult([record({ question: q }), record({ question: q, responseMs: 501 })], true),
      medianResponseMs: 500.5,
    };
    const payload = buildSettlementPayload({ techniqueId: "t", level: playLevel, result });
    expect(payload.result.medianResponseMs).toBe(501);
    expect(Number.isInteger(payload.result.medianResponseMs)).toBe(true);
    expect(parseSettlementPayload(payload).ok).toBe(true);
  });

  it("answers 长度 = params.questionCount（分母恒定，服务端校验同口径）", () => {
    const q: Question = { type: "landmark-note", midi: 60, clef: "treble" };
    const result = roundResult(
      Array.from({ length: quickLevel.questionCount }, () => record({ question: q })),
      true,
    );
    const payload = buildSettlementPayload({ techniqueId: "t", level: quickLevel, result });
    expect(payload.answers).toHaveLength(payload.params.questionCount);
  });
});
