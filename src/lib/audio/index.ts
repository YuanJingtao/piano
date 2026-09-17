/**
 * 发声层入口：全应用共享一个 PianoAudio 单例
 * （一个 AudioContext + 一份采样缓存；教程页听音环节与训练关卡共用，ADR 0007）。
 *
 * browser-only：只能在客户端组件的事件处理器 / effect 中调用 getPianoAudio()。
 */

import { TonePianoAudio } from "./tone-piano-audio";
import type { PianoAudio } from "./types";

let instance: PianoAudio | null = null;

export function getPianoAudio(): PianoAudio {
  if (typeof window === "undefined") {
    throw new Error("getPianoAudio() 仅限浏览器环境：请在客户端组件的事件处理器或 effect 中调用");
  }
  instance ??= new TonePianoAudio();
  return instance;
}

export type { PianoAudio, PianoAudioPlayOptions } from "./types";
export { TonePianoAudio } from "./tone-piano-audio";
