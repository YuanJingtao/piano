"use client";

/**
 * 旋律组末音题面组件（题型 "interval-melody"，工单 #40）：
 * 五线谱呈现从锚点地标音出发的旋律组（VexFlow 真实渲染）+ 虚拟钢琴作答末音。
 *
 * 声音（ADR 0005，仅内部钩子、无用户开关）：
 * - 出题即发声：按序播放整段旋律（0.5s 步进，末音稍长）——纯耳朵通关是预期脚手架；
 * - 答对：末音确认声；
 * - 答错：播「你的音 → 正确音」对比（与地标音题面同款时序）。
 *
 * 谱面标注叠加：首音（锚点）恒着地标色——「从家出发」的视觉脚手架，不泄露目标；
 * 判定后末音按对错着绿/红并标音名。
 */

import { useEffect } from "react";

import type { QuestionStageProps } from "@/components/training/types";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";
import { LANDMARK_COLORS, landmarkByMidi } from "@/plugins/landmark-notes/landmarks";

import ScoreExample from "../../components/shared/ScoreExample";
import VirtualPiano from "../../components/shared/VirtualPiano";
import type { IntervalMelodyQuestion } from "./intervals";

/** 判定后谱面音符反馈色：对 = 绿 / 错 = 红（与行内文字反馈同语义，地标音题面同款）。 */
const FEEDBACK_OK_COLOR = "#16a34a"; // green-600
const FEEDBACK_BAD_COLOR = "#dc2626"; // red-600

/** 出题旋律步进间隔（秒）：与自动进题节奏（800/1800ms）协调，三音轮廓 1s 内播完。 */
const NOTE_GAP_SECONDS = 0.5;

export default function IntervalMelodyStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as IntervalMelodyQuestion;
  const target = q.notes[q.notes.length - 1];
  const anchorLandmark = landmarkByMidi(q.notes[0]);
  const anchorColor = anchorLandmark ? LANDMARK_COLORS[anchorLandmark.id] : undefined;

  // 出题即发声：按序播放旋律；question 引用每次签发都是新对象（同题重出也重播）。
  useEffect(() => {
    const audio = getPianoAudio();
    q.notes.forEach((midi, i) => {
      audio.playNote(midi, {
        durationSeconds: i === q.notes.length - 1 ? 0.9 : 0.45,
        timeOffsetSeconds: i * NOTE_GAP_SECONDS,
      });
    });
  }, [question, q.notes]);

  // 判定声：答对末音确认；答错「你的音 → 正确音」对比。
  useEffect(() => {
    if (!judgement) return;
    const audio = getPianoAudio();
    if (judgement.ok) {
      audio.playNote(target, { durationSeconds: 0.5 });
    } else if (answer?.kind === "midi") {
      audio.playNote(answer.midi, { durationSeconds: 0.35 });
      audio.playNote(target, { durationSeconds: 0.6, timeOffsetSeconds: 0.35 });
    }
  }, [judgement, target, answer]);

  const feedbackColor = judgement
    ? judgement.ok
      ? FEEDBACK_OK_COLOR
      : FEEDBACK_BAD_COLOR
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        从着色的锚点音出发，按谱面形状走——在下方钢琴上弹出最后一个音
      </p>
      <ScoreExample
        notes={q.notes.map((midi, i) => {
          const isTarget = i === q.notes.length - 1;
          return {
            midi,
            duration: "q" as const,
            // 锚点（首音）着地标色——「从家出发」脚手架；末音判定后着反馈色 + 标音名。
            ...(i === 0 && !isTarget && anchorColor ? { color: anchorColor } : {}),
            ...(isTarget && feedbackColor ? { color: feedbackColor } : {}),
            ...(isTarget && judgement ? { label: midiToNoteName(midi) } : {}),
          };
        })}
        clef={q.clef}
        timeSignature={null}
        width={400}
        className="mx-auto"
      />
      <VirtualPiano onAnswer={onAnswer} disabled={!interactive} />
    </div>
  );
}
