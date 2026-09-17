"use client";

/**
 * 首调功能音组题面组件（#44 训练闭环，三种题型）：
 * - GroupNotationQuizStage（"group-notation-quiz" 看谱选唱名）：
 *   呈现三音组谱面，从四个「简谱数字串（唱名串）」选项中选出匹配项；
 * - GroupEarQuizStage（"group-ear-quiz" 听音选谱面）：
 *   播放三音组，从四个谱面选项中选出听到的音型（与节奏插件听辨形态同构）；
 * - GroupPlayStage（"group-play" 音组弹奏）：
 *   看谱按序弹出三音组，收集交互复用 #42 ChordKeyboard（跨插件 import，
 *   先例：五指教程页 import direction-intervals 的 PlayMelodyButton）。
 *
 * 声音（ADR 0005，仅内部钩子、无用户开关）：
 * - 出题即发声：三种题型呈现瞬间都按序播放本题音组（旋律组步进 0.45s，
 *   与五指插件序列题同节奏；先听再看，凭耳朵作答是预期行为）；
 * - 「再听一遍」重播按钮全程可用（示范音，不触发作答）；
 * - 识别题判定反馈不自动播对比声：选项域没有「你的音 → 正确音」的音高等价物
 *   （沿用 #41 节奏选择题决议），以选项视觉高亮 + 自由重播替代；
 * - 弹奏题答对重播确认、答错播「你的序列 → 正确序列」对比（#42 同款时序）；
 * - 真琴接入时弹奏题判定声与收集键声关闭、示范音保留（#43 AC3）。
 *
 * 作答事件：识别题上抛 choice 变体（choiceId = 展示字母 A–D）；
 * 弹奏题经 ChordKeyboard 集满自动提交 keys 变体（严格有序，judge 判定）。
 */

import { useEffect } from "react";

import ScoreExample from "@/components/shared/ScoreExample";
import type { QuestionStageProps } from "@/components/training/types";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";
import PlayMelodyButton from "@/plugins/direction-intervals/PlayMelodyButton";
import ChordKeyboard from "@/plugins/five-finger-triads/ChordKeyboard";

import {
  FUNCTIONAL_GROUPS,
  OPTION_LETTERS,
  type GroupEarQuizQuestion,
  type GroupNotationQuizQuestion,
  type GroupPlayQuestion,
} from "./index";

/** 音组按序发声的步进间隔（秒）：三音 ~0.9s 播完，落在自动进题窗口内。 */
const NOTE_GAP_SECONDS = 0.45;

/** 判定后谱面音符反馈色：对 = 绿 / 错 = 红（与行内文字反馈同语义）。 */
const FEEDBACK_OK_COLOR = "#16a34a"; // green-600
const FEEDBACK_BAD_COLOR = "#dc2626"; // red-600

/** 音型 → 谱面音符（三个四分音符，不标拍号——与方向音程旋律题同款口径）。 */
function figureNotes(pitches: readonly number[]) {
  return pitches.map((midi) => ({ midi, duration: "q" as const }));
}

/** 出题即发声：按序播放本题音组（示范音不受真琴接入影响，#43 AC3）。 */
function playFigure(pitches: readonly number[]): void {
  const audio = getPianoAudio();
  pitches.forEach((note, i) => {
    audio.playNote(note, {
      durationSeconds: i === pitches.length - 1 ? 0.9 : 0.45,
      timeOffsetSeconds: i * NOTE_GAP_SECONDS,
    });
  });
}

function choiceEvent(choiceId: string) {
  return { kind: "choice" as const, choiceId, timestamp: performance.now() };
}

/* ---------- 选项 UI（与节奏插件选择题同款交互口径） ---------- */

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
function chosenIndexOf(answer: QuestionStageProps["answer"]): number | null {
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

/* ---------- 看谱选唱名 ---------- */

export function GroupNotationQuizStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as GroupNotationQuizQuestion;
  const group = FUNCTIONAL_GROUPS[q.groupId];

  // 出题即发声：question 引用每次签发都是新对象（同题重出也重播）。
  useEffect(() => {
    playFigure(q.pitches);
  }, [question, q.pitches]);

  const chosen = chosenIndexOf(answer);
  const disabled = !interactive || judgement !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        谱上是哪个功能音组？选出它的简谱数字与唱名（{group.keyContext}）
      </p>
      <div className="flex flex-col items-center gap-2">
        <ScoreExample notes={figureNotes(q.pitches)} clef="treble" timeSignature={null} width={360} />
        <PlayMelodyButton midis={q.pitches} label="▶ 再听一遍" noteGapSeconds={NOTE_GAP_SECONDS} />
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

/* ---------- 听音选谱面 ---------- */

export function GroupEarQuizStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
}: QuestionStageProps) {
  const q = question as GroupEarQuizQuestion;

  // 出题即发声：听音选谱面，声音先行（与节奏插件 rhythm-ear-quiz 同构）。
  useEffect(() => {
    playFigure(q.pitches);
  }, [question, q.pitches]);

  const chosen = chosenIndexOf(answer);
  const disabled = !interactive || judgement !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        听音组（出题已播放），选出对应的谱面
      </p>
      <div className="flex justify-center">
        <PlayMelodyButton midis={q.pitches} label="▶ 再听一遍" noteGapSeconds={NOTE_GAP_SECONDS} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((optionPitches, i) => {
          const state = optionState(i, q.correctIndex, chosen);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(choiceEvent(OPTION_LETTERS[i]!))}
              aria-label={`选项 ${OPTION_LETTERS[i]}：三音组谱面`}
              className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 shadow-sm transition-colors disabled:cursor-default ${OPTION_STYLE[state]}`}
            >
              <LetterBadge letter={OPTION_LETTERS[i]!} state={state} />
              <ScoreExample
                notes={figureNotes(optionPitches)}
                clef="treble"
                timeSignature={null}
                width={200}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 音组弹奏 ---------- */

export function GroupPlayStage({
  question,
  answer,
  judgement,
  onAnswer,
  interactive,
  midi,
}: QuestionStageProps) {
  const q = question as GroupPlayQuestion;
  const group = FUNCTIONAL_GROUPS[q.groupId];

  // 出题即发声：按序播放目标音组；question 引用每次签发都是新对象。
  useEffect(() => {
    playFigure(q.pitches);
  }, [question, q.pitches]);

  // 判定声：答对重播目标确认；答错「你的序列 → 正确序列」对比（紧凑步进，
  // 控制在进题间隔内）；真琴接入时关闭（#43 AC3）。
  useEffect(() => {
    if (!judgement || midi?.connected) return;
    const audio = getPianoAudio();
    if (judgement.ok) {
      q.pitches.forEach((note, i) => {
        audio.playNote(note, { durationSeconds: 0.4, timeOffsetSeconds: i * 0.3 });
      });
      return;
    }
    if (answer?.kind !== "keys") return;
    const userGap = 0.28;
    answer.midis.forEach((note, i) => {
      audio.playNote(note, { durationSeconds: 0.3, timeOffsetSeconds: i * userGap });
    });
    const targetStart = answer.midis.length * userGap + 0.25;
    q.pitches.forEach((note, i) => {
      audio.playNote(note, { durationSeconds: 0.4, timeOffsetSeconds: targetStart + i * 0.3 });
    });
  }, [judgement, answer, q.pitches, midi]);

  const feedbackColor = judgement
    ? judgement.ok
      ? FEEDBACK_OK_COLOR
      : FEEDBACK_BAD_COLOR
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-neutral-600">
        {group.keyContext}功能音组——按谱面顺序弹出这 3 个音（弹满自动提交）
      </p>
      <ScoreExample
        notes={q.pitches.map((note) => ({
          midi: note,
          duration: "q" as const,
          ...(feedbackColor ? { color: feedbackColor } : {}),
          ...(judgement ? { label: midiToNoteName(note) } : {}),
        }))}
        clef="treble"
        timeSignature={null}
        width={360}
        className="mx-auto"
      />
      <ChordKeyboard
        expectedCount={q.pitches.length}
        resetKey={question}
        disabled={!interactive}
        midi={midi}
        onSubmit={(midis, timestamp) => onAnswer({ kind: "keys", midis, timestamp })}
      />
    </div>
  );
}
