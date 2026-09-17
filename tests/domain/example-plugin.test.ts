import { beforeEach, describe, expect, it } from "vitest";
import { Round } from "@/domain/round";
import {
  __clearRegistryForTests,
  getTechnique,
  listTechniques,
  registerTechnique,
} from "@/domain/registry";
import { questionKey } from "@/domain/sampling";
import type { AnswerEvent, Question } from "@/domain/types";
import examplePlugin from "@/plugins/example";
import { FakeClock, hasAdjacentDuplicates } from "./helpers";

/** 从示例插件题目中安全取出目标 MIDI（判别 type 后收窄，不用不安全断言）。 */
function midiOf(q: Question): number {
  if (q.type !== "note" || typeof q.midi !== "number") {
    throw new Error(`unexpected example question: ${JSON.stringify(q)}`);
  }
  return q.midi;
}

/**
 * #34 验收：内存示例插件经注册表加载，跑通整轮模拟（出题→作答→结算）。
 * 示例插件是验收演示、不进生产注册表（src/plugins/index.ts 只注册产品技巧，
 * 课程树从注册表枚举渲染），故此处显式注册。生产注册链路由 landmark-notes.test.ts 验证。
 */
describe("示例插件 × 静态注册表", () => {
  beforeEach(() => {
    __clearRegistryForTests();
    registerTechnique(examplePlugin);
  });

  it("经注册表加载：registerTechnique 后可按 id 取到示例插件", () => {
    const plugin = getTechnique("example");
    expect(plugin.manifest.id).toBe("example");
    expect(listTechniques().map((p) => p.manifest.id)).toContain("example");
  });

  it("samplePool 按关卡 pool 声明产出题池：L1 三音 / L2 五音", () => {
    const plugin = getTechnique("example");
    const [l1, l2] = plugin.manifest.levels;
    expect(plugin.samplePool(l1)).toEqual([
      { type: "note", midi: 60 },
      { type: "note", midi: 64 },
      { type: "note", midi: 67 },
    ]);
    expect(plugin.samplePool(l2)).toHaveLength(5);
  });

  it("judge：弹对 → ok；弹错 → 非 ok 且反馈含正确音；非琴键作答 → 非 ok", () => {
    const plugin = getTechnique("example");
    const q = { type: "note", midi: 60 };
    const midi = (midi: number): AnswerEvent => ({ kind: "midi", midi, velocity: 80, timestamp: 0 });

    expect(plugin.judge(q, midi(60)).ok).toBe(true);
    const wrong = plugin.judge(q, midi(62));
    expect(wrong.ok).toBe(false);
    expect(wrong.feedback).toContain("60"); // 行内反馈带正确音
    expect(plugin.judge(q, { kind: "choice", choiceId: "60", timestamp: 0 }).ok).toBe(false);
  });

  it("浏览器层两件在纯 TS seam 中调用即抛（防误用）", () => {
    const plugin = getTechnique("example");
    expect(() => plugin.render({ type: "note", midi: 60 })).toThrow(/浏览器层/);
    return expect(plugin.interact()).rejects.toThrow(/浏览器层/);
  });

  it("整轮模拟：L1 快答 12 题全对 → 结算通过、错题池空", () => {
    const plugin = getTechnique("example");
    const level = plugin.manifest.levels[0]; // L1 三音快答：12 题 / ≥90% / ≤3s
    const clock = new FakeClock();
    const round = new Round({ level, plugin, now: clock.now });

    const answers: number[] = [];
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(500);
      const midi = midiOf(issued.question); // 看题弹回同音
      const judgement = round.submit({ kind: "midi", midi, velocity: 80, timestamp: clock.now() });
      expect(judgement.ok).toBe(true);
      answers.push(midi);
    }

    const result = round.settle();
    expect(answers).toHaveLength(12);
    expect(result.passed).toBe(true);
    expect(result.questionCount).toBe(12);
    expect(result.correctCount).toBe(12);
    expect(result.accuracy).toBe(1);
    expect(result.medianResponseMs).toBe(500);
    expect(result.nextMistakePool).toEqual([]);
    expect(hasAdjacentDuplicates(result.records)).toBe(false); // 3 音小题池不连出
  });

  it("整轮模拟：答错 4 题未达标 → 错题池带入重来轮，重来轮同样 12 题", () => {
    const plugin = getTechnique("example");
    const level = plugin.manifest.levels[0];
    const wrongMidi = 48; // 固定弹错的音（不在题池内，必错）

    const clock1 = new FakeClock();
    const round1 = new Round({ level, plugin, now: clock1.now });
    let i = 0;
    for (let issued = round1.next(); issued; issued = round1.next()) {
      clock1.advance(500);
      const midi = i < 4 ? wrongMidi : midiOf(issued.question);
      round1.submit({ kind: "midi", midi, velocity: 80, timestamp: clock1.now() });
      i++;
    }
    const failed = round1.settle();
    expect(failed.passed).toBe(false); // 8/12 = 66.7% < 90%
    // 3 音小题池下前 4 题可能有重复题，错题池按 key 去重后应恰为全部答错题
    const wrongKeys = [
      ...new Set(failed.records.filter((r) => !r.ok).map((r) => questionKey(r.question))),
    ].sort();
    expect(failed.nextMistakePool.map(questionKey).sort()).toEqual(wrongKeys);

    // 整轮重来：错题池显式带入，重来轮满分通过 → 池即弃
    const clock2 = new FakeClock();
    const round2 = new Round({ level, plugin, mistakePool: failed.nextMistakePool, now: clock2.now });
    let count = 0;
    for (let issued = round2.next(); issued; issued = round2.next()) {
      clock2.advance(400);
      round2.submit({
        kind: "midi",
        midi: midiOf(issued.question),
        velocity: 80,
        timestamp: clock2.now(),
      });
      count++;
    }
    expect(count).toBe(12); // 分母恒定
    const retry = round2.settle();
    expect(retry.passed).toBe(true);
    expect(retry.nextMistakePool).toEqual([]); // 达标即弃
  });
});
