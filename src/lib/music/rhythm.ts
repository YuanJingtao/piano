/**
 * 节奏纯逻辑：时值序列 → 节奏点击声的时间偏移。
 *
 * 节奏点击声（CONTEXT.md）：短促打击合成声，无音高、振荡器合成、非采样，
 * 服务于「听节奏选谱面」题型。首版内容范围：仅 4/4 拍、时值到八分音符（设计文档 #31）。
 *
 * 纯 TypeScript，无 DOM / 浏览器 API 依赖（可直接单测）。
 */

/**
 * 把以「拍」为单位的时值序列换算为点击声的相对时间偏移（秒，从 0 开始）。
 * 每个时值起点敲一声：如 [1, 0.5, 0.5, 1]（ta ti-ti ta ta）在 bpm=60 下
 * 产出 [0, 1, 1.5, 2]。
 */
export function beatsToClickOffsets(durationsBeats: readonly number[], bpm: number): number[] {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError(`bpm 必须为正数，收到 ${bpm}`);
  }
  if (durationsBeats.length === 0) {
    throw new RangeError("时值序列不得为空");
  }
  const secondsPerBeat = 60 / bpm;
  const offsets: number[] = [];
  let elapsedBeats = 0;
  for (const duration of durationsBeats) {
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError(`时值（拍）必须为正数，收到 ${duration}`);
    }
    offsets.push(elapsedBeats * secondsPerBeat);
    elapsedBeats += duration;
  }
  return offsets;
}
