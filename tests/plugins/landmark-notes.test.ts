import { describe, expect, it } from "vitest";
import "@/plugins"; // 触发生产静态注册（ADR 0007：注册表一行）
import { Round } from "@/domain/round";
import { getTechnique, listTechniques } from "@/domain/registry";
import type { AnswerEvent, Question } from "@/domain/types";
import { LANDMARKS } from "@/plugins/landmark-notes/landmarks";
import { FakeClock, hasAdjacentDuplicates } from "../domain/helpers";

/**
 * seam 2：地标音插件纯逻辑两件（samplePool / judge）+ 生产注册链路。
 * 题型「看谱认音」：题目 = 谱面上的地标音（midi + clef），作答 = 键盘弹出该音。
 */

type LandmarkQuestion = Question & { type: "landmark-note"; midi: number; clef: string };

function asLandmark(q: Question): LandmarkQuestion {
  if (q.type !== "landmark-note" || typeof q.midi !== "number" || typeof q.clef !== "string") {
    throw new Error(`unexpected landmark question: ${JSON.stringify(q)}`);
  }
  return q as LandmarkQuestion;
}

function midiAnswer(midi: number): AnswerEvent {
  return { kind: "midi", midi, velocity: 0.8, timestamp: 0 };
}

const plugin = () => getTechnique("landmark-notes");

describe("地标音插件 × 生产注册表", () => {
  it("import '@/plugins' 后可按 id 取到；示例插件不进生产注册表（课程树只渲染产品技巧）", () => {
    expect(plugin().manifest.id).toBe("landmark-notes");
    const ids = listTechniques().map((p) => p.manifest.id);
    expect(ids).toContain("landmark-notes");
    expect(ids).not.toContain("example");
  });

  it("manifest：主线、暂以无前置起步、四关卡全部快答口径（12 题 / ≥90% / 中位 ≤3s、无限时）", () => {
    const { manifest } = plugin();
    expect(manifest.track).toBe("main");
    expect(manifest.prerequisites).toEqual([]);
    expect(manifest.levels.map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4"]);
    for (const level of manifest.levels) {
      expect(level.questionCount).toBe(12);
      expect(level.pass).toEqual({ minAccuracy: 0.9, maxMedianResponseMs: 3000 });
      expect(level.timeLimitMs).toBeUndefined(); // 限时模式仅节奏关卡（ADR 0003）
    }
  });
});

describe("samplePool：题池采样空间符合 manifest 声明", () => {
  const poolOf = (levelId: string) =>
    plugin()
      .samplePool(plugin().manifest.levels.find((l) => l.id === levelId)!)
      .map(asLandmark);

  it("L1 中央 C：双谱表各成一题（高音谱下加一线 / 低音谱上加一线）", () => {
    expect(poolOf("L1")).toEqual([
      { type: "landmark-note", midi: 60, clef: "treble" },
      { type: "landmark-note", midi: 60, clef: "bass" },
    ]);
  });

  it("L2 G/F 镜像：中央 C 双谱表 + 高音 G + 低音 F = 4 题", () => {
    const pool = poolOf("L2");
    expect(pool).toHaveLength(4);
    expect(pool.map((q) => [q.midi, q.clef])).toEqual([
      [60, "treble"],
      [60, "bass"],
      [67, "treble"],
      [53, "bass"],
    ]);
  });

  it("L3 高低 C 外扩：中央 C 双谱表 + 高音 C + 低音 C = 4 题", () => {
    const pool = poolOf("L3");
    expect(pool).toHaveLength(4);
    expect(pool.map((q) => q.midi).sort()).toEqual([48, 60, 60, 72]);
  });

  it("L4 五地标混合 = 6 题（中央 C×2 + 其余四锚点）", () => {
    expect(poolOf("L4")).toHaveLength(6);
  });

  it("全部关卡：每题 midi 都是五地标之一，clef 在该地标声明的谱表内", () => {
    for (const level of plugin().manifest.levels) {
      for (const q of plugin().samplePool(level).map(asLandmark)) {
        const landmark = LANDMARKS.find((l) => l.midi === q.midi);
        expect(landmark, `midi ${q.midi} 应为地标音`).toBeDefined();
        expect(landmark!.clefs).toContain(q.clef);
      }
    }
  });

  it("pool 引用未知地标 id 时抛错（manifest 声明完整性）", () => {
    const fake = { ...plugin().manifest.levels[0], pool: { landmarkIds: ["nope"] } };
    expect(() => plugin().samplePool(fake)).toThrow(/未知地标音/);
  });
});

describe("judge：判定与行内反馈", () => {
  const middleCTreble: Question = { type: "landmark-note", midi: 60, clef: "treble" };

  it("弹对 → ok，反馈含 ✓ 与地标音教学名", () => {
    const j = plugin().judge(middleCTreble, midiAnswer(60));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("✓");
    expect(j.feedback).toContain("中央 C");
  });

  it("弹错到另一地标音 → 非 ok，反馈含「你弹了」+ 双方教学名", () => {
    const j = plugin().judge(middleCTreble, midiAnswer(67));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("你弹了");
    expect(j.feedback).toContain("高音 G");
    expect(j.feedback).toContain("中央 C");
  });

  it("弹错到非地标音 → 非 ok，反馈以音名报出（C#4）", () => {
    const j = plugin().judge(middleCTreble, midiAnswer(61));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("C#4");
  });

  it("同一 midi 在不同谱表出题判定一致（中央 C 高低音谱同音）", () => {
    const middleCBass: Question = { type: "landmark-note", midi: 60, clef: "bass" };
    expect(plugin().judge(middleCBass, midiAnswer(60)).ok).toBe(true);
  });

  it("非琴键作答 → 非 ok；未知题型 → 抛错", () => {
    expect(plugin().judge(middleCTreble, { kind: "choice", choiceId: "60", timestamp: 0 }).ok).toBe(
      false,
    );
    expect(() => plugin().judge({ type: "other" }, midiAnswer(60))).toThrow(/unexpected question type/);
  });

  it("浏览器两件在纯 TS seam 中调用即抛（防误用，#38 接入）", () => {
    expect(() => plugin().render(middleCTreble)).toThrow(/浏览器层/);
    return expect(plugin().interact()).rejects.toThrow(/浏览器层/);
  });
});

describe("整轮模拟（Round 引擎 × 地标音插件）", () => {
  it("L4 混合快答 12 题全对 → 通过、分母恒定、相邻不连出", () => {
    const level = plugin().manifest.levels[3]; // L4：题池 6 题
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(500);
      const q = asLandmark(issued.question);
      const judgement = round.submit(midiAnswer(q.midi));
      expect(judgement.ok).toBe(true);
      count++;
    }

    const result = round.settle();
    expect(count).toBe(12);
    expect(result.passed).toBe(true);
    expect(result.questionCount).toBe(12);
    expect(result.accuracy).toBe(1);
    expect(result.medianResponseMs).toBe(500); // ≤3s 快答阈值
    expect(result.nextMistakePool).toEqual([]);
    expect(hasAdjacentDuplicates(result.records)).toBe(false);
  });
});
