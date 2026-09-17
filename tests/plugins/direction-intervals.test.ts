import { describe, expect, it } from "vitest";
import "@/plugins"; // 触发生产静态注册（ADR 0007：注册表一行）
import { Round } from "@/domain/round";
import { getTechnique, listTechniques } from "@/domain/registry";
import type { AnswerEvent, Question } from "@/domain/types";
import { isBlackKey } from "@/lib/music/midi";
import { LANDMARKS } from "@/plugins/landmark-notes/landmarks";
import {
  CONTOURS,
  diatonicDistance,
  diatonicIndex,
  diatonicShift,
  inReadableRange,
  READABLE_RANGE,
} from "@/plugins/direction-intervals/intervals";
import { FakeClock, hasAdjacentDuplicates } from "../domain/helpers";

/**
 * seam 2：方向与音程插件纯逻辑两件（samplePool / judge）+ 生产注册链路（工单 #40）。
 * 题型「旋律组末音」：题目 = 锚点地标音出发的二音音程对 / 三音轮廓（clef + notes），
 * 作答 = 键盘弹出末音。读关系不读名：目标音全部由锚点 + 谱面形状推算。
 */

type MelodyQuestion = Question & { type: "interval-melody"; clef: string; notes: number[] };

function asMelody(q: Question): MelodyQuestion {
  if (
    q.type !== "interval-melody" ||
    !Array.isArray(q.notes) ||
    typeof q.clef !== "string"
  ) {
    throw new Error(`unexpected interval-melody question: ${JSON.stringify(q)}`);
  }
  return q as MelodyQuestion;
}

function midiAnswer(midi: number): AnswerEvent {
  return { kind: "midi", midi, velocity: 0.8, timestamp: 0 };
}

const plugin = () => getTechnique("direction-intervals");

const poolOf = (levelId: string) =>
  plugin()
    .samplePool(plugin().manifest.levels.find((l) => l.id === levelId)!)
    .map(asMelody);

describe("方向与音程插件 × 生产注册表", () => {
  it("import '@/plugins' 后可按 id 取到；与地标音插件共存于生产注册表", () => {
    expect(plugin().manifest.id).toBe("direction-intervals");
    const ids = listTechniques().map((p) => p.manifest.id);
    expect(ids).toContain("direction-intervals");
    expect(ids).toContain("landmark-notes");
  });

  it("manifest：主线、前置地标音、四关卡全部快答口径（12 题 / ≥90% / 中位 ≤3s、无限时）", () => {
    const { manifest } = plugin();
    expect(manifest.track).toBe("main");
    expect(manifest.prerequisites).toEqual(["landmark-notes"]);
    expect(manifest.levels.map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4"]);
    for (const level of manifest.levels) {
      expect(level.questionCount).toBe(12);
      expect(level.pass).toEqual({ minAccuracy: 0.9, maxMedianResponseMs: 3000 });
      expect(level.timeLimitMs).toBeUndefined(); // 限时模式仅节奏关卡（ADR 0003）
    }
  });
});

describe("全音阶移位（题池生成的数学底座）", () => {
  it("diatonicShift：白键步进跨越八度边界（B3 上一步 = C4，C4 下一步 = D4）", () => {
    expect(diatonicShift(59, 1)).toBe(60); // B3 → C4：半音步进也是「挪一格」
    expect(diatonicShift(60, 1)).toBe(62); // C4 → D4
    expect(diatonicShift(60, -1)).toBe(59); // C4 → B3
    expect(diatonicShift(67, 4)).toBe(74); // G4 上五度 → D5
    expect(diatonicShift(60, 7)).toBe(72); // C4 上八度 → C5
  });

  it("diatonicDistance：E4→F4 半音也是 1 步（二度读形状不读半音数）", () => {
    expect(diatonicDistance(64, 65)).toBe(1);
    expect(diatonicDistance(65, 64)).toBe(-1);
    expect(diatonicDistance(60, 72)).toBe(7);
  });

  it("黑键没有全音阶位置：diatonicIndex 抛错（首版内容锁定 C 大调白键）", () => {
    expect(() => diatonicIndex(61)).toThrow(RangeError);
  });
});

describe("samplePool：题池采样空间符合 manifest 声明", () => {
  it("L1 二度/重复 = 17 题：锚点六谱表位 × {上二度, 下二度, 重复}，低音 C 下二度 B2 超可读范围被滤除", () => {
    const pool = poolOf("L1");
    expect(pool).toHaveLength(17);
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [67, 69] }); // 高音 G 上二度
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [67, 65] }); // 高音 G 下二度
    expect(pool).toContainEqual({ type: "interval-melody", clef: "bass", notes: [60, 60] }); // 中央 C 同音重复（低音谱）
    expect(pool).not.toContainEqual({ type: "interval-melody", clef: "bass", notes: [48, 47] }); // B2 低于低音谱可读范围
  });

  it("L2 三度/五度 = 18 题：全部二音组，度数 ∈ {三度, 五度}", () => {
    const pool = poolOf("L2");
    expect(pool).toHaveLength(18);
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [67, 71] }); // G→B 三度（线到线）
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [60, 67] }); // C→G 五度
    for (const q of pool) {
      expect(q.notes).toHaveLength(2);
      expect(Math.abs(diatonicDistance(q.notes[0], q.notes[1]))).toBeGreaterThanOrEqual(2);
      expect(Math.abs(diatonicDistance(q.notes[0], q.notes[1]))).toBeLessThanOrEqual(4);
    }
  });

  it("L3 八度与混合 = 23 题：含五组可读八度，度数 ∈ {三度, 五度, 八度}", () => {
    const pool = poolOf("L3");
    expect(pool).toHaveLength(23);
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [60, 72] }); // 中央 C → 高音 C
    expect(pool).toContainEqual({ type: "interval-melody", clef: "bass", notes: [48, 60] }); // 低音 C → 中央 C
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [67, 79] }); // 高音 G → G5
    expect(pool).not.toContainEqual({ type: "interval-melody", clef: "bass", notes: [53, 41] }); // F2 超可读范围
    for (const q of pool) {
      const d = Math.abs(diatonicDistance(q.notes[0], q.notes[1]));
      expect([2, 4, 7]).toContain(d);
    }
  });

  it("L4 简单轮廓 = 28 题：全部三音组，命中六个轮廓模板之一", () => {
    const pool = poolOf("L4");
    expect(pool).toHaveLength(28);
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [67, 69, 71] }); // 级进上行 ×2
    expect(pool).toContainEqual({ type: "interval-melody", clef: "treble", notes: [67, 71, 69] }); // 上跳三度 · 回填
    for (const q of pool) {
      expect(q.notes).toHaveLength(3);
      const base = diatonicIndex(q.notes[0]);
      const offsets = q.notes.map((m) => diatonicIndex(m) - base);
      const matched = CONTOURS.some(
        (c) => c.offsets.length === 3 && c.offsets.every((o, i) => o === offsets[i]),
      );
      expect(matched, `轮廓 ${JSON.stringify(offsets)} 应命中模板`).toBe(true);
    }
  });

  it("全部关卡：首音是地标锚点（读关系不读名的前提）、全白键、逐音落在谱表可读范围内", () => {
    for (const level of plugin().manifest.levels) {
      for (const q of plugin().samplePool(level).map(asMelody)) {
        const clef = q.clef as "treble" | "bass";
        const anchor = LANDMARKS.find((l) => l.midi === q.notes[0]);
        expect(anchor, `首音 ${q.notes[0]} 应为地标音`).toBeDefined();
        expect(anchor!.clefs).toContain(clef);
        for (const midi of q.notes) {
          expect(isBlackKey(midi), `${midi} 应为白键`).toBe(false);
          expect(inReadableRange(clef, midi), `${midi} 应在 ${clef} 可读范围`).toBe(true);
        }
      }
    }
  });

  it("可读范围自身落在虚拟钢琴默认音域 C3–C6 内（作答可达性）", () => {
    for (const range of Object.values(READABLE_RANGE)) {
      expect(range.min).toBeGreaterThanOrEqual(48);
      expect(range.max).toBeLessThanOrEqual(84);
    }
  });

  it("pool 引用未知锚点 / 关系 / 模板时抛错（manifest 声明完整性）", () => {
    const base = plugin().manifest.levels[0];
    expect(() => plugin().samplePool({ ...base, pool: { anchors: ["nope"] } })).toThrow(/未知地标音/);
    expect(() =>
      plugin().samplePool({ ...base, pool: { anchors: ["middle-c"], relations: ["nope"] } }),
    ).toThrow(/未知音程关系/);
    expect(() =>
      plugin().samplePool({ ...base, pool: { anchors: ["middle-c"], contours: ["nope"] } }),
    ).toThrow(/未知轮廓模板/);
  });
});

describe("judge：判定与行内反馈（关系词汇入反馈）", () => {
  it("音程对弹对末音 → ok，反馈含 ✓ + 音名 + 关系（上二度）", () => {
    const q: Question = { type: "interval-melody", clef: "treble", notes: [67, 69] };
    const j = plugin().judge(q, midiAnswer(69));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("✓");
    expect(j.feedback).toContain("A4");
    expect(j.feedback).toContain("上二度");
  });

  it("弹错 → 非 ok，反馈含「你弹了」+ 双方音名 + 关系", () => {
    const q: Question = { type: "interval-melody", clef: "treble", notes: [67, 71] };
    const j = plugin().judge(q, midiAnswer(69));
    expect(j.ok).toBe(false);
    expect(j.feedback).toContain("你弹了 A4");
    expect(j.feedback).toContain("正确是 B4");
    expect(j.feedback).toContain("上三度");
  });

  it("同音重复题：弹锚点音即对，反馈含「同音重复」", () => {
    const q: Question = { type: "interval-melody", clef: "bass", notes: [60, 60] };
    const j = plugin().judge(q, midiAnswer(60));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("同音重复");
  });

  it("八度题反馈报「八度上」（下行为「八度下」）", () => {
    const up: Question = { type: "interval-melody", clef: "treble", notes: [60, 72] };
    expect(plugin().judge(up, midiAnswer(72)).feedback).toContain("八度上");
    const down: Question = { type: "interval-melody", clef: "treble", notes: [72, 60] };
    expect(plugin().judge(down, midiAnswer(60)).feedback).toContain("八度下");
  });

  it("轮廓题反馈报模板教学名（上跳三度 · 回填）", () => {
    const q: Question = { type: "interval-melody", clef: "treble", notes: [67, 71, 69] };
    const j = plugin().judge(q, midiAnswer(69));
    expect(j.ok).toBe(true);
    expect(j.feedback).toContain("A4");
    expect(j.feedback).toContain("上跳三度 · 回填");
  });

  it("非琴键作答 → 非 ok；未知题型 → 抛错", () => {
    const q: Question = { type: "interval-melody", clef: "treble", notes: [67, 69] };
    expect(plugin().judge(q, { kind: "choice", choiceId: "69", timestamp: 0 }).ok).toBe(false);
    expect(() => plugin().judge({ type: "other" }, midiAnswer(60))).toThrow(
      /unexpected question type/,
    );
  });
});

describe("整轮模拟（Round 引擎 × 方向与音程插件）", () => {
  it("L1 快答 12 题全对 → 通过、分母恒定、相邻不连出", () => {
    const level = plugin().manifest.levels[0];
    const clock = new FakeClock();
    const round = new Round({ level, plugin: plugin(), now: clock.now });

    let count = 0;
    for (let issued = round.next(); issued; issued = round.next()) {
      clock.advance(500);
      const q = asMelody(issued.question);
      const judgement = round.submit(midiAnswer(q.notes[q.notes.length - 1]));
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
