/**
 * MIDI 真琴浏览器侧契约（#43，设计文档 #31「统一作答事件」）：
 * 事件形状 + 题面组件消费的桥接对象。
 *
 * 领域层 AnswerEvent（src/domain/types.ts）对输入来源不透明——真琴 noteon
 * 由题面组件（单音）或 ChordKeyboard（多键收集）归一为 midi / keys 变体，
 * 与虚拟钢琴同流（AC2），判定 / 统计零感知。
 */

/** 真琴 noteon 事件：velocity 已在解析边界归一 0..1（127 → 1）；timestamp = performance.now()（与虚拟钢琴作答同口径）。 */
export type MidiNoteEvent = {
  midi: number;
  velocity: number;
  timestamp: number;
};

/**
 * PracticeStage 传入题面组件的桥接（QuestionStageProps.midi）：
 * 题面经 subscribeNoteOn 订阅真琴事件、经 connected 决定是否关闭作答发声。
 */
export type MidiStageBridge = {
  /** 真琴是否已接入（授权且有输入设备，热插拔自动更新）；true 时作答发声关闭、示范音保留（ADR 0005 / AC3）。 */
  connected: boolean;
  /** 订阅真琴 noteon；返回退订函数。 */
  subscribeNoteOn(listener: (note: MidiNoteEvent) => void): () => void;
};
