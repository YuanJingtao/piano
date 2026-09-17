"use client";

/**
 * 虚拟钢琴（一等公民作答入口，设计文档 #31 / ADR 0007）：
 * 点击/触摸产出统一作答事件 { kind: "midi", midi, velocity, timestamp }，
 * 与 MIDI 真琴（#43）归一；发声 / 判定 / 反馈由消费方决定
 * （训练时 PracticeStage 接线发声；MIDI 接入时作答发声关闭，ADR 0005）。
 *
 * browser-only：集成处用 next/dynamic ssr:false（tech-selection §4）。
 */

import { useCallback, useState } from "react";

import { createMidiAnswerEvent, type MidiAnswerEvent } from "@/lib/answer-event";

import { KeyboardLayout } from "./keyboard-layout";

export type VirtualPianoProps = {
  /** 最低键（须为白键），默认 C3 = 48。 */
  lowestMidi?: number;
  /** 最高键（须为白键），默认 C6 = 84。 */
  highestMidi?: number;
  disabled?: boolean;
  /** 统一作答事件出口。 */
  onAnswer?: (event: MidiAnswerEvent) => void;
  /** 容器类名（高度在此指定），默认 h-40。 */
  className?: string;
};

export default function VirtualPiano({
  lowestMidi = 48,
  highestMidi = 84,
  disabled = false,
  onAnswer,
  className = "h-40",
}: VirtualPianoProps) {
  const [pressedMidi, setPressedMidi] = useState<number | null>(null);

  const handlePointerDown = useCallback(
    (midi: number) => {
      setPressedMidi(midi);
      onAnswer?.(createMidiAnswerEvent(midi));
    },
    [onAnswer],
  );

  const handlePointerUp = useCallback((midi: number) => {
    setPressedMidi((current) => (current === midi ? null : current));
  }, []);

  return (
    <KeyboardLayout
      lowestMidi={lowestMidi}
      highestMidi={highestMidi}
      interactive
      disabled={disabled}
      pressedMidi={pressedMidi}
      onKeyPointerDown={handlePointerDown}
      onKeyPointerUp={handlePointerUp}
      className={className}
      ariaLabel="虚拟钢琴（作答）"
    />
  );
}
