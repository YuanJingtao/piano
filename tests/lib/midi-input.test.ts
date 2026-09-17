import { describe, expect, it } from "vitest";

import { parseMidiMessage } from "@/lib/midi/parse";

/**
 * MIDI 消息解析（#43 AC1 的纯函数层）：hook 的浏览器交互部分按设计文档
 * 归 P5 人工走查，此处只自动化消息口径——noteon/noteoff 判别、力度归一、通道忽略。
 */
describe("parseMidiMessage：真琴消息 → noteon/noteoff（velocity 归一 0..1）", () => {
  it("noteon：0x9n + velocity>0，力度 127 → 1", () => {
    expect(parseMidiMessage([0x90, 60, 127])).toEqual({
      command: "noteon",
      note: 60,
      velocity: 1,
    });
    expect(parseMidiMessage([0x90, 60, 64])).toEqual({
      command: "noteon",
      note: 60,
      velocity: 64 / 127,
    });
  });

  it("接受 Uint8Array（MIDIMessageEvent.data 的真实形态）", () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 72, 100]))).toEqual({
      command: "noteon",
      note: 72,
      velocity: 100 / 127,
    });
  });

  it("任意通道的 noteon/noteoff 均有效（通道位忽略，不做路由过滤）", () => {
    expect(parseMidiMessage([0x9f, 60, 100])?.command).toBe("noteon"); // 通道 16
    expect(parseMidiMessage([0x89, 61, 64])).toEqual({ command: "noteoff", note: 61 });
  });

  it("velocity=0 的 noteon 视同 noteoff（真琴普遍约定）", () => {
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({ command: "noteoff", note: 60 });
  });

  it("0x8n 解析为 noteoff（velocity 字节不参与）", () => {
    expect(parseMidiMessage([0x80, 60, 127])).toEqual({ command: "noteoff", note: 60 });
  });

  it("非音符消息返回 null（CC / 弯音 / 程序切换 / 系统实时）", () => {
    expect(parseMidiMessage([0xb0, 7, 100])).toBeNull(); // Control Change
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull(); // Pitch Bend
    expect(parseMidiMessage([0xc0, 5, 0])).toBeNull(); // Program Change
    expect(parseMidiMessage([0xf8, 0, 0])).toBeNull(); // Timing Clock
  });

  it("短包 / 空消息返回 null（不抛错——降级路径无报错口径，AC5 同源）", () => {
    expect(parseMidiMessage([])).toBeNull();
    expect(parseMidiMessage([0x90, 60])).toBeNull();
  });
});
