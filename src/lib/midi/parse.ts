/**
 * MIDI 消息解析（纯函数，#43 AC1；tech-selection §3.2 自写 hook 方案的消息层）：
 * 原始消息字节 → noteon / noteoff，velocity 在边界归一 0..1（answer-event.ts 约定）。
 *
 * 口径（MIDI 1.0 规范）：
 * - 0x9n = note on、0x8n = note off（n 为通道号；本项目全通道接收，不做路由过滤）；
 * - noteon 且 velocity = 0 视同 noteoff（真琴普遍如此发送松开）；
 * - 其余消息（CC / 弯音 / 程序切换 / 系统实时等）与作答无关，返回 null。
 *
 * Running status（省略状态字节的连发）不处理：常规键盘极少使用，
 * 调研 §3.2 的 ~30 行方案同样忽略；出现时按 null 丢弃、不产生错误作答。
 */

export type MidiNoteMessage =
  | { command: "noteon"; note: number; velocity: number }
  | { command: "noteoff"; note: number };

/** 解析一条 MIDI 消息；非音符消息或短包返回 null。入参兼容 Uint8Array 与只读数组。 */
export function parseMidiMessage(data: ArrayLike<number>): MidiNoteMessage | null {
  if (data.length < 3) return null; // note on/off 均为 3 字节
  const status = data[0];
  const note = data[1];
  const velocity = data[2];
  const command = status & 0xf0;
  if (command === 0x90 && velocity > 0) {
    return { command: "noteon", note, velocity: velocity / 127 };
  }
  if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    return { command: "noteoff", note };
  }
  return null;
}
