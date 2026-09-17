import { describe, expect, it } from "vitest";

import { beatsToClickOffsets } from "@/lib/music/rhythm";

describe("beatsToClickOffsets：节奏点击声时间编排（听节奏选谱面）", () => {
  it("ta（四分 ×1）只有一声，从 0 开始", () => {
    expect(beatsToClickOffsets([1], 60)).toEqual([0]);
  });

  it("ti-ti（八分 ×2）在 bpm=60 下间隔 0.5s", () => {
    expect(beatsToClickOffsets([0.5, 0.5], 60)).toEqual([0, 0.5]);
  });

  it("ta ti-ti ta ta 组合节奏型", () => {
    expect(beatsToClickOffsets([1, 0.5, 0.5, 1, 1], 60)).toEqual([0, 1, 1.5, 2, 3]);
  });

  it("bpm 缩放：bpm=120 时一拍 0.5s", () => {
    expect(beatsToClickOffsets([1, 1], 120)).toEqual([0, 0.5]);
  });

  it("拒绝空序列、非正时值与非正 bpm", () => {
    expect(() => beatsToClickOffsets([], 60)).toThrow(RangeError);
    expect(() => beatsToClickOffsets([0], 60)).toThrow(RangeError);
    expect(() => beatsToClickOffsets([-1], 60)).toThrow(RangeError);
    expect(() => beatsToClickOffsets([1], 0)).toThrow(RangeError);
  });
});
