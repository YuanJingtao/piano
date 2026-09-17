import { describe, expect, it } from "vitest";
import "@/plugins"; // 触发生产静态注册（ADR 0007：注册表一行）
import { Round } from "@/domain/round";
import { getTechnique, listTechniques } from "@/domain/registry";
import type { AnswerEvent, Question } from "@/domain/types";
import { deriveCourseTree } from "@/lib/persistence/course-tree";
import {
  C_MAJOR_SCALE,
  FINGER_POSITIONS,
  diatonicTriads,
  enumerateFragments,
  noteNames,
  type BlockChordQuestion,
  type KeySequenceQuestion,
} from "@/plugins/five-finger-triads";
import { FakeClock, hasAdjacentDuplicates } from "../domain/helpers";

/**
 * seam 2：五指位置与三和弦插件纯逻辑两件（samplePool / judge）+ 生产注册链路 + 主线收口解锁。
 * 两种题型全为弹奏类多键作答（AnswerEvent keys 变体，#42 附加扩展）：
 * - key-sequence（L1/L2 级进片段、L4 分解和弦）：严格有序判定；
 * - block-chord（L3 原位三和弦）：集合判定，同按无先后语义。
 * 关卡口径：8 题 ≥85%，无中位约束、无限时（ADR 0001 弹奏类）。
 */

function asSequence(q: Question): KeySequenceQuestion {
  if (q.type !== "key-sequence" || !Array.isArray(q.midis) || !q.label) {
    throw new Error(`unexpected key-sequence question: ${JSON.stringify(q)}`);
  }
  return q as KeySequenceQuestion;
}

function asBlock(q: Question): BlockChordQuestion {
  if (q.type !== "block-chord" || !Array.isArray(q.midis) || !q.label) {
    throw new Error(`unexpected block-chord question: ${JSON.stringify(q)}`);
  }
  return q as BlockChordQuestion;
}

function keysAnswer(midis: readonly number[]): AnswerEvent {
  return { kind: "keys", midis, timestamp: 0 };
}

const plugin = () => getTechnique("five-finger-triads");

describe("五指三和弦插件 × 生产注册表", () => {
  it("import '@/plugins' 后可按 id 取到；注册序排在节奏阅读之后（主线末站 = 课程树呈现顺序）", () => {
    expect(plugin().manifest.id).toBe("five-finger-triads");
    const ids = listTechniques().map((p) => p.manifest.id);
    expect(ids.indexOf("five-finger-triads")).toBeGreaterThan(ids.indexOf("rhythm-reading"));
    // 主线五站收口 = 主线注册序末位（#44 起支线注册在主线之后，不再恒为全表末位）。
    const mainIds = listTechniques()
      .filter((p) => p.manifest.track === "main")
      .map((p) => p.manifest.id);
    expect(mainIds[mainIds.length - 1]).toBe("five-finger-triads");
  });

  it("manifest：主线末位、前置为节奏阅读、四关卡全部弹奏口径（8 题 ≥85%、无限时）", () => {
    const { manifest } = plugin();
    expect(manifest.track).toBe("main");
    expect(manifest.prerequisites).toEqual(["rhythm-reading"]);
    expect(manifest.levels.map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4"]);
    for (const level of manifest.levels) {
      expect(level.questionCount).toBe(8);
      expect(level.pass).toEqual({ minAccuracy: 0.85 }); // 弹奏类无中位响应约束
      expect(level.timeLimitMs).toBeUndefined(); // 限时模式仅节奏关卡（ADR 0003）
    }
  });
});

describe("samplePool：题池采样空间符合 manifest 声明", () => {
  const poolOf = (levelId: string) =>
    plugin().samplePool(plugin().manifest.levels.find((l) => l.id === levelId)!);

  it("L1 C 位置级进 = 6 题：[60..67] 内三音上行窗口 ×3 + 各自倒序 ×3，标签「C 位置级进」", () => {
    const pool = poolOf("L1").map(asSequence);
    expect(pool.map((q) => [...q.midis])).toEqual([
      [60, 62, 64],
      [62, 64, 65],
      [64, 65, 67],
      [64, 62, 60],
      [65, 64, 62],
      [67, 65, 64],
    ]);
    expect(pool.every((q) => q.label === "C 位置级进")).toBe(true);
  });

  it("L2 G 位置级进 = 6 题：同一枚举规律平移到 [67..74]，标签「G 位置级进」", () => {
    const pool = poolOf("L2").map(asSequence);
    expect(pool.map((q) => [...q.midis])).toEqual([
      [67, 69, 71],
      [69, 71, 72],
      [71, 72, 74],
      [71, 69, 67],
      [72, 71, 69],
      [74, 72, 71],
    ]);
    expect(pool.every((q) => q.label === "G 位置级进")).toBe(true);
  });

  it("L3 原位三和弦 = 6 题：C 大调顺阶六个柱式和弦（C/Dm/Em/F/G/Am），大小组别与音程一致", () => {
    const pool = poolOf("L3").map(asBlock);
    expect(pool.map((q) => [...q.midis])).toEqual([
      [60, 64, 67],
      [62, 65, 69],
      [64, 67, 71],
      [65, 69, 72],
      [67, 71, 74],
      [69, 72, 76],
    ]);
    expect(pool.map((q) => q.label)).toEqual([
      "C 大三和弦",
      "D 小三和弦",
      "E 小三和弦",
      "F 大三和弦",
      "G 大三和弦",
      "A 小三和弦",
    ]);
    // 大三 = 根音到三音两个全音（4 半音）；小三 = 全音 + 半音（3 半音）
    for (const q of pool) {
      const isMajor = q.label.includes("大");
      expect(q.midis[1] - q.midis[0], q.label).toBe(isMajor ? 4 : 3);
      expect(q.midis[2] - q.midis[1]).toBe(isMajor ? 3 : 4); // 五音恒为纯五度（7 半音）
      expect(q.midis[2] - q.midis[0]).toBe(7);
    }
  });

  it("L4 同形分解和弦 = 6 题：根-三-五-三（do-mi-so-mi），与 L3 同一组音、标签加「分解」", () => {
    const pool = poolOf("L4").map(asSequence);
    expect(pool.map((q) => [...q.midis])).toEqual([
      [60, 64, 67, 64],
      [62, 65, 69, 65],
      [64, 67, 71, 67],
      [65, 69, 72, 69],
      [67, 71, 74, 71],
      [69, 72, 76, 72],
    ]);
    const blockLabels = poolOf("L3").map(asBlock).map((q) => q.label);
    expect(pool.map((q) => q.label)).toEqual(blockLabels.map((label) => `${label}分解`));
  });

  it("全部题目：音高均落在 C 大调音阶取材范围内，序列长度与题型口径一致", () => {
    const inScale = (midi: number) => (C_MAJOR_SCALE as readonly number[]).includes(midi);
    for (const level of plugin().manifest.levels) {
      for (const q of plugin().samplePool(level)) {
        const midis = (q as KeySequenceQuestion | BlockChordQuestion).midis;
        expect(midis.every(inScale), JSON.stringify(midis)).toBe(true);
        if (q.type === "block-chord") expect(midis).toHaveLength(3);
        else expect([3, 4]).toContain(midis.length); // 级进三音 / 分解四音
      }
    }
  });
});

describe("教学常量：五指位置与顺阶三和弦", () => {
  it("C/G 位置一指一键：C 位置 = C4–G4，G 位置 = G4–D5（同手型平移）", () => {
    expect(FINGER_POSITIONS.C.scale).toEqual([60, 62, 64, 65, 67]);
    expect(FINGER_POSITIONS.G.scale).toEqual([67, 69, 71, 72, 74]);
  });

  it("enumerateFragments：每个位置 6 个片段，下行片段 = 上行倒序", () => {
    for (const id of ["C", "G"] as const) {
      const fragments = enumerateFragments(id);
      expect(fragments).toHaveLength(6);
      expect(fragments.slice(3)).toEqual(fragments.slice(0, 3).map((f) => [...f].reverse()));
    }
  });

  it("diatonicTriads：六个顺阶三和弦，大三恰为 C/F/G、小三恰为 D/E/A（C 大调口径）", () => {
    const triads = diatonicTriads();
    expect(triads).toHaveLength(6);
    expect(triads.filter((t) => t.quality === "major").map((t) => t.label)).toEqual([
      "C 大三和弦",
      "F 大三和弦",
      "G 大三和弦",
    ]);
    expect(triads.filter((t) => t.quality === "minor").map((t) => t.label)).toEqual([
      "D 小三和弦",
      "E 小三和弦",
      "A 小三和弦",
    ]);
  });

  it("noteNames：反馈文案音名串（科学音高记名，- 连接）", () => {
    expect(noteNames([60, 64, 67])).toBe("C4-E4-G4");
    expect(noteNames([67, 71, 74])).toBe("G4-B4-D5");
  });
});

describe("judge：判定与行内反馈", () => {
  const cMajor: Question = { type: "block-chord", midis: [60, 64, 67], label: "C 大三和弦" };
  const cdeUp: Question = { type: "key-sequence", midis: [60, 62, 64], label: "C 位置级进" };

  it("柱式和弦：同按无先后——乱序按出同一组音 → ok，反馈含 ✓ 与和弦名", () => {
    for (const played of [
      [60, 64, 67],
      [67, 60, 64],
      [64, 67, 60],
    ]) {
      const j = plugin().judge(cMajor, keysAnswer(played));
      expect(j.ok, JSON.stringify(played)).toBe(true);
      expect(j.feedback).toContain("✓");
      expect(j.feedback).toContain("C 大三和弦");
      expect(j.feedback).toContain("C4-E4-G4");
    }
  });

  it("柱式和弦：缺音 / 多音 / 换音 → 非 ok，反馈报出双方音名与和弦名", () => {
    const wrong = plugin().judge(cMajor, keysAnswer([60, 64])); // 缺五音
    expect(wrong.ok).toBe(false);
    expect(wrong.feedback).toContain("你弹了 C4-E4");
    expect(wrong.feedback).toContain("正确是 C4-E4-G4");
    expect(wrong.feedback).toContain("C 大三和弦");

    expect(plugin().judge(cMajor, keysAnswer([60, 64, 67, 71])).ok).toBe(false); // 多按一键
    expect(plugin().judge(cMajor, keysAnswer([60, 63, 67])).ok).toBe(false); // 三音按成小三
  });

  it("键序列：严格有序——顺序全对 → ok；同集合换序 → 非 ok", () => {
    const ok = plugin().judge(cdeUp, keysAnswer([60, 62, 64]));
    expect(ok.ok).toBe(true);
    expect(ok.feedback).toContain("✓");
    expect(ok.feedback).toContain("C4-D4-E4");

    const reordered = plugin().judge(cdeUp, keysAnswer([64, 62, 60])); // 弹成下行
    expect(reordered.ok).toBe(false);
    expect(reordered.feedback).toContain("你弹了 E4-D4-C4");
    expect(reordered.feedback).toContain("正确是 C4-D4-E4");
  });

  it("键序列：长度不符（少弹 / 多弹）→ 非 ok", () => {
    expect(plugin().judge(cdeUp, keysAnswer([60, 62])).ok).toBe(false);
    expect(plugin().judge(cdeUp, keysAnswer([60, 62, 64, 65])).ok).toBe(false);
  });

  it("分解和弦：根-三-五-三 全序判定", () => {
    const broken: Question = {
      type: "key-sequence",
      midis: [60, 64, 67, 64],
      label: "C 大三和弦分解",
    };
    expect(plugin().judge(broken, keysAnswer([60, 64, 67, 64])).ok).toBe(true);
    expect(plugin().judge(broken, keysAnswer([60, 64, 67])).ok).toBe(false); // 少回落三音
  });

  it("非多键作答（midi / choice 变体）→ 非 ok「✗ 非多键作答」；未知题型 → 抛错", () => {
    expect(plugin().judge(cMajor, { kind: "midi", midi: 60, velocity: 0.8, timestamp: 0 }).feedback).toBe(
      "✗ 非多键作答",
    );
    expect(plugin().judge(cdeUp, { kind: "choice", choiceId: "60", timestamp: 0 }).ok).toBe(false);
    expect(() => plugin().judge({ type: "other" }, keysAnswer([60]))).toThrow(
      /unexpected question type/,
    );
  });
});

describe("主线收口解锁（节奏阅读毕业 → 五指三和弦开放）", () => {
  const techniques = [getTechnique("rhythm-reading").manifest, plugin().manifest];
  const rhythmPassed = (levelId: string) => ({
    techniqueId: "rhythm-reading",
    levelId,
    passed: true,
    best: null,
  });

  it("节奏阅读未毕业：五指三和弦锁定", () => {
    const tree = deriveCourseTree(techniques, [rhythmPassed("L1"), rhythmPassed("L2")]);
    expect(tree.find((t) => t.id === "five-finger-triads")!.unlocked).toBe(false);
  });

  it("节奏阅读三关全过：五指三和弦解锁、首关即开；四关全过 = 技巧毕业（主线首版路径走完）", () => {
    const unlocked = deriveCourseTree(techniques, [
      rhythmPassed("L1"),
      rhythmPassed("L2"),
      rhythmPassed("L3"),
    ]);
    const five = unlocked.find((t) => t.id === "five-finger-triads")!;
    expect(five.unlocked).toBe(true);
    expect(five.levels[0].unlocked).toBe(true);
    expect(five.graduated).toBe(false);

    const graduated = deriveCourseTree(
      techniques,
      [
        ...["L1", "L2", "L3", "L4"].map((levelId) => ({
          techniqueId: "five-finger-triads",
          levelId,
          passed: true,
          best: null,
        })),
      ],
    );
    expect(graduated.find((t) => t.id === "five-finger-triads")!.graduated).toBe(true);
  });
});

describe("整轮模拟（Round 引擎 × 五指三和弦插件）", () => {
  /** 确定性乱序：柱式和弦按「五-根-三」顺序同按（集合判定应判对）。 */
  function shuffled(midis: readonly number[]): number[] {
    return [midis[2], midis[0], midis[1]];
  }

  it("L3 柱式和弦 8 题：乱序按法全对 → 通过、分母恒定、相邻不连出", () => {
    const level = plugin().manifest.levels[2];
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(3000);
      const q = asBlock(issued.question);
      expect(round.submit(keysAnswer(shuffled(q.midis))).ok, q.label).toBe(true);
      count++;
    }

    const result = round.settle();
    expect(count).toBe(8);
    expect(result.passed).toBe(true);
    expect(result.questionCount).toBe(8);
    expect(result.accuracy).toBe(1);
    expect(result.nextMistakePool).toEqual([]);
    expect(hasAdjacentDuplicates(result.records)).toBe(false);
  });

  it("L1 级进 8 题全对 → 通过（弹奏口径慢响应不受限，keys 变体经引擎全程不透明）", () => {
    const level = plugin().manifest.levels[0];
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(5000); // 弹奏关卡无响应时限
      const q = asSequence(issued.question);
      round.submit(keysAnswer(q.midis));
      count++;
    }

    const result = round.settle();
    expect(count).toBe(8);
    expect(result.passed).toBe(true);
    expect(hasAdjacentDuplicates(result.records)).toBe(false);
  });

  it("L4 分解和弦：错一题（柱式惯性同按三音、少回落）→ 7/8 = 87.5% 仍过线，错题入错题池", () => {
    const level = plugin().manifest.levels[3];
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(2000);
      const q = asSequence(issued.question);
      if (count === 0) {
        // 只按根-三-五（柱式惯性），漏掉回落的三音 → 判错
        expect(round.submit(keysAnswer(q.midis.slice(0, 3))).ok).toBe(false);
      } else {
        round.submit(keysAnswer(q.midis));
      }
      count++;
    }

    const result = round.settle();
    expect(result.passed).toBe(true); // 7/8 = 0.875 ≥ 0.85
    expect(result.accuracy).toBe(7 / 8);
    expect(result.records.filter((r) => !r.ok)).toHaveLength(1); // 错题留痕（落库为 AnswerRecord）
    expect(result.nextMistakePool).toEqual([]); // 达标即弃：错题池仅未过线轮次带入下一轮
  });
});
