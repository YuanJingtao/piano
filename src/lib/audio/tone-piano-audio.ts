/**
 * PianoAudio 的 Tone.js 实现（tech-selection §2.2 首选）。
 *
 * - 钢琴音色：Tone.Sampler + 占位采样（public/samples/piano/，本工单 #36 用
 *   scripts/generate-placeholder-samples.mjs 合成；真实采样包 P5/#47 替换）。
 *   Sampler 自动变调：8 个采样音覆盖全键盘。
 * - 节奏点击声：振荡器合成短促打击声（无音高、非采样，CONTEXT.md）。
 * - browser-only：tone 在 start() 内动态 import，模块本身 SSR 安全；
 *   AudioContext 解锁经 Tone.start()，由消费方绑定在用户手势内。
 */

import type { PianoAudio, PianoAudioPlayOptions } from "./types";

type ToneModule = typeof import("tone");
type Sampler = import("tone").Sampler;
type PolySynth = import("tone").PolySynth;

/** 占位采样映射：键名 = 音名（Sampler 以此变调补齐其余键位）。 */
const PLACEHOLDER_SAMPLE_URLS: Record<string, string> = {
  C3: "C3.wav",
  F3: "F3.wav",
  A3: "A3.wav",
  C4: "C4.wav",
  F4: "F4.wav",
  A4: "A4.wav",
  C5: "C5.wav",
  C6: "C6.wav",
};
const SAMPLES_BASE_URL = "/samples/piano/";
const SAMPLES_LOAD_TIMEOUT_MS = 10_000;

const DEFAULT_DURATION_SECONDS = 1;
const DEFAULT_VELOCITY = 0.8;
/** 点击声时长：足够短促以致无可感音高。 */
const CLICK_DURATION_SECONDS = 0.03;
const CLICK_FREQUENCY_HZ = 1000;

function withDefaults(options?: PianoAudioPlayOptions) {
  return {
    timeOffsetSeconds: options?.timeOffsetSeconds ?? 0,
    durationSeconds: options?.durationSeconds ?? DEFAULT_DURATION_SECONDS,
    velocity: options?.velocity ?? DEFAULT_VELOCITY,
  };
}

export class TonePianoAudio implements PianoAudio {
  private tone: ToneModule | null = null;
  private sampler: Sampler | null = null;
  private clickSynth: PolySynth | null = null;
  private startPromise: Promise<void> | null = null;

  get ready(): boolean {
    return this.sampler !== null && this.clickSynth !== null;
  }

  start(): Promise<void> {
    this.startPromise ??= this.init();
    return this.startPromise;
  }

  private async init(): Promise<void> {
    const tone = await import("tone");
    // AudioContext 解锁：init 由手势内的 start() 首次触发（消费方约定，见 types.ts）。
    await tone.start();
    this.tone = tone;

    // 频率不在构造项内：每次 triggerAttackRelease 以 note 参数传入固定频率
    // （短促包络下无可感音高，满足「无音高」约定）。
    //
    // 用 PolySynth 而非单音 Synth：一串点击声在同一时刻并发触发（多音符节奏型），
    // 且出题即发声的 effect 在 StrictMode 下会双触发、用户「再听一遍」可能与上一串
    // 未播完的点击声重叠——单音 Synth 的振荡器复用会抛「Start time must be strictly
    // greater than previous start time」。PolySynth 每次触发分配独立 voice，天然免疫。
    this.clickSynth = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      volume: -10,
    }).toDestination();

    this.sampler = await this.loadSampler(tone);
  }

  private loadSampler(tone: ToneModule): Promise<Sampler> {
    return new Promise<Sampler>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`钢琴采样加载超时（${SAMPLES_LOAD_TIMEOUT_MS}ms）：${SAMPLES_BASE_URL}`));
      }, SAMPLES_LOAD_TIMEOUT_MS);
      const sampler = new tone.Sampler({
        urls: PLACEHOLDER_SAMPLE_URLS,
        baseUrl: SAMPLES_BASE_URL,
        attack: 0.002,
        release: 0.3,
        onload: () => {
          clearTimeout(timeout);
          resolve(sampler);
        },
        onerror: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      }).toDestination();
    });
  }

  /** 统一走 start()：手势内调用时立即就绪；未解锁时浏览器静音，不抛错。 */
  private whenReady(run: (tone: ToneModule) => void): void {
    this.start()
      .then(() => {
        if (this.tone) run(this.tone);
      })
      .catch((error: unknown) => {
        console.error("[piano-audio] 发声失败：", error);
      });
  }

  playNote(midi: number, options?: PianoAudioPlayOptions): void {
    const { timeOffsetSeconds, durationSeconds, velocity } = withDefaults(options);
    this.whenReady((tone) => {
      this.sampler?.triggerAttackRelease(midi, durationSeconds, tone.now() + timeOffsetSeconds, velocity);
    });
  }

  playChord(midis: readonly number[], options?: PianoAudioPlayOptions): void {
    if (midis.length === 0) return;
    const { timeOffsetSeconds, durationSeconds, velocity } = withDefaults(options);
    this.whenReady((tone) => {
      this.sampler?.triggerAttackRelease([...midis], durationSeconds, tone.now() + timeOffsetSeconds, velocity);
    });
  }

  playRhythmClick(offsetsSeconds: readonly number[] = [0]): void {
    this.whenReady((tone) => {
      const base = tone.now();
      for (const offset of offsetsSeconds) {
        this.clickSynth?.triggerAttackRelease(CLICK_FREQUENCY_HZ, CLICK_DURATION_SECONDS, base + offset);
      }
    });
  }

  dispose(): void {
    this.sampler?.dispose();
    this.clickSynth?.dispose();
    this.sampler = null;
    this.clickSynth = null;
    this.tone = null;
    this.startPromise = null;
  }
}
