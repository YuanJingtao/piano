"use client";

/**
 * 节奏示范按钮（共享交互组件，ADR 0007；工单 #41 节奏阅读基础）：
 * 点击播放一串节奏点击声（无音高、振荡器合成，CONTEXT.md「节奏点击声」）。
 *
 * MDX 教程页听音环节与训练题面「再听一遍」重播共用；与 PlayNoteButton 同构——
 * 点击手势内完成 Tone.start() 音频解锁（幂等），首次点击即解锁 AudioContext。
 *
 * browser-only：集成处用 next/dynamic ssr:false 或作为客户端组件渲染。
 */

import { useState } from "react";

import { getPianoAudio } from "@/lib/audio";
import { beatsToClickOffsets } from "@/lib/music/rhythm";

export type PlayRhythmButtonProps = {
  /** 逐音符时值序列（拍），如 [1, 0.5, 0.5, 1, 1]；rhythm-reading 的 patternToBeats 产出。 */
  beats: readonly number[];
  /** 示范速度（bpm），默认 60（1 拍 1 秒）。 */
  bpm?: number;
  /** 按钮文案，默认「▶ 听节奏」。 */
  label?: string;
  disabled?: boolean;
  className?: string;
};

export default function PlayRhythmButton({
  beats,
  bpm = 60,
  label = "▶ 听节奏",
  disabled = false,
  className = "",
}: PlayRhythmButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const audio = getPianoAudio();
    setBusy(true);
    try {
      // 本点击即用户手势：AudioContext 解锁在此完成（幂等）。
      await audio.start();
      audio.playRhythmClick(beatsToClickOffsets(beats, bpm));
    } catch (error) {
      console.error("[play-rhythm-button] 播放失败：", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className={`inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? "加载中…" : label}
    </button>
  );
}
