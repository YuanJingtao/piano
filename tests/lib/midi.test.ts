import { describe, expect, it } from "vitest";

import {
  buildKeyboardGeometry,
  isBlackKey,
  midiToFrequency,
  midiToNoteName,
  midiToVexKey,
} from "@/lib/music/midi";

describe("midiToNoteName：MIDI note number → 音名（行内反馈展示）", () => {
  it("中央 C 及各地标音", () => {
    expect(midiToNoteName(60)).toBe("C4");
    expect(midiToNoteName(67)).toBe("G4");
    expect(midiToNoteName(53)).toBe("F3");
    expect(midiToNoteName(72)).toBe("C5");
    expect(midiToNoteName(48)).toBe("C3");
  });

  it("黑键用升号拼写", () => {
    expect(midiToNoteName(61)).toBe("C#4");
    expect(midiToNoteName(70)).toBe("A#4");
  });

  it("八度以科学音高记名（C4 = 中央 C = MIDI 60）", () => {
    expect(midiToNoteName(59)).toBe("B3");
    expect(midiToNoteName(0)).toBe("C-1");
    expect(midiToNoteName(127)).toBe("G9");
  });

  it("越界与非整数拒绝", () => {
    expect(() => midiToNoteName(128)).toThrow(RangeError);
    expect(() => midiToNoteName(-1)).toThrow(RangeError);
    expect(() => midiToNoteName(60.5)).toThrow(RangeError);
  });
});

describe("midiToFrequency", () => {
  it("A4 = 440Hz，半音按十二平均律", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(60)).toBeCloseTo(440 * Math.pow(2, -9 / 12), 6);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
  });
});

describe("isBlackKey", () => {
  it("按 pitch class 判定黑键", () => {
    expect(isBlackKey(60)).toBe(false); // C
    expect(isBlackKey(61)).toBe(true); // C#
    expect(isBlackKey(64)).toBe(false); // E
    expect(isBlackKey(65)).toBe(false); // F（E-F 无黑键）
    expect(isBlackKey(66)).toBe(true); // F#
    expect(isBlackKey(71)).toBe(false); // B
    expect(isBlackKey(72)).toBe(false); // C（B-C 无黑键）
  });
});

describe("midiToVexKey：MIDI → VexFlow key 适配（音高唯一真源在 MIDI）", () => {
  it("白键映射为 音名小写/八度", () => {
    expect(midiToVexKey(60)).toEqual({ key: "c/4" });
    expect(midiToVexKey(67)).toEqual({ key: "g/4" });
    expect(midiToVexKey(53)).toEqual({ key: "f/3" });
    expect(midiToVexKey(72)).toEqual({ key: "c/5" });
  });

  it("黑键返回 key + 升号，由渲染层显式加 Accidental", () => {
    expect(midiToVexKey(61)).toEqual({ key: "c/4", accidental: "#" });
    expect(midiToVexKey(70)).toEqual({ key: "a/4", accidental: "#" });
  });

  it("八度边界：B3 → b/3，C4 → c/4", () => {
    expect(midiToVexKey(59)).toEqual({ key: "b/3" });
    expect(midiToVexKey(60)).toEqual({ key: "c/4" });
  });
});

describe("buildKeyboardGeometry：虚拟钢琴与键盘图共用的白/黑键几何", () => {
  it("一个八度 C4–C5：7 白 5 黑", () => {
    const geometry = buildKeyboardGeometry(60, 72);
    expect(geometry.whiteKeyCount).toBe(8); // 含两端 C
    expect(geometry.blackKeys).toHaveLength(5);
    expect(geometry.whiteKeys.map((k) => k.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it("白键按遍历顺序编号", () => {
    const geometry = buildKeyboardGeometry(60, 67);
    expect(geometry.whiteKeys.map((k) => k.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("黑键锚定在其左侧白键下标（E-F、B-C 之间无黑键）", () => {
    const geometry = buildKeyboardGeometry(60, 72);
    // C#(61) 左邻 C(60)→index 0；D#(63)→index 1；F#(66)→index 3（E 后）；
    // G#(68)→index 4；A#(70)→index 5。E-F、B-C 之间不产生黑键。
    expect(geometry.blackKeys).toEqual([
      { midi: 61, leftWhiteIndex: 0 },
      { midi: 63, leftWhiteIndex: 1 },
      { midi: 66, leftWhiteIndex: 3 },
      { midi: 68, leftWhiteIndex: 4 },
      { midi: 70, leftWhiteIndex: 5 },
    ]);
  });

  it("默认虚拟钢琴音域 C3–C6：22 白键", () => {
    const geometry = buildKeyboardGeometry(48, 84);
    expect(geometry.whiteKeyCount).toBe(22);
    expect(geometry.blackKeys).toHaveLength(15);
  });

  it("拒绝黑键边界与倒置区间", () => {
    expect(() => buildKeyboardGeometry(61, 72)).toThrow(RangeError);
    expect(() => buildKeyboardGeometry(60, 61)).toThrow(RangeError);
    expect(() => buildKeyboardGeometry(72, 60)).toThrow(RangeError);
  });
});
