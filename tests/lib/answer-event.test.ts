import { describe, expect, it } from "vitest";

import { createMidiAnswerEvent, VIRTUAL_KEY_VELOCITY } from "@/lib/answer-event";

describe("createMidiAnswerEvent：虚拟钢琴统一作答事件", () => {
  it("默认形状与领域内核 AnswerEvent 的 midi 变体一致（#34）", () => {
    const event = createMidiAnswerEvent(60, { timestamp: 123.4 });
    expect(event).toEqual({ kind: "midi", midi: 60, velocity: VIRTUAL_KEY_VELOCITY, timestamp: 123.4 });
  });

  it("力度可注入（MIDI 真琴归一路径 #43）", () => {
    expect(createMidiAnswerEvent(61, { velocity: 0.5, timestamp: 0 }).velocity).toBe(0.5);
  });

  it("timestamp 缺省取单调时钟 performance.now()", () => {
    const before = performance.now();
    const event = createMidiAnswerEvent(60);
    const after = performance.now();
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
  });
});
