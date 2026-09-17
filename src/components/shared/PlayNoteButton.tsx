"use client";

/**
 * 发声按钮（ADR 0007：MDX 教程页听音环节复用的核心共享组件）：
 * 点击播放示范音（单音或柱式和弦）。
 *
 * 点击手势内完成 Tone.start() 音频解锁（tech-selection §4 关键工程决定③）——
 * 教程页可以没有独立「开始」按钮，首次点击发声按钮即解锁 AudioContext。
 *
 * browser-only：集成处用 next/dynamic ssr:false。
 */

import { useState } from "react";

import { getPianoAudio } from "@/lib/audio";

export type PlayNoteButtonProps = {
  /** 单音或柱式和弦（MIDI note number，音高唯一真源）。 */
  midi: number | readonly number[];
  /** 按钮文案，默认「▶ 听一听」。 */
  label?: string;
  /** 音符时值（秒），默认 1。 */
  durationSeconds?: number;
  disabled?: boolean;
  className?: string;
};

export default function PlayNoteButton({
  midi,
  label = "▶ 听一听",
  durationSeconds = 1,
  disabled = false,
  className = "",
}: PlayNoteButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const audio = getPianoAudio();
    setBusy(true);
    try {
      // 本点击即用户手势：AudioContext 解锁与采样加载在此完成（幂等）。
      await audio.start();
      const midis = typeof midi === "number" ? [midi] : midi;
      if (midis.length === 1) {
        audio.playNote(midis[0], { durationSeconds });
      } else {
        audio.playChord(midis, { durationSeconds });
      }
    } catch (error) {
      console.error("[play-note-button] 播放失败：", error);
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
