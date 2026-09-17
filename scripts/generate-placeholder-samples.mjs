#!/usr/bin/env node
/**
 * 生成占位钢琴采样（#36）：加法合成的衰减音色，写入 public/samples/piano/。
 *
 * 定位：占位。真实采样包（Salamander 子集，单力度层 ~8 音、mp3/ogg、几 MB 预算）
 * 在 P5（工单 #47）替换，见实现地图 #32「Not yet specified」。
 *
 * 采样音集合与调研结论一致（tech-selection §2.2 集成注意②/§4 关键工程决定⑤）：
 * C3–C6 每隔 ~5 半音一个，Tone.Sampler 自动变调补齐全部键位。
 *
 * 用法：node scripts/generate-placeholder-samples.mjs
 * 确定性输出（无随机），重复运行结果一致，可放心提交产物。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples", "piano");

const SAMPLE_RATE = 22050; // 占位质量足够，控制体积（~2x 小于 44.1k）
const DURATION_SECONDS = 2.0;
const ATTACK_SECONDS = 0.004;

/** [音名, MIDI note number]；MIDI note number 为音高唯一真源，音名仅用于文件命名。 */
const SAMPLE_NOTES = [
  ["C3", 48],
  ["F3", 53],
  ["A3", 57],
  ["C4", 60],
  ["F4", 65],
  ["A4", 69],
  ["C5", 72],
  ["C6", 84],
];

/** 泛音列：[倍频, 相对振幅, 衰减倍率]；高次泛音衰减更快，接近钢琴音色包络。 */
const PARTIALS = [
  [1, 1.0, 1.0],
  [2, 0.42, 1.6],
  [3, 0.22, 2.4],
  [4, 0.12, 3.5],
  [5, 0.06, 5.0],
  [6, 0.03, 7.0],
];

const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function synthesize(midi) {
  const totalSamples = Math.round(SAMPLE_RATE * DURATION_SECONDS);
  const attackSamples = Math.round(SAMPLE_RATE * ATTACK_SECONDS);
  const freq = midiToFrequency(midi);
  // 基频越高衰减越快（高音区钢琴自然更短促），tau 为主包络时间常数。
  const tau = Math.max(0.18, 0.9 * Math.pow(2, -(midi - 48) / 36));
  const samples = new Float64Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (const [mult, amp, decayMult] of PARTIALS) {
      const partialTau = tau / decayMult;
      v += amp * Math.exp(-t / partialTau) * Math.sin(2 * Math.PI * freq * mult * t);
    }
    // 线性起音，避免爆音。
    const attack = i < attackSamples ? i / attackSamples : 1;
    samples[i] = v * attack;
  }

  // 峰值归一化到 0.7，留出多音叠加余量。
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 ? 0.7 / peak : 1;
  for (let i = 0; i < totalSamples; i++) samples[i] *= gain;
  return samples;
}

/** 16-bit PCM mono WAV 编码（44 字节标准头）。 */
function encodeWav(samples) {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

mkdirSync(OUT_DIR, { recursive: true });
let totalBytes = 0;
for (const [name, midi] of SAMPLE_NOTES) {
  const wav = encodeWav(synthesize(midi));
  const file = join(OUT_DIR, `${name}.wav`);
  writeFileSync(file, wav);
  totalBytes += wav.length;
  console.log(`wrote ${file} (${(wav.length / 1024).toFixed(0)} KB, midi=${midi})`);
}
console.log(`total: ${(totalBytes / 1024).toFixed(0)} KB, ${SAMPLE_NOTES.length} samples`);
