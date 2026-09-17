import { describe, expect, it } from "vitest";
import "@/plugins"; // 触发生产静态注册（ADR 0007：注册表一行）
import { Round } from "@/domain/round";
import { getTechnique, listTechniques } from "@/domain/registry";
import type { AnswerEvent, Question } from "@/domain/types";
import { isBlackKey } from "@/lib/music/midi";
import { deriveCourseTree } from "@/lib/persistence/course-tree";
import {
  ANCHOR_RANGE,
  FULL_RANGE,
  cuePrompt,
  targetOfCue,
  type KeyboardGeoQuestion,
} from "@/plugins/keyboard-geography/geography";
import { FakeClock, hasAdjacentDuplicates } from "../domain/helpers";

/**
 * seam 2：键盘地理插件纯逻辑两件（samplePool / judge）+ 生产注册链路 + 主线解锁链。
 * 题型「键盘找键」（keyboard-geo）：不看谱——题目锚定键盘图（cue），作答 = 按出目标白键。
 * 关卡口径源自 #4 决议：L1 黑键组 / L2 天然半音为弹奏类（8 题 ≥85%），L3 音名快答为快答类。
 */

function asGeo(q: Question): KeyboardGeoQuestion {
  if (q.type !== "keyboard-geo" || typeof q.midi !== "number" || !q.cue) {
    throw new Error(`unexpected keyboard-geo question: ${JSON.stringify(q)}`);
  }
  return q as KeyboardGeoQuestion;
}

function midiAnswer(midi: number): AnswerEvent {
  return { kind: "midi", midi, velocity: 0.8, timestamp: 0 };
}

const plugin = () => getTechnique("keyboard-geography");

describe("键盘地理插件 × 生产注册表", () => {
  it("import '@/plugins' 后可按 id 取到；注册序排在地标音之前（主线教学顺序 = 课程树呈现顺序）", () => {
    expect(plugin().manifest.id).toBe("keyboard-geography");
    const ids = listTechniques().map((p) => p.manifest.id);
    expect(ids).toContain("keyboard-geography");
    expect(ids.indexOf("keyboard-geography")).toBeLessThan(ids.indexOf("landmark-notes"));
  });

  it("manifest：主线首位、无前置、三关卡——L1/L2 弹奏口径（8 题 ≥85%）、L3 快答口径（12 题 ≥90% 中位 ≤3s）", () => {
    const { manifest } = plugin();
    expect(manifest.track).toBe("main");
    expect(manifest.prerequisites).toEqual([]);
    expect(manifest.levels.map((l) => l.id)).toEqual(["L1", "L2", "L3"]);
    for (const level of manifest.levels.slice(0, 2)) {
      expect(level.questionCount).toBe(8);
      expect(level.pass).toEqual({ minAccuracy: 0.85 }); // 弹奏类无中位响应约束
      expect(level.timeLimitMs).toBeUndefined(); // 限时模式仅节奏关卡（ADR 0003）
    }
    const l3 = manifest.levels[2];
    expect(l3.questionCount).toBe(12);
    expect(l3.pass).toEqual({ minAccuracy: 0.9, maxMedianResponseMs: 3000 });
  });

  it("地标音 manifest 前置已改回键盘地理（#37 预留位，主线线性解锁）", () => {
    expect(getTechnique("landmark-notes").manifest.prerequisites).toEqual(["keyboard-geography"]);
  });
});

describe("samplePool：题池采样空间符合 manifest 声明", () => {
  const poolOf = (levelId: string) =>
    plugin()
      .samplePool(plugin().manifest.levels.find((l) => l.id === levelId)!)
      .map(asGeo);

  it("L1 黑键组锚点 = 10 题：C3–C5 内 2 组×(C/D) + 3 组×(F/G/A)，音名恰为 C/D/F/G/A", () => {
    const pool = poolOf("L1");
    expect(pool.map((q) => q.midi)).toEqual([48, 50, 53, 55, 57, 60, 62, 65, 67, 69]);
    const letters = [...new Set(pool.map((q) => q.midi % 12))].sort((a, b) => a - b);
    expect(letters).toEqual([0, 2, 5, 7, 9]); // C D F G A
    expect(pool.every((q) => q.cue.kind === "black-group")).toBe(true);
  });

  it("L2 天然半音 = 8 题：C3–C5 内四对白键 × 问较低/较高，目标音恰为 E/F/B/C", () => {
    const pool = poolOf("L2");
    expect(pool.map((q) => q.midi)).toEqual([52, 53, 59, 60, 64, 65, 71, 72]);
    const letters = [...new Set(pool.map((q) => q.midi % 12))].sort((a, b) => a - b);
    expect(letters).toEqual([0, 4, 5, 11]); // C E F B
    expect(pool.every((q) => q.cue.kind === "semitone-pair")).toBe(true);
  });

  it("L3 音名快答 = 全键盘 C3–C6 全部 22 个白键各一题，七个音名齐全", () => {
    const pool = poolOf("L3");
    expect(pool).toHaveLength(22);
    expect(pool.every((q) => !isBlackKey(q.midi) && q.cue.kind === "note-name")).toBe(true);
    expect(pool[0].midi).toBe(FULL_RANGE.lowestMidi);
    expect(pool[pool.length - 1].midi).toBe(FULL_RANGE.highestMidi);
    expect(new Set(pool.map((q) => q.midi % 12)).size).toBe(7);
  });

  it("全部题目：目标为白键且在声明音域内；锚点题 cue 推导与 midi 一致", () => {
    for (const level of plugin().manifest.levels) {
      const spec = level.pool as { lowestMidi: number; highestMidi: number };
      for (const q of plugin().samplePool(level).map(asGeo)) {
        expect(isBlackKey(q.midi), `midi ${q.midi} 应为白键`).toBe(false);
        expect(q.midi).toBeGreaterThanOrEqual(spec.lowestMidi);
        expect(q.midi).toBeLessThanOrEqual(spec.highestMidi);
        if (q.cue.kind !== "note-name") {
          expect(targetOfCue(q.cue), JSON.stringify(q.cue)).toBe(q.midi);
        }
      }
    }
    expect(ANCHOR_RANGE).toEqual({ lowestMidi: 48, highestMidi: 72 });
  });

  it("pool 引用未知题池种类 / 缺少种类声明时抛错（manifest 声明完整性）", () => {
    const fake = {
      ...plugin().manifest.levels[0],
      pool: { kind: "nope", lowestMidi: 48, highestMidi: 72 },
    };
    expect(() => plugin().samplePool(fake)).toThrow(/未知题池种类/);
    const empty = { ...plugin().manifest.levels[0], pool: {} };
    expect(() => plugin().samplePool(empty)).toThrow(/缺少题池种类声明/);
  });
});

describe("judge：判定与行内反馈", () => {
  const c4ByGroup: Question = {
    type: "keyboard-geo",
    midi: 60,
    cue: { kind: "black-group", groupLowestMidi: 61, groupSize: 2, relation: "left" },
  };
  const e3ByPair: Question = {
    type: "keyboard-geo",
    midi: 52,
    cue: { kind: "semitone-pair", lowerMidi: 52, ask: "lower" },
  };
  const g4ByName: Question = { type: "keyboard-geo", midi: 67, cue: { kind: "note-name" } };

  it("按对 → ok，反馈含 ✓ 与音名（C4）", () => {
    const j = plugin().judge(c4ByGroup, midiAnswer(60));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("✓");
    expect(j.feedback).toContain("C4");
  });

  it("黑键组题按错 → 非 ok，反馈含双方音名 + 规则口诀（2 组左边是 C）", () => {
    const j = plugin().judge(c4ByGroup, midiAnswer(62));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("你弹了 D4");
    expect(j.feedback).toContain("正确是 C4");
    expect(j.feedback).toContain("2 个黑键组左边的白键是 C");
  });

  it("天然半音题按错 → 非 ok，规则口诀报出 E-F / B-C", () => {
    const j = plugin().judge(e3ByPair, midiAnswer(53));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("中间没有黑键的白键对只有 E-F 和 B-C");
  });

  it("音名快答题按错 → 非 ok，不追加规则提示", () => {
    const j = plugin().judge(g4ByName, midiAnswer(60));
    expect(j.ok).toBe(false);
    expect(j.feedback).toBe("✗ 你弹了 C4，正确是 G4");
  });

  it("非琴键作答 → 非 ok；未知题型 → 抛错", () => {
    expect(plugin().judge(c4ByGroup, { kind: "choice", choiceId: "60", timestamp: 0 }).ok).toBe(
      false,
    );
    expect(() => plugin().judge({ type: "other" }, midiAnswer(60))).toThrow(
      /unexpected question type/,
    );
  });
});

describe("cuePrompt：题面提示文字（stage 消费的纯函数）", () => {
  it("三种锚定形态各自报题；音名题带科学音高记名", () => {
    expect(
      cuePrompt(60, { kind: "black-group", groupLowestMidi: 61, groupSize: 2, relation: "left" }),
    ).toContain("2 个黑键组");
    expect(
      cuePrompt(67, { kind: "black-group", groupLowestMidi: 66, groupSize: 3, relation: "inner-1" }),
    ).toContain("3 个黑键组");
    expect(cuePrompt(52, { kind: "semitone-pair", lowerMidi: 52, ask: "lower" })).toContain(
      "天然半音",
    );
    expect(cuePrompt(67, { kind: "note-name" })).toContain("G4");
  });
});

describe("主线解锁链（AC：键盘地理毕业后解锁地标音系统）", () => {
  const techniques = [plugin().manifest, getTechnique("landmark-notes").manifest];
  const passed = (levelId: string) => ({
    techniqueId: "keyboard-geography",
    levelId,
    passed: true,
    best: null,
  });

  it("全新进度：键盘地理即开（主线首位无前置），地标音锁定", () => {
    const tree = deriveCourseTree(techniques, []);
    const geo = tree.find((t) => t.id === "keyboard-geography")!;
    const landmark = tree.find((t) => t.id === "landmark-notes")!;
    expect(geo.unlocked).toBe(true);
    expect(geo.levels[0].unlocked).toBe(true);
    expect(geo.graduated).toBe(false);
    expect(landmark.unlocked).toBe(false);
    expect(landmark.graduated).toBe(false);
  });

  it("部分通过不解锁；三关全过（技巧毕业）后地标音解锁、其首关即开", () => {
    const partial = deriveCourseTree(techniques, [passed("L1"), passed("L2")]);
    expect(partial.find((t) => t.id === "keyboard-geography")!.graduated).toBe(false);
    expect(partial.find((t) => t.id === "landmark-notes")!.unlocked).toBe(false);

    const full = deriveCourseTree(techniques, [passed("L1"), passed("L2"), passed("L3")]);
    const geo = full.find((t) => t.id === "keyboard-geography")!;
    const landmark = full.find((t) => t.id === "landmark-notes")!;
    expect(geo.graduated).toBe(true);
    expect(landmark.unlocked).toBe(true);
    expect(landmark.levels[0].unlocked).toBe(true);
  });
});

describe("整轮模拟（Round 引擎 × 键盘地理插件）", () => {
  it("L3 快答 12 题全对 → 通过、分母恒定、相邻不连出", () => {
    const level = plugin().manifest.levels[2];
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(500);
      const q = asGeo(issued.question);
      expect(round.submit(midiAnswer(q.midi)).ok).toBe(true);
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

  it("L1 弹奏 8 题全对 → 通过（≥85% 口径，慢响应不受中位约束）", () => {
    const level = plugin().manifest.levels[0];
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(4000); // 弹奏关卡无响应时限：每题 4s 也照常通过
      const q = asGeo(issued.question);
      round.submit(midiAnswer(q.midi));
      count++;
    }

    const result = round.settle();
    expect(count).toBe(8);
    expect(result.passed).toBe(true);
    expect(hasAdjacentDuplicates(result.records)).toBe(false);
  });
});
