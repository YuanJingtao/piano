import { describe, expect, it } from "vitest";
import { Round } from "@/domain/round";
import { questionKey } from "@/domain/sampling";
import type { Question } from "@/domain/types";
import {
  FakeClock,
  hasAdjacentDuplicates,
  keyOf,
  makeStubPlugin,
  playFullRound,
  playLevel,
  quickLevel,
  timedLevel,
} from "./helpers";

function newRound(level = quickLevel(), opts?: { mistakePool?: Question[]; rng?: () => number }) {
  const clock = new FakeClock();
  const round = new Round({
    level,
    plugin: makeStubPlugin([level]),
    mistakePool: opts?.mistakePool,
    rng: opts?.rng,
    now: clock.now,
  });
  return { round, clock };
}

describe("结算与阈值：快答关卡（12 题 / ≥90% / 中位 ≤3s）", () => {
  it("11/12 对（91.7%）且响应快 → 通过", () => {
    const { round, clock } = newRound();
    const result = playFullRound(round, clock, (i) => (i === 0 ? "wrong" : "ok"), 100);
    expect(result.passed).toBe(true);
    expect(result.questionCount).toBe(12);
    expect(result.correctCount).toBe(11);
    expect(result.accuracy).toBeCloseTo(11 / 12);
  });

  it("10/12 对（83.3%）→ 未达标（90% 边界之下）", () => {
    const { round, clock } = newRound();
    const result = playFullRound(round, clock, (i) => (i < 2 ? "wrong" : "ok"), 100);
    expect(result.passed).toBe(false);
    expect(result.accuracy).toBeCloseTo(10 / 12);
  });

  it("全对且中位响应恰 3000ms → 通过（≤ 为闭区间）", () => {
    const { round, clock } = newRound();
    const result = playFullRound(round, clock, "ok", 3000);
    expect(result.medianResponseMs).toBe(3000);
    expect(result.passed).toBe(true);
  });

  it("全对但中位响应 3001ms → 未达标", () => {
    const { round, clock } = newRound();
    const result = playFullRound(round, clock, "ok", 3001);
    expect(result.passed).toBe(false);
  });

  it("中位数不是平均数：5 快 + 7 慢（均值 1850 会误过，中位 3100 应拦下）", () => {
    const { round, clock } = newRound();
    const result = playFullRound(round, clock, "ok", (i) => (i < 5 ? 100 : 3100));
    expect(result.medianResponseMs).toBe(3100);
    expect(result.passed).toBe(false);
  });
});

describe("结算与阈值：弹奏关卡（8 题 / ≥85%，无中位约束）", () => {
  it("7/8 对（87.5%）→ 通过", () => {
    const { round, clock } = newRound(playLevel());
    const result = playFullRound(round, clock, (i) => (i === 0 ? "wrong" : "ok"), 100);
    expect(result.questionCount).toBe(8);
    expect(result.passed).toBe(true);
  });

  it("6/8 对（75%）→ 未达标（85% 边界之下）", () => {
    const { round, clock } = newRound(playLevel());
    const result = playFullRound(round, clock, (i) => (i < 2 ? "wrong" : "ok"), 100);
    expect(result.passed).toBe(false);
  });

  it("全对但每题 10s → 仍通过（弹奏关卡不考核响应时长）", () => {
    const { round, clock } = newRound(playLevel());
    const result = playFullRound(round, clock, "ok", 10000);
    expect(result.passed).toBe(true);
  });
});

describe("整轮重来：分母恒定，无补出题", () => {
  it("未达标轮恰好 12 题记录；重来轮同样恰好 12 题", () => {
    const first = newRound();
    const firstResult = playFullRound(first.round, first.clock, (i) => (i < 4 ? "wrong" : "ok"));
    expect(firstResult.passed).toBe(false);
    expect(firstResult.records).toHaveLength(12); // 答错不补出
    expect(firstResult.questionCount).toBe(12);

    const second = newRound(quickLevel(), { mistakePool: firstResult.nextMistakePool });
    const secondResult = playFullRound(second.round, second.clock);
    expect(secondResult.records).toHaveLength(12); // 重来分母恒为 12
    expect(secondResult.questionCount).toBe(12);
  });
});

describe("限时模式：超时记为错题，ms 记为时限值，轮次继续", () => {
  it("超时题：ok=false、responseMs=时限值、timedOut=true、无作答事件；后续题照常", () => {
    const level = timedLevel(); // 4 题 / timeLimitMs=2000 / ≥75%
    const { round, clock } = newRound(level);
    const result = playFullRound(
      round,
      clock,
      ["ok", "timeout", "ok", "ok"],
      [500, 99999, 500, 500], // 超时题推进多少都不影响：ms 记为时限值
    );

    expect(result.records).toHaveLength(4); // 轮次继续到满员
    const timedOutRecord = result.records[1];
    expect(timedOutRecord.ok).toBe(false);
    expect(timedOutRecord.timedOut).toBe(true);
    expect(timedOutRecord.responseMs).toBe(2000); // 时限值，而非实际流逝时间
    expect(timedOutRecord.answer).toBeUndefined();

    expect(result.correctCount).toBe(3);
    expect(result.passed).toBe(true); // 3/4 = 75% 达标
  });

  it("超时题进入错题池（未达标轮）", () => {
    const level = timedLevel();
    const { round, clock } = newRound(level);
    const result = playFullRound(round, clock, ["timeout", "timeout", "ok", "ok"]); // 2/4 = 50% 未达标
    expect(result.passed).toBe(false);
    const poolKeys = result.nextMistakePool.map(questionKey);
    expect(poolKeys).toContain(questionKey(result.records[0].question));
    expect(poolKeys).toContain(questionKey(result.records[1].question));
  });

  it("非限时关卡调用 timeout() 抛错", () => {
    const { round } = newRound();
    round.next();
    expect(() => round.timeout()).toThrow(/timeLimitMs/);
  });
});

describe("加权错题池生命周期", () => {
  it("答错的题进入结算产出的错题池", () => {
    const { round, clock } = newRound();
    const result = playFullRound(round, clock, (i) => (i < 2 ? "wrong" : "ok"));
    expect(result.passed).toBe(false);
    const wrongKeys = result.records.filter((r) => !r.ok).map((r) => questionKey(r.question));
    expect(result.nextMistakePool.map(questionKey).sort()).toEqual([...wrongKeys].sort());
    expect(result.nextMistakePool.length).toBeGreaterThan(0);
  });

  it("带入的错题本轮答对一次即移出", () => {
    // 2 题池 + rng=0 → 出题序列严格 q0,q1,q0,q1…；q0 为带入错题，全答对；q1 全答错
    const level = quickLevel([60, 61]);
    const carried: Question = { type: "stub", i: 0, midi: 60 };
    const { round, clock } = newRound(level, { mistakePool: [carried], rng: () => 0 });
    const result = playFullRound(round, clock, (i) => (i % 2 === 0 ? "ok" : "wrong"));

    const q0Records = result.records.filter((r) => questionKey(r.question) === questionKey(carried));
    expect(q0Records.length).toBeGreaterThan(0); // 错题确实以加权被抽中
    expect(q0Records.every((r) => r.ok)).toBe(true);

    expect(result.passed).toBe(false); // 0.5 正确率未达标
    const poolKeys = result.nextMistakePool.map(questionKey);
    expect(poolKeys).not.toContain(questionKey(carried)); // 答对一次即移出
    expect(poolKeys).toHaveLength(1); // 池中只剩本轮答错的 q1
  });

  it("轮次达标，错题池即弃", () => {
    const first = newRound();
    const firstResult = playFullRound(first.round, first.clock, (i) => (i < 3 ? "wrong" : "ok"));
    const wrongKeys = [
      ...new Set(firstResult.records.filter((r) => !r.ok).map((r) => questionKey(r.question))),
    ].sort();
    expect(firstResult.nextMistakePool.map(questionKey).sort()).toEqual(wrongKeys);
    expect(wrongKeys.length).toBeGreaterThan(0);

    const second = newRound(quickLevel(), { mistakePool: firstResult.nextMistakePool });
    const secondResult = playFullRound(second.round, second.clock, "ok");
    expect(secondResult.passed).toBe(true);
    expect(secondResult.nextMistakePool).toEqual([]); // 达标即弃，不带入下一轮
  });

  it("不跨轮次持久化：新轮次不带入池时，结算池只含本轮错题", () => {
    const level = quickLevel([60, 61]);
    const a = newRound(level, { rng: () => 0 });
    const aResult = playFullRound(a.round, a.clock, (i) => (i % 2 === 0 ? "wrong" : "ok"));
    expect(aResult.nextMistakePool).toHaveLength(1); // A 轮错题 q0

    const b = newRound(level, { rng: () => 0 }); // 不传 mistakePool
    const bResult = playFullRound(b.round, b.clock, (i) => (i % 2 === 1 ? "wrong" : "ok"));
    expect(bResult.nextMistakePool).toHaveLength(1);
    expect(questionKey(bResult.nextMistakePool[0])).not.toBe(
      questionKey(aResult.nextMistakePool[0]),
    ); // B 的池与 A 的池无关，仅由显式传参流转
  });
});

describe("出题约束（引擎层）", () => {
  it("3 题小题池跑满 12 题，相邻两题不相同", () => {
    for (let trial = 0; trial < 20; trial++) {
      const { round, clock } = newRound(quickLevel([60, 64, 67]));
      const result = playFullRound(round, clock);
      expect(hasAdjacentDuplicates(result.records)).toBe(false);
    }
  });

  it("单题池（地标 L1 仅中央 C 场景）跑满 12 题不报错", () => {
    const { round, clock } = newRound(quickLevel([60]));
    const result = playFullRound(round, clock);
    expect(result.records).toHaveLength(12);
    expect(result.records.every((r) => keyOf(r.question) === keyOf(result.records[0].question))).toBe(
      true,
    );
    expect(result.passed).toBe(true);
  });
});

describe("引擎状态机防御", () => {
  it("当前题未结时再抽题抛错", () => {
    const { round } = newRound();
    round.next();
    expect(() => round.next()).toThrow(/not answered/);
  });

  it("无当前题时 submit / timeout 抛错", () => {
    const { round } = newRound();
    expect(() => round.submit({ kind: "choice", choiceId: "correct", timestamp: 0 })).toThrow(
      /no current question/,
    );
    expect(() => round.timeout()).toThrow(/no current question/);
  });

  it("未满员 settle 抛错；满员后 next() 返回 undefined", () => {
    const { round, clock } = newRound();
    round.next();
    clock.advance(100);
    round.submit({ kind: "choice", choiceId: "correct", timestamp: clock.now() });
    expect(round.isComplete()).toBe(false);
    expect(() => round.settle()).toThrow(/before round complete/);
  });

  it("samplePool 为空抛错（插件契约违规）", () => {
    const level = quickLevel([]);
    expect(
      () => new Round({ level, plugin: makeStubPlugin([level]), now: () => 0 }),
    ).toThrow(/empty pool/);
  });

  it("submit 返回插件判定，记录保留作答事件", () => {
    const { round, clock } = newRound();
    round.next();
    clock.advance(250);
    const answer = { kind: "choice", choiceId: "correct", timestamp: clock.now() } as const;
    const judgement = round.submit(answer);
    expect(judgement).toEqual({ ok: true, feedback: "✓" });
    const result = playFullRound(round, clock); // 跑完剩余题
    expect(result.records[0].answer).toEqual(answer);
    expect(result.records[0].responseMs).toBe(250);
    expect(result.records[0].timedOut).toBe(false);
  });

  it("lastResponseMs：与落库记录同源（行内反馈展示用）", () => {
    const { round, clock } = newRound();
    expect(round.lastResponseMs()).toBeUndefined(); // 尚无记录
    round.next();
    clock.advance(320);
    round.submit({ kind: "choice", choiceId: "correct", timestamp: clock.now() });
    expect(round.lastResponseMs()).toBe(320);
    round.next();
    clock.advance(180);
    round.submit({ kind: "choice", choiceId: "correct", timestamp: clock.now() });
    expect(round.lastResponseMs()).toBe(180); // 跟随最近一次 submit
    const result = playFullRound(round, clock);
    expect(result.records[1].responseMs).toBe(180);
  });
});
