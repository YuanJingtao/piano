/**
 * 发声层抽象（ADR 0005 + tech-selection §2.2：先写好 PianoAudio 接口抽象，
 * Tone.js Sampler 与原生 Web Audio 两种实现可互换）。
 *
 * 约定：
 * - 音高一律 MIDI note number（唯一真源），实现层自行换算；
 * - `start()` 必须在用户手势内调用（浏览器 AudioContext 解锁约束）；
 * - 播放方法全部同步返回、内部自等就绪，消费方无需手动编排 start 与播放的时序；
 * - 示范音（出题即发声 / 听音环节 / 和弦与节奏示范）与琴键声共用本接口。
 */

export type PianoAudioPlayOptions = {
  /** 相对当前时刻的调度偏移（秒）；默认 0（立即）。 */
  timeOffsetSeconds?: number;
  /** 音符时值（秒）；默认 1。 */
  durationSeconds?: number;
  /** 归一化力度 0..1；默认 0.8。 */
  velocity?: number;
};

export interface PianoAudio {
  /** AudioContext 已解锁且采样加载完成。 */
  readonly ready: boolean;
  /**
   * 在用户手势内调用：解锁 AudioContext（Tone.start()）并等待采样加载完成。
   * 幂等，可重复调用；播放方法内部也会自调，但首帧可能因未解锁而静音。
   */
  start(): Promise<void>;
  /** 播放单个音高（示范音 / 作答反馈）。 */
  playNote(midi: number, options?: PianoAudioPlayOptions): void;
  /** 播放柱式和弦：多音同时发声（和弦题整体色彩，ADR 0005）。 */
  playChord(midis: readonly number[], options?: PianoAudioPlayOptions): void;
  /** 播放一串节奏点击声；offsets 为相对当前时刻的秒偏移（beatsToClickOffsets 产出）。 */
  playRhythmClick(offsetsSeconds?: readonly number[]): void;
  /** 释放音频资源（组件卸载 / 热更新）。 */
  dispose(): void;
}
