"use client";

/**
 * 单音题面的 MIDI 接线（#43 AC2）：真琴 noteon → createMidiAnswerEvent → onAnswer，
 * 与 VirtualPiano 指针作答完全同流——判定 / 统计 / 锁定（lockedRef）全在
 * PracticeStage.handleAnswer 兜底，本 hook 只做归一转发。
 *
 * 单音三题面（地标音 / 键盘地理 / 旋律组末音）共用；
 * 多键作答（key-sequence / block-chord）由 ChordKeyboard 自行收集为 keys 变体。
 */

import { useEffect } from "react";

import { createMidiAnswerEvent } from "@/lib/answer-event";
import type { MidiStageBridge } from "@/lib/midi/types";

import type { QuestionStageProps } from "./types";

export function useMidiAnswer(
  midi: MidiStageBridge | undefined,
  onAnswer: QuestionStageProps["onAnswer"],
): void {
  useEffect(() => {
    if (!midi) return;
    return midi.subscribeNoteOn(({ midi: note, velocity, timestamp }) =>
      onAnswer(createMidiAnswerEvent(note, { velocity, timestamp })),
    );
  }, [midi, onAnswer]);
}
