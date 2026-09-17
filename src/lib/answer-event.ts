/**
 * 统一作答事件（midi 入口）：虚拟钢琴点击/触摸与（#43 的）MIDI 真琴 noteon 归一为此形状，
 * 渲染 / 发声 / 判定 / 统计只消费该抽象（设计文档 #31「关键工程决定」①）。
 *
 * 与领域内核 AnswerEvent 的 midi 变体（#34，src/domain/types.ts）结构一致；
 * 两分支合并后消费方（#37/#38）直接对接领域类型，本文件不另立语义。
 */

export type MidiAnswerEvent = {
  kind: "midi";
  /** MIDI note number：音高唯一真源。 */
  midi: number;
  /** 归一化力度 0..1；虚拟钢琴固定 VIRTUAL_KEY_VELOCITY，MIDI 真琴在边界处 0-127 → 0..1（#43）。 */
  velocity: number;
  /** performance.now() 毫秒（单调时钟），用于响应时长统计。 */
  timestamp: number;
};

/** 虚拟钢琴无力度感应，作答事件用固定力度。 */
export const VIRTUAL_KEY_VELOCITY = 0.8;

/** 构造虚拟钢琴作答事件；timestamp 可注入（测试用），默认取 performance.now()。 */
export function createMidiAnswerEvent(
  midi: number,
  options?: { velocity?: number; timestamp?: number },
): MidiAnswerEvent {
  return {
    kind: "midi",
    midi,
    velocity: options?.velocity ?? VIRTUAL_KEY_VELOCITY,
    timestamp: options?.timestamp ?? performance.now(),
  };
}
