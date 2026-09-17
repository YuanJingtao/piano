"use client";

/**
 * 节奏阅读基础题面组件（#41 训练闭环，两种题型）：
 * - RhythmSyllableQuizStage（"rhythm-syllable-quiz" 看谱选音节）：
 *   呈现一小节 4/4 谱面，从四个 Kodály 音节串中选出匹配项；
 * - RhythmEarQuizStage（"rhythm-ear-quiz" 听节奏选谱面）：
 *   播放节奏点击声，从四小节日谱中选出听到的节奏型。
 *
 * 声音（ADR 0005，仅内部钩子、无用户开关）：
 * - 出题即发声：两种题型呈现瞬间都播放本题节奏的点击声（振荡器合成，
 *   复用发声层 playRhythmClick；先听再看，凭耳朵作答是预期行为）；
 * - 「再听一遍」重播按钮全程可用（示范音，不触发作答）；
 * - 判定反馈不自动播对比声：时值域没有「你的音 → 正确音」的音高对比等价物，
 *   且点击串（4 拍 = 4s）会溢出 800/1800ms 自动进题窗口、与下一题示范声重叠——
 *   以正确/所选选项的视觉高亮 + 自由重播替代（#41 决议）。
 *
 * 作答 = 选项点击，上抛 AnswerEvent choice 变体（choiceId 即展示的选项字母 A–D）。
 */

import { useEffect } from "react";

import type { QuestionStageProps } from "@/components/training/types";
import ScoreExample, { type ScoreNoteSpec } from "@/components/shared/ScoreExample";
import PlayRhythmButton from "@/components/shared/PlayRhythmButton";
import { getPianoAudio } from "@/lib/audio";
import { beatsToClickOffsets } from "@/lib/music/rhythm";

import {
  OPTION_LETTERS,
  RHYTHM_DEMO_BPM,
  RHYTHM_NOTATION_MIDI,
  patternToBeats,
  type RhythmEarQuizQuestion,
  type RhythmPattern,
  type RhythmSyllableQuizQuestion,
} from "./index";

/** 节奏型 → 谱面音符（统一画在 B4 中线；tt 展开为两个八分音符，autoBeam 连符杠）。 */
function measureNotes(pattern: RhythmPattern): ScoreNoteSpec[] {
  return pattern.flatMap((unit): ScoreNoteSpec[] => {
    const at = { midi: RHYTHM_NOTATION_MIDI };
    if (unit === "tt") {
      return [
        { ...at, duration: "8" },
        { ...at, duration: "8" },
      ];
    }
    return [{ ...at, duration: unit }];
  });
}

/** 出题即发声：播放本题节奏的点击声示范。 */
function playPattern(pattern: RhythmPattern): void {
  getPianoAudio().playRhythmClick(beatsToClickOffsets(patternToBeats(pattern), RHYTHM_DEMO_BPM));
}

function choiceEvent(choiceId: string) {
  return { kind: "choice" as const, choiceId, timestamp: performance.now() };
}

/** 判定后的选项配色：正确项绿 / 所选错误项红 / 其余中性（与行内文字反馈同语义）。 */
function optionState(
  index: number,
  correctIndex: number,
  chosenIndex: number | null,
): "idle" | "correct" | "wrong" {
  if (chosenIndex === null) return "idle";
  if (index === correctIndex) return "correct";
  if (index === chosenIndex) return "wrong";
  return "idle";
}

const OPTION_STYLE: Record<"idle" | "correct" | "wrong", string> = {
  idle: "border-neutral-300 bg-white hover:bg-neutral-100",
  correct: "border-emerald-500 bg-emerald-50",
  wrong: "border-red-500 bg-red-50",
};

/** 已提交的选项字母 → 下标；未作答/超时为 null。 */
function chosenIndexOf(
  answer: QuestionStageProps["answer"],
): number | null {
  if (!answer || answer.kind !== "choice") return null;
  const index = OPTION_LETTERS.indexOf(answer.choiceId as (typeof OPTION_LETTERS)[number]);
  return index >= 0 ? index : null;
}

/** 选项字母角标。 */
function LetterBadge({ letter, state }: { letter: string; state: "idle" | "correct" | "wrong" }) {
  const style =
    state === "correct"
      ? "bg-emerald-600 text-white"
      : state === "wrong"
        ? "bg-red-600 text-white"
        : "bg-neutral-200 text-neutral-700";
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${style}`}
    >
      {letter}
    </span>
  );
}

/* ---------- 看谱选音节 ---------- */

export function RhythmSyllableQuizStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as RhythmSyllableQuizQuestion;
  const beats = patternToBeats(q.pattern);

  // 出题即发声：question 引用每次签发都是新对象（同题重出也重播）。
  useEffect(() => {
    playPattern(q.pattern);
  }, [question, q.pattern]);

  const chosen = chosenIndexOf(answer);
  const disabled = !interactive || judgement !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        这一小节的节奏，用音节念出来是哪个？
      </p>
      <div className="flex flex-col items-center gap-2">
        <ScoreExample
          notes={measureNotes(q.pattern)}
          clef="treble"
          timeSignature="4/4"
          width={420}
        />
        <PlayRhythmButton beats={beats} bpm={RHYTHM_DEMO_BPM} label="▶ 再听一遍" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((text, i) => {
          const state = optionState(i, q.correctIndex, chosen);
          return (
            <button
              key={`${text}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(choiceEvent(OPTION_LETTERS[i]!))}
              aria-label={`选项 ${OPTION_LETTERS[i]}：${text}`}
              className={`flex items-center gap-3 rounded-md border-2 px-4 py-3 text-left text-sm font-medium text-neutral-800 shadow-sm transition-colors disabled:cursor-default ${OPTION_STYLE[state]} ${
                disabled && state === "idle" ? "opacity-70" : ""
              }`}
            >
              <LetterBadge letter={OPTION_LETTERS[i]!} state={state} />
              <span className="tracking-wide">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 听节奏选谱面 ---------- */

export function RhythmEarQuizStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as RhythmEarQuizQuestion;
  const beats = patternToBeats(q.pattern);

  // 出题即发声：播放节奏点击声示范（听节奏选谱面，声音先行）。
  useEffect(() => {
    playPattern(q.pattern);
  }, [question, q.pattern]);

  const chosen = chosenIndexOf(answer);
  const disabled = !interactive || judgement !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        听节奏（点击声示范），选出对应的谱面
      </p>
      <div className="flex justify-center">
        <PlayRhythmButton beats={beats} bpm={RHYTHM_DEMO_BPM} label="▶ 再听一遍" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((optionPattern, i) => {
          const state = optionState(i, q.correctIndex, chosen);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(choiceEvent(OPTION_LETTERS[i]!))}
              aria-label={`选项 ${OPTION_LETTERS[i]}：一小节节奏谱面`}
              className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 shadow-sm transition-colors disabled:cursor-default ${OPTION_STYLE[state]}`}
            >
              <LetterBadge letter={OPTION_LETTERS[i]!} state={state} />
              <ScoreExample
                notes={measureNotes(optionPattern)}
                clef="treble"
                timeSignature="4/4"
                width={260}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
