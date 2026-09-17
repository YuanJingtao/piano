import { describe, expect, it } from "vitest";
import { MISTAKE_WEIGHT, drawQuestion, questionKey } from "@/domain/sampling";
import type { Question } from "@/domain/types";

const A: Question = { type: "stub", id: "A" };
const B: Question = { type: "stub", id: "B" };
const C: Question = { type: "stub", id: "C" };

describe("questionKey", () => {
  it("同内容不同键序视为同题", () => {
    expect(questionKey({ type: "note", midi: 60 })).toBe(questionKey({ midi: 60, type: "note" }));
  });

  it("不同内容不同 key", () => {
    expect(questionKey(A)).not.toBe(questionKey(B));
  });
});

describe("drawQuestion：有放回随机抽样", () => {
  it("小题池多次抽取：题目可重复出现（有放回）", () => {
    const rngs = [0.1, 0.5, 0.9];
    let call = 0;
    const rng = () => rngs[call++ % rngs.length];

    const drawn: Question[] = [];
    let lastKey: string | undefined;
    for (let i = 0; i < 12; i++) {
      const q = drawQuestion({ pool: [A, B, C], lastKey, rng });
      drawn.push(q);
      lastKey = questionKey(q);
    }

    expect(drawn).toHaveLength(12);
    const counts = new Map<string, number>();
    for (const q of drawn) {
      const k = questionKey(q);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    // 12 次抽取来自 3 题池：必有重复（有放回），且 rng 循环覆盖到全部三题
    expect(Math.max(...counts.values())).toBeGreaterThan(1);
    expect(counts.size).toBe(3);
  });

  it("空题池抛错", () => {
    expect(() => drawQuestion({ pool: [] })).toThrow(/empty pool/);
  });
});

describe("drawQuestion：不连出约束", () => {
  it("3 题小题池连抽 30 次，相邻两题永不相同", () => {
    let lastKey: string | undefined;
    let prev: Question | undefined;
    for (let i = 0; i < 30; i++) {
      const q = drawQuestion({ pool: [A, B, C], lastKey, rng: () => 0 }); // rng=0 总选首选，仍不得连出
      if (prev) expect(questionKey(q)).not.toBe(questionKey(prev));
      prev = q;
      lastKey = questionKey(q);
    }
  });

  it("默认 Math.random 下同样满足不连出", () => {
    let lastKey: string | undefined;
    let prev: Question | undefined;
    for (let i = 0; i < 50; i++) {
      const q = drawQuestion({ pool: [A, B, C], lastKey });
      if (prev) expect(questionKey(q)).not.toBe(questionKey(prev));
      prev = q;
      lastKey = questionKey(q);
    }
  });

  it("题池仅 1 题时优雅降级：允许与上一题相同（地标 L1 仅中央 C 场景）", () => {
    const first = drawQuestion({ pool: [A] });
    const second = drawQuestion({ pool: [A], lastKey: questionKey(first) });
    expect(questionKey(second)).toBe(questionKey(first));
  });
});

describe("drawQuestion：错题 3× 加权", () => {
  it("权重常量为 3（ADR 0004）", () => {
    expect(MISTAKE_WEIGHT).toBe(3);
  });

  it("错题在池中时，抽样边界按 3/5 偏移（rng=0.55 命中错题；无错题时同 rng 命中他题）", () => {
    // pool [A,B,C]，错题 [A]：权重 A=3,B=1,C=1，total=5，A 占 [0, 0.6)
    // rng=0.55 → roll=2.75 → 落在 A 区间
    const withMistake = drawQuestion({ pool: [A, B, C], mistakes: [A], rng: () => 0.55 });
    expect(questionKey(withMistake)).toBe(questionKey(A));

    // 无错题：权重均 1，total=3，rng=0.55 → roll=1.65 → 落在 B 区间
    const withoutMistake = drawQuestion({ pool: [A, B, C], rng: () => 0.55 });
    expect(questionKey(withoutMistake)).toBe(questionKey(B));
  });

  it("rng 边界：0 选首个加权候选，接近 1 选末个", () => {
    expect(questionKey(drawQuestion({ pool: [A, B, C], mistakes: [A], rng: () => 0 }))).toBe(
      questionKey(A),
    );
    expect(
      questionKey(drawQuestion({ pool: [A, B, C], mistakes: [A], rng: () => 0.9999 })),
    ).toBe(questionKey(C));
  });

  it("不连出优先于加权：上一题是错题时，本次从非错题中抽", () => {
    const q = drawQuestion({
      pool: [A, B, C],
      mistakes: [A],
      lastKey: questionKey(A),
      rng: () => 0,
    });
    expect(questionKey(q)).not.toBe(questionKey(A));
  });
});
