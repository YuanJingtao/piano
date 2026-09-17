"use client";

/**
 * 键盘地理题面组件（题型 "keyboard-geo"，#39 训练闭环）：
 * 「不看谱」特例——题目锚定键盘图（黑键组 / 天然半音对高亮）或音名文字，
 * 不出现五线谱；作答 = 虚拟钢琴按出目标键。
 *
 * 声音（ADR 0005，仅内部钩子、无用户开关）：
 * - 出题即发声：题目呈现瞬间播放目标音高（凭耳朵 + 键盘地理作答是预期脚手架）；
 * - 答对：目标音确认声；
 * - 答错：播「你的音 → 正确音」对比（时序与地标音题面一致，原型 #5 变体 A）。
 *
 * 键盘图叠加：作答前只高亮锚（不泄露目标键）；判定后目标键按对错着绿/红并标音名。
 */

import { useEffect } from "react";

import KeyboardDiagram from "@/components/shared/KeyboardDiagram";
import VirtualPiano from "@/components/shared/VirtualPiano";
import type { QuestionStageProps } from "@/components/training/types";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";

import { cueColor, cueHighlightMidis, cuePrompt, type KeyboardGeoQuestion } from "./geography";

/** 判定后目标键反馈色：对 = 绿 / 错 = 红（与行内文字反馈同语义，地标音题面同口径）。 */
const FEEDBACK_OK_COLOR = "#16a34a"; // green-600
const FEEDBACK_BAD_COLOR = "#dc2626"; // red-600

export default function KeyboardGeoStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as KeyboardGeoQuestion;

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

  // 锚点题（黑键组 / 天然半音）配键盘图；音名快答题纯文字 + 耳朵，不配图减少视觉噪音。
  const anchorMidis = cueHighlightMidis(q.cue);
  const showDiagram = anchorMidis.length > 0;
  const highlights = [
    ...anchorMidis.map((midi) => ({ midi, color: cueColor(q.cue) })),
    // 判定后：目标键着色压过锚色（数组后者覆盖前者），并标音名。
    ...(judgement
      ? [
          {
            midi: q.midi,
            color: judgement.ok ? FEEDBACK_OK_COLOR : FEEDBACK_BAD_COLOR,
            label: midiToNoteName(q.midi),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {q.cue.kind === "note-name" ? (
        <p className="text-center text-3xl font-semibold tracking-tight text-neutral-900">
          {midiToNoteName(q.midi)}
        </p>
      ) : (
        <p className="mx-auto max-w-md text-center text-sm leading-relaxed text-neutral-700">
          {cuePrompt(q.midi, q.cue)}
        </p>
      )}
      {showDiagram && (
        <KeyboardDiagram highlights={highlights} className="mx-auto h-24 w-full max-w-xl" />
      )}
      <VirtualPiano onAnswer={onAnswer} disabled={!interactive} />
    </div>
  );
}
