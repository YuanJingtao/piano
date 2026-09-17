"use client";

/**
 * 五指位置与三和弦题面组件（题型 "key-sequence" / "block-chord"，工单 #42）：
 * 五线谱呈现（VexFlow 真实渲染）+ 插件局部 ChordKeyboard 多键作答。
 *
 * 声音（ADR 0005，仅内部钩子、无用户开关）：
 * - 出题即发声：柱式和弦题整体发声（playChord，AC2「和弦的整体色彩」）；
 *   键序列题按序发声（级进片段 / 分解和弦，与方向音程旋律题同款时序）；
 * - 答对：目标重播确认；
 * - 答错：播「你的（串/和弦）→ 正确（串/和弦）」对比（与既有题面同语义）。
 *
 * 谱面反馈：判定后音符按对错着绿/红并标音名（既有题面同款口径）。
 */

import { useEffect } from "react";

import ScoreExample from "@/components/shared/ScoreExample";
import type { QuestionStageProps } from "@/components/training/types";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";

import ChordKeyboard from "./ChordKeyboard";
import type { BlockChordQuestion, KeySequenceQuestion } from "./index";

/** 判定后谱面音符反馈色：对 = 绿 / 错 = 红（与行内文字反馈同语义）。 */
const FEEDBACK_OK_COLOR = "#16a34a"; // green-600
const FEEDBACK_BAD_COLOR = "#dc2626"; // red-600

/** 出题序列步进间隔（秒）：四音分解和弦 ~1.4s 内播完，与自动进题节奏协调。 */
const NOTE_GAP_SECONDS = 0.45;

function feedbackColorOf(judgement: QuestionStageProps["judgement"]): string | undefined {
  return judgement ? (judgement.ok ? FEEDBACK_OK_COLOR : FEEDBACK_BAD_COLOR) : undefined;
}

/** 键序列题（级进片段 / 分解和弦）：按谱面顺序弹奏，集满自动提交。 */
export function KeySequenceStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as KeySequenceQuestion;

  // 出题即发声：按序播放目标序列；question 引用每次签发都是新对象（同题重出也重播）。
  useEffect(() => {
    const audio = getPianoAudio();
    q.midis.forEach((midi, i) => {
      audio.playNote(midi, {
        durationSeconds: i === q.midis.length - 1 ? 0.9 : 0.45,
        timeOffsetSeconds: i * NOTE_GAP_SECONDS,
      });
    });
  }, [question, q.midis]);

  // 判定声：答对重播目标序列确认；答错「你的序列 → 正确序列」对比（紧凑步进，控制在进题间隔内）。
  useEffect(() => {
    if (!judgement) return;
    const audio = getPianoAudio();
    if (judgement.ok) {
      q.midis.forEach((midi, i) => {
        audio.playNote(midi, { durationSeconds: 0.4, timeOffsetSeconds: i * 0.3 });
      });
      return;
    }
    if (answer?.kind !== "keys") return;
    const userGap = 0.28;
    answer.midis.forEach((midi, i) => {
      audio.playNote(midi, { durationSeconds: 0.3, timeOffsetSeconds: i * userGap });
    });
    const targetStart = answer.midis.length * userGap + 0.25;
    q.midis.forEach((midi, i) => {
      audio.playNote(midi, { durationSeconds: 0.4, timeOffsetSeconds: targetStart + i * 0.3 });
    });
  }, [judgement, answer, q.midis]);

  const feedbackColor = feedbackColorOf(judgement);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        {q.label}——按谱面顺序弹出这 {q.midis.length} 个音（弹满自动提交）
      </p>
      <ScoreExample
        notes={q.midis.map((midi) => ({
          midi,
          duration: "q" as const,
          ...(feedbackColor ? { color: feedbackColor } : {}),
          ...(judgement ? { label: midiToNoteName(midi) } : {}),
        }))}
        clef="treble"
        timeSignature={null}
        width={400}
        className="mx-auto"
      />
      <ChordKeyboard
        expectedCount={q.midis.length}
        resetKey={question}
        disabled={!interactive}
        onSubmit={(midis, timestamp) => onAnswer({ kind: "keys", midis, timestamp })}
      />
    </div>
  );
}

/** 柱式和弦题（原位三和弦叠罗汉）：三音多键同按，集合判定、无关于键顺序。 */
export function BlockChordStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as BlockChordQuestion;

  // 出题即发声：柱式和弦整体发声（AC2）；question 引用每次签发都是新对象。
  useEffect(() => {
    getPianoAudio().playChord(q.midis, { durationSeconds: 1.2 });
  }, [question, q.midis]);

  // 判定声：答对整体和弦确认；答错「你的和弦 → 正确和弦」柱式对比。
  useEffect(() => {
    if (!judgement) return;
    const audio = getPianoAudio();
    if (judgement.ok) {
      audio.playChord(q.midis, { durationSeconds: 0.8 });
      return;
    }
    if (answer?.kind !== "keys") return;
    audio.playChord([...answer.midis].sort((x, y) => x - y), { durationSeconds: 0.6 });
    audio.playChord(q.midis, { durationSeconds: 0.9, timeOffsetSeconds: 0.7 });
  }, [judgement, answer, q.midis]);

  const feedbackColor = feedbackColorOf(judgement);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        柱式和弦「叠罗汉」——把三个和弦音同时按下（不分先后，按满自动提交）
      </p>
      <ScoreExample
        notes={[
          {
            midi: q.midis,
            duration: "q" as const,
            ...(feedbackColor ? { color: feedbackColor } : {}),
            ...(judgement ? { label: q.label } : {}),
          },
        ]}
        clef="treble"
        timeSignature={null}
        width={280}
        className="mx-auto"
      />
      <ChordKeyboard
        expectedCount={q.midis.length}
        resetKey={question}
        disabled={!interactive}
        onSubmit={(midis, timestamp) => onAnswer({ kind: "keys", midis, timestamp })}
      />
    </div>
  );
}
