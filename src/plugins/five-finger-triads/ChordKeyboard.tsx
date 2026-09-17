"use client";

/**
 * 多键作答键盘（插件局部组件，工单 #42）：
 * 柱式和弦「多键同按」与键序列（级进片段/分解和弦）的作答收集——
 * 基于共享 KeyboardLayout（消费不改，核心共享件零改动，沿用 #40
 * PlayMelodyButton 插件局部件先例）。
 *
 * 交互口径：每按一键即发该键琴声（收集过程可听，边搭边校）；按序收集、
 * 集满 expectedCount 自动提交（与自动进题节奏协调）；提交前可「重按」清空重来。
 * 触屏多点同按天然支持（pointerdown 逐指触发）；桌面鼠标逐键点击等效。
 *
 * browser-only：与 VirtualPiano 同定式，模块 SSR 安全（音频仅在事件内触达）。
 */

import { useEffect, useState } from "react";

import { KeyboardLayout } from "@/components/shared/keyboard-layout";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";

/** 已收集键高亮色（amber-500，与共享键盘按下反馈同色系）。 */
const COLLECTED_COLOR = "#f59e0b";

export type ChordKeyboardProps = {
  /** 需收集的键数；集满自动提交。 */
  expectedCount: number;
  /** 收集重置信号：传当前题目对象，新题签发即清空上一题收集。 */
  resetKey: unknown;
  /** 反馈展示 / 结算阶段锁定（与 QuestionStageProps.interactive 同源）。 */
  disabled?: boolean;
  /** 集满提交（按键顺序；timestamp = performance.now()，与 midi 变体同口径）。 */
  onSubmit: (midis: readonly number[], timestamp: number) => void;
  /** 最低键（须为白键），默认 C3 = 48。 */
  lowestMidi?: number;
  /** 最高键（须为白键），默认 C6 = 84。 */
  highestMidi?: number;
  /** 容器类名（高度在此指定），默认 h-40。 */
  className?: string;
};

export default function ChordKeyboard({
  expectedCount,
  resetKey,
  disabled = false,
  onSubmit,
  lowestMidi = 48,
  highestMidi = 84,
  className = "h-40",
}: ChordKeyboardProps) {
  const [collected, setCollected] = useState<readonly number[]>([]);
  const complete = collected.length >= expectedCount;

  // 新题签发（question 引用变化）即清空收集；同题重出也重置。
  useEffect(() => {
    setCollected([]);
  }, [resetKey]);

  function handlePointerDown(midi: number) {
    if (disabled || complete) return;
    getPianoAudio().playNote(midi, { durationSeconds: 0.4 });
    const next = [...collected, midi];
    setCollected(next);
    if (next.length === expectedCount) {
      onSubmit(next, performance.now());
    }
  }

  const highlights = Object.fromEntries(collected.map((midi) => [midi, COLLECTED_COLOR]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-neutral-600" role="status" aria-live="polite">
          已按 {collected.length}/{expectedCount}
          {collected.length > 0 && (
            <span className="ml-2 font-medium text-neutral-800">
              {collected.map(midiToNoteName).join(" · ")}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setCollected([])}
          disabled={disabled || collected.length === 0}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↺ 重按
        </button>
      </div>
      <KeyboardLayout
        lowestMidi={lowestMidi}
        highestMidi={highestMidi}
        interactive
        disabled={disabled || complete}
        highlights={highlights}
        onKeyPointerDown={handlePointerDown}
        className={className}
        ariaLabel="虚拟钢琴（多键作答）"
      />
    </div>
  );
}
