"use client";

/**
 * 地标音题面组件（题型 "landmark-note"，#38 训练闭环）：
 * 五线谱呈现题目（VexFlow 真实渲染）+ 虚拟钢琴作答。
 *
 * 声音（ADR 0005，仅内部钩子、无用户开关）：
 * - 出题即发声：题目呈现瞬间播放目标音高；
 * - 答对：目标音确认声；
 * - 答错：播「你的音 → 正确音」对比（原型 #5 变体 A 验证过的时序：
 *   你的音 0.35s，正确音延迟 0.35s 起 0.6s）。
 *
 * 谱面标注叠加：作答前中性呈现（不泄露答案色彩——地标五色与地标一一对应）；
 * 判定后音符按对错着绿/红并标音名（原型验证的标注形态）。
 */

import { useEffect } from "react";

import type { QuestionStageProps } from "@/components/training/types";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";

import ScoreExample from "../../components/shared/ScoreExample";
import VirtualPiano from "../../components/shared/VirtualPiano";
import type { LandmarkNoteQuestion } from "./index";

/** 判定后谱面音符反馈色：对 = 绿 / 错 = 红（与行内文字反馈同语义）。 */
const FEEDBACK_OK_COLOR = "#16a34a"; // green-600
const FEEDBACK_BAD_COLOR = "#dc2626"; // red-600

export default function LandmarkNoteStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as LandmarkNoteQuestion;

  // 出题即发声：question 引用每次签发都是新对象（同题重出也重播）。
  useEffect(() => {
    getPianoAudio().playNote(q.midi, { durationSeconds: 1 });
  }, [question, q.midi]);

  // 判定声：答对确认音；答错「你的音 → 正确音」对比。
  useEffect(() => {
    if (!judgement) return;
    const audio = getPianoAudio();
    if (judgement.ok) {
      audio.playNote(q.midi, { durationSeconds: 0.5 });
    } else if (answer?.kind === "midi") {
      audio.playNote(answer.midi, { durationSeconds: 0.35 });
      audio.playNote(q.midi, { durationSeconds: 0.6, timeOffsetSeconds: 0.35 });
    }
  }, [judgement, q.midi, answer]);

  const feedbackColor = judgement
    ? judgement.ok
      ? FEEDBACK_OK_COLOR
      : FEEDBACK_BAD_COLOR
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        这个音是什么？在下方钢琴上按出来
      </p>
      <ScoreExample
        notes={[
          {
            midi: q.midi,
            duration: "w",
            ...(feedbackColor ? { color: feedbackColor } : {}),
            ...(judgement ? { label: midiToNoteName(q.midi) } : {}),
          },
        ]}
        clef={q.clef}
        timeSignature={null}
        width={320}
        className="mx-auto"
      />
      <VirtualPiano onAnswer={onAnswer} disabled={!interactive} />
    </div>
  );
}
