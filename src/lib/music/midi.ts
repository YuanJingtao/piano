/**
 * 音高纯逻辑：MIDI note number 为唯一真源（设计文档 #31「技术选型」），
 * 向消费方提供音名 / VexFlow key / 键盘几何的适配。
 *
 * 纯 TypeScript，无 DOM / 浏览器 API 依赖（可直接单测）。
 */

/** 半音音名（升号拼写）；内容范围 C 大调 / a 小调，首版不涉及降号等音选择。 */
const SHARP_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** VexFlow key 字母部分（小写），下标 = pitch class。 */
const VEX_KEY_LETTERS = ["c", "c", "d", "d", "e", "f", "f", "g", "g", "a", "a", "b"] as const;

/** 黑键的 pitch class 集合。 */
const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

function assertValidMidi(midi: number): void {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(`midi 必须是 0..127 的整数，收到 ${midi}`);
  }
}

/** 是否黑键。 */
export function isBlackKey(midi: number): boolean {
  assertValidMidi(midi);
  return BLACK_KEY_PITCH_CLASSES.has(midi % 12);
}

/** MIDI note number → 科学音高记名，如 60 → "C4"、61 → "C#4"（行内反馈展示音名用）。 */
export function midiToNoteName(midi: number): string {
  assertValidMidi(midi);
  return `${SHARP_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** MIDI note number → 频率（Hz），A4 = 440。 */
export function midiToFrequency(midi: number): number {
  assertValidMidi(midi);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * VexFlow key 适配结果：`key` 形如 "c/4"（八度以中央 C = C4 计，与 VexFlow 一致）；
 * 黑键时 `accidental` 为 "#"，由渲染层显式加 Accidental modifier（StaveNote 不会自动渲染）。
 */
export type VexKey = {
  key: string;
  accidental?: "#";
};

/** MIDI note number → VexFlow key（唯一真源在 MIDI，VexFlow 层做适配）。 */
export function midiToVexKey(midi: number): VexKey {
  assertValidMidi(midi);
  const octave = Math.floor(midi / 12) - 1;
  const key = `${VEX_KEY_LETTERS[midi % 12]}/${octave}`;
  return isBlackKey(midi) ? { key, accidental: "#" } : { key };
}

/** 白键：按遍历顺序编号。 */
export type WhiteKey = {
  midi: number;
  /** 在整段键盘白键序列中的下标（0 起）。 */
  index: number;
};

/** 黑键：跨在其左侧白键（`leftWhiteIndex`）与下一白键的边界上。 */
export type BlackKey = {
  midi: number;
  /** 紧邻左侧白键的下标；黑键左边缘 = (leftWhiteIndex + 1) × 白键宽 − 黑键宽 / 2。 */
  leftWhiteIndex: number;
};

export type KeyboardGeometry = {
  whiteKeys: WhiteKey[];
  blackKeys: BlackKey[];
  whiteKeyCount: number;
};

/**
 * 计算一段键盘的白/黑键几何（虚拟钢琴与键盘图共用）。
 * 边界要求：lowestMidi / highestMidi 必须是白键且 lowest ≤ highest。
 */
export function buildKeyboardGeometry(lowestMidi: number, highestMidi: number): KeyboardGeometry {
  assertValidMidi(lowestMidi);
  assertValidMidi(highestMidi);
  if (lowestMidi > highestMidi) {
    throw new RangeError(`lowestMidi(${lowestMidi}) 不得大于 highestMidi(${highestMidi})`);
  }
  if (isBlackKey(lowestMidi) || isBlackKey(highestMidi)) {
    throw new RangeError(`键盘边界必须是白键，收到 ${lowestMidi}..${highestMidi}`);
  }

  const whiteKeys: WhiteKey[] = [];
  const blackKeys: BlackKey[] = [];
  for (let midi = lowestMidi; midi <= highestMidi; midi++) {
    if (isBlackKey(midi)) {
      // 区间起点是白键，黑键左侧必有白键。
      blackKeys.push({ midi, leftWhiteIndex: whiteKeys.length - 1 });
    } else {
      whiteKeys.push({ midi, index: whiteKeys.length });
    }
  }
  return { whiteKeys, blackKeys, whiteKeyCount: whiteKeys.length };
}
