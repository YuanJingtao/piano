"use client";

/**
 * 旋律试听按钮（本技巧教程页听音环节用，工单 #40）：
 * 点击按序播放一串音高（示范音，ADR 0005）。与核心共享件 PlayNoteButton
 * （单音/柱式和弦）互补——旋律组需要先后发声；保持插件局部组件，
 * 不惊动核心共享件（其他技巧教程需要时再上升为共享组件）。
 *
 * 点击手势内完成 Tone.start() 音频解锁（与 PlayNoteButton 同款约定）。
 * browser-only：仅在 MDX 教程页（客户端渲染路径）使用。
 */

import { useState } from "react";

import { getPianoAudio } from "@/lib/audio";

export type PlayMelodyButtonProps = {
  /** 旋律音序列（MIDI note number，音高唯一真源），按序播放。 */
  midis: readonly number[];
  /** 按钮文案，默认「▶ 听旋律」。 */
  label?: string;
  /** 音符步进间隔（秒），默认 0.5（与训练出题发声同节奏）。 */
  noteGapSeconds?: number;
  disabled?: boolean;
  className?: string;
};

export default function PlayMelodyButton({
  midis,
  label = "▶ 听旋律",
  noteGapSeconds = 0.5,
  disabled = false,
  className = "",
}: PlayMelodyButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const audio = getPianoAudio();
    setBusy(true);
    try {
      // 本点击即用户手势：AudioContext 解锁与采样加载在此完成（幂等）。
      await audio.start();
      midis.forEach((midi, i) => {
        audio.playNote(midi, {
          durationSeconds: i === midis.length - 1 ? 1.2 : 0.45,
          timeOffsetSeconds: i * noteGapSeconds,
        });
      });
    } catch (error) {
      console.error("[play-melody-button] 播放失败：", error);
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
