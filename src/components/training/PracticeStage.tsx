"use client";

/**
 * 训练闭环主流程（#38，ADR 0002 内容区训练）：
 * idle（开始）→ 出题/作答/行内反馈（Round 引擎驱动，题面组件按题型注册）→
 * 轮末结算 → 仅结算轮 POST /api/sessions 落库 → router.refresh() 点亮课程树。
 *
 * 流程规则全部来自核心 Round 引擎（ADR 0004/0007）：未达标整轮重来，
 * 错题池（3× 权重、答对移出、达标即弃）为组件内存态、同关卡轮次间传递，
 * 不跨页持久化；中途放弃（返回教程/刷新）不提交，天然不留痕（ADR 0006）。
 *
 * 「开始」按钮同一手势内完成 Tone.start() 音频解锁（AC1 / ADR 0005）
 * 与 requestMIDIAccess() 真琴授权（#43 AC4）；出题即发声与答错对比声
 * 在题面组件内部（stage.tsx），无用户开关；真琴接入时作答发声关闭、示范音保留。
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Round } from "@/domain/round";
import { getTechnique } from "@/domain/registry";
import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  RoundResult,
} from "@/domain/types";
import { useMidiInput, type MidiInputApi } from "@/hooks/use-midi-input";
import { getPianoAudio } from "@/lib/audio";
import type { BestScore, SettlementPayload } from "@/lib/persistence/contracts";
import { buildSettlementPayload } from "@/lib/training/settlement-payload";
import "@/plugins"; // 静态注册副作用（ADR 0007）：客户端同样经注册表取插件

import { getQuestionStage } from "./question-stages";

/** 自动进题间隔（原型 #5 变体 A 验证口径）：答对短停留，答错留足对比声 + 阅读反馈时间。 */
const NEXT_DELAY_OK_MS = 800;
const NEXT_DELAY_WRONG_MS = 1800;

export type PracticeStageProps = {
  techniqueId: string;
  techniqueTitle: string;
  /** 关卡定义（代码即 truth，服务端从注册表 manifest 原样传入，JSON 可序列化）。 */
  level: LevelDef;
  /** 进入页面时的关卡状态（复习轮展示最佳成绩；结算落库后经 refresh 更新）。 */
  initialState: { passed: boolean; best: BestScore | null };
  /** 教学顺序的下一关（通过后直达链接）；已是最后一关为 null。 */
  nextLevel: { id: string; title: string } | null;
};

type Phase =
  | { kind: "idle" }
  | {
      kind: "question";
      question: Question;
      index: number;
      /** 已提交作答（反馈展示中）；等待作答为 null。 */
      answer: AnswerEvent | null;
      judgement: Judgement | null;
      responseMs: number | null;
    }
  | { kind: "settling"; result: RoundResult }
  | {
      kind: "settled";
      result: RoundResult;
      save: { status: "saved" } | { status: "error"; message: string };
    };

/** 轮内逐题对错（进度点展示用；判定真源在 Round 内部记录）。 */
type History = boolean[];

export default function PracticeStage({
  techniqueId,
  techniqueTitle,
  level,
  initialState,
  nextLevel,
}: PracticeStageProps) {
  const router = useRouter();
  const plugin = useMemo(() => getTechnique(techniqueId), [techniqueId]);
  /** MIDI 真琴输入（#43）：Safari/iOS 自动 "unsupported"，虚拟钢琴照常（AC5）。 */
  const midiInput = useMidiInput();

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [history, setHistory] = useState<History>([]);
  const [starting, setStarting] = useState(false);
  /** 限时模式开关（ADR 0003：用户可选，默认关闭）；仅 timeLimitMs 关卡展示。 */
  const [timedMode, setTimedMode] = useState(false);

  const roundRef = useRef<Round | null>(null);
  /** 同关卡加权错题池：内存态，重来/复习轮传递，达标即弃（ADR 0004）。 */
  const mistakePoolRef = useRef<readonly Question[]>([]);
  /** 反馈展示期间锁定作答（连击两次只记第一次；disabled 渲染前的竞态兜底）。 */
  const lockedRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  /** 限时模式逐题倒计时；非限时轮不 arm。 */
  const limitTimerRef = useRef<number | null>(null);
  const payloadRef = useRef<SettlementPayload | null>(null);

  useEffect(
    () => () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
      if (limitTimerRef.current !== null) window.clearTimeout(limitTimerRef.current);
    },
    [],
  );

  const tutorialHref = `/techniques/${techniqueId}`;
  const isQuick = level.pass.maxMedianResponseMs !== undefined;
  const canTime = level.timeLimitMs !== undefined;
  /** 首版仅节奏关卡声明 timeLimitMs（ADR 0003），可限时关卡即选择·匹配题关卡。 */
  const isChoice = !isQuick && canTime;
  /**
   * 当轮生效的关卡定义：限时开关关闭时剥掉 timeLimitMs——Round 引擎与结算快照
   * （buildSettlementPayload → practice_session.time_limit_ms）都以它为准，
   * 限时轮与非限时轮因此天然分开落库（ADR 0003/0006）。
   */
  const effectiveLevel = useMemo<LevelDef>(
    () => (canTime && !timedMode ? { ...level, timeLimitMs: undefined } : level),
    [level, canTime, timedMode],
  );

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function clearLimitTimer() {
    if (limitTimerRef.current !== null) {
      window.clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  }

  /** 签发新题 + （限时轮）arm 逐题倒计时。 */
  function issueQuestion(question: Question, index: number) {
    clearLimitTimer();
    const limitMs = effectiveLevel.timeLimitMs;
    if (limitMs !== undefined) {
      limitTimerRef.current = window.setTimeout(() => {
        limitTimerRef.current = null;
        handleTimeout(limitMs);
      }, limitMs);
    }
    setPhase({ kind: "question", question, index, answer: null, judgement: null, responseMs: null });
  }

  function beginRound() {
    clearAdvanceTimer();
    try {
      const round = new Round({ level: effectiveLevel, plugin, mistakePool: mistakePoolRef.current });
      const first = round.next();
      if (!first) return; // questionCount ≥ 1 的关卡不会走到
      roundRef.current = round;
      lockedRef.current = false;
      setHistory([]);
      issueQuestion(first.question, first.index);
    } catch (err) {
      console.error("[practice] 开局失败：", err);
    }
  }

  /**
   * 限时模式逐题超时（ADR 0003）：Round.timeout() 记错题（responseMs = 时限值）、
   * 轮次继续；不调用插件 judge（没有真实作答可判），反馈文案为引擎级通用超时提示。
   */
  function handleTimeout(limitMs: number) {
    if (lockedRef.current) return;
    const round = roundRef.current;
    if (!round) return;
    lockedRef.current = true;
    round.timeout();
    setHistory((h) => [...h, false]);
    setPhase((p) =>
      p.kind === "question"
        ? { ...p, judgement: { ok: false, feedback: "⏰ 超时，记为错题" }, responseMs: limitMs }
        : p,
    );
    advanceTimerRef.current = window.setTimeout(advance, NEXT_DELAY_WRONG_MS);
  }

  /**
   * 「开始」点击手势内同步调用 start()：AudioContext 解锁绑定本手势（AC1）；
   * requestMIDIAccess 同手势触发（#43 AC4）——权限弹窗需用户激活，两件事绑同一按钮最稳
   * （tech-selection §4）。MIDI 授权不 await：不阻断开局，状态经状态行展示、热插拔即时生效。
   */
  async function handleStart() {
    setStarting(true);
    midiInput.requestAccess();
    try {
      await getPianoAudio().start();
    } catch (err) {
      // 音频不可用不阻断训练：出题声退化为静音，流程照常。
      console.error("[practice] 音频解锁失败：", err);
    }
    setStarting(false);
    beginRound();
  }

  function advance() {
    const round = roundRef.current;
    if (!round) return;
    lockedRef.current = false;
    if (round.isComplete()) {
      settleRound();
      return;
    }
    const next = round.next();
    if (!next) {
      settleRound();
      return;
    }
    issueQuestion(next.question, next.index);
  }

  function handleAnswer(event: AnswerEvent) {
    if (lockedRef.current) return;
    const round = roundRef.current;
    if (!round || phase.kind !== "question" || phase.judgement !== null) return;
    lockedRef.current = true;
    clearLimitTimer();

    const judgement = round.submit(event);
    const responseMs = round.lastResponseMs() ?? 0;
    setHistory((h) => [...h, judgement.ok]);
    setPhase({ ...phase, judgement, answer: event, responseMs });
    advanceTimerRef.current = window.setTimeout(
      advance,
      judgement.ok ? NEXT_DELAY_OK_MS : NEXT_DELAY_WRONG_MS,
    );
  }

  function settleRound() {
    const round = roundRef.current;
    if (!round) return;
    clearLimitTimer();
    const result = round.settle();
    // 达标 → nextMistakePool 为空（池即弃）；未达标 → 重来轮带入加权（ADR 0004）。
    mistakePoolRef.current = result.nextMistakePool;
    // effectiveLevel：限时轮带 timeLimitMs 快照，非限时轮为 null（ADR 0003/0006）。
    payloadRef.current = buildSettlementPayload({ techniqueId, level: effectiveLevel, result });
    setPhase({ kind: "settling", result });
    void submitSettlement(result);
  }

  /** 仅结算轮落库（AC7）：一次 POST 提交 Session + 全部 AnswerRecord。 */
  async function submitSettlement(result: RoundResult) {
    const payload = payloadRef.current;
    if (!payload) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      // 课程树点亮 + 本页状态刷新（AC8）：服务端重渲染，客户端状态保留。
      router.refresh();
      setPhase({ kind: "settled", result, save: { status: "saved" } });
    } catch (err) {
      console.error("[practice] 结算提交失败：", err);
      setPhase({
        kind: "settled",
        result,
        save: { status: "error", message: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /* ---------- 视图 ---------- */

  const header = (
    <div className="mb-6 flex items-center gap-3">
      <Link
        href={tutorialHref}
        aria-label={`返回 ${techniqueTitle} 教程`}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100"
      >
        ← 教程
      </Link>
      <h1 className="text-lg font-semibold tracking-tight">
        {level.id} · {level.title}
      </h1>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          isQuick
            ? "bg-sky-50 text-sky-700"
            : isChoice
              ? "bg-teal-50 text-teal-700"
              : "bg-violet-50 text-violet-700"
        }`}
      >
        {isQuick
          ? `快答 · ${level.questionCount} 题`
          : isChoice
            ? `选择匹配 · ${level.questionCount} 题`
            : `弹奏 · ${level.questionCount} 题`}
      </span>
      {canTime && timedMode && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          ⏱ 限时 {Math.round((level.timeLimitMs ?? 0) / 1000)}s/题
        </span>
      )}
    </div>
  );

  if (phase.kind === "idle") {
    const { best } = initialState;
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        {header}
        <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-neutral-600">
            {isQuick
              ? `正确率 ≥${Math.round(level.pass.minAccuracy * 100)}% 且中位响应 ≤${Math.round((level.pass.maxMedianResponseMs ?? 0) / 1000)}s 通过；未达标整轮重来。`
              : `正确率 ≥${Math.round(level.pass.minAccuracy * 100)}% 通过；未达标整轮重来。`}
          </p>
          {initialState.passed && (
            <p className="mt-2 text-sm text-emerald-700">
              ✓ 已通过{best ? ` · 最佳 ${best.correctCount}/${best.questionCount} · 中位响应 ${best.medianResponseMs}ms` : ""}
              （复习轮不影响通过状态）
            </p>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            点击「开始」将同时解锁音频{isChoice ? "" : "并请求真琴（MIDI）授权"}；每题出题瞬间会播放
            {isChoice ? "节奏点击声示范" : "目标音高"}——先听再认，凭耳朵作答是预期行为。
          </p>
          <MidiStatusLine api={midiInput} isChoice={isChoice} />
          {canTime && (
            <TimedModeToggle
              limitMs={level.timeLimitMs ?? 0}
              enabled={timedMode}
              onToggle={() => setTimedMode((v) => !v)}
            />
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="mt-6 rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? "音频加载中…" : "▶ 开始"}
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "question") {
    const Stage = getQuestionStage(phase.question.type);
    const feedback =
      phase.judgement !== null && phase.responseMs !== null
        ? `${phase.judgement.feedback} · ${phase.responseMs}ms`
        : null;
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        {header}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
          <MidiStatusLine api={midiInput} isChoice={isChoice} />
          {effectiveLevel.timeLimitMs !== undefined && phase.judgement === null && (
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200" aria-hidden>
              <div
                key={phase.index}
                className="h-full rounded-full bg-amber-500"
                style={{
                  animation: `timed-bar-shrink ${effectiveLevel.timeLimitMs}ms linear forwards`,
                }}
              />
            </div>
          )}
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm tabular-nums text-neutral-500">
              第 {phase.index + 1}/{level.questionCount} 题
            </span>
            <ProgressDots history={history} total={level.questionCount} />
          </div>
          <Stage
            question={phase.question}
            answer={phase.answer}
            judgement={phase.judgement}
            onAnswer={handleAnswer}
            interactive={phase.judgement === null}
            midi={midiInput.bridge}
          />
          <p
            role="status"
            aria-live="polite"
            className={`mt-4 min-h-6 text-center text-sm font-medium tabular-nums ${
              phase.judgement === null
                ? "text-neutral-400"
                : phase.judgement.ok
                  ? "text-emerald-700"
                  : "text-red-700"
            }`}
          >
            {feedback ?? (isChoice ? "听示范 + 看题面，选出正确的选项" : "听声音，在钢琴上按出题目要求的音")}
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === "settling") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
        {header}
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-neutral-500 shadow-sm">
          结算中…
        </div>
      </div>
    );
  }

  /* settled */
  const { result, save } = phase;
  const accuracyPct = Math.round(result.accuracy * 100);
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
      {header}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          {result.passed ? "🎉" : "💪"}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          {result.passed ? "关卡通过！" : "未达标，整轮重来"}
        </h2>
        <p className="text-sm tabular-nums text-neutral-600">
          正确 {result.correctCount}/{result.questionCount} · 正确率 {accuracyPct}% · 中位响应{" "}
          {Math.round(result.medianResponseMs)}ms
          {isQuick ? `（阈值 ≥${Math.round(level.pass.minAccuracy * 100)}% 且 ≤${level.pass.maxMedianResponseMs}ms）` : `（阈值 ≥${Math.round(level.pass.minAccuracy * 100)}%）`}
        </p>

        {save.status === "error" ? (
          <div className="mt-2 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <span>成绩保存失败：{save.message}</span>
            <button
              type="button"
              onClick={() => {
                setPhase({ kind: "settling", result });
                void submitSettlement(result);
              }}
              className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-red-100"
            >
              重试
            </button>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">
            {result.passed ? "通过状态永久有效，进度已记录。" : "本轮成绩已记录；通过状态不受影响。"}
          </p>
        )}

        {canTime && (
          <div className="w-full max-w-md text-left">
            <TimedModeToggle
              limitMs={level.timeLimitMs ?? 0}
              enabled={timedMode}
              onToggle={() => setTimedMode((v) => !v)}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {!result.passed && (
            <>
              <button
                type="button"
                onClick={beginRound}
                className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
              >
                整轮重来
              </button>
              <p className="w-full text-xs text-neutral-400">
                本轮答错的题将以更高权重再次出现（加权错题池）。
              </p>
            </>
          )}
          {result.passed && nextLevel && (
            <Link
              href={`/techniques/${techniqueId}/levels/${nextLevel.id}`}
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
            >
              下一关：{nextLevel.title} →
            </Link>
          )}
          {result.passed && (
            <button
              type="button"
              onClick={beginRound}
              className="rounded-md border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
            >
              再练一轮（复习）
            </button>
          )}
          <Link
            href={tutorialHref}
            className="rounded-md border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
          >
            返回教程
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * 真琴（MIDI）状态行（#43 降级矩阵，AC5/AC6）：
 * - Safari / iOS（unsupported）：不渲染任何内容——静默回退仅虚拟钢琴，无报错、不打扰；
 * - Firefox 首连（prompting + UA）：给「Site Permission Add-On」安装授权引导文案；
 * - 已授权：展示设备接入状态；热插拔经 statechange 即时刷新（接入后作答发声自动关闭）。
 *
 * UA 检测在渲染期执行是安全的：非 idle 状态只出现在客户端交互之后，
 * SSR/首帧两侧都渲染 null，无 hydration 不一致。
 */
function MidiStatusLine({ api, isChoice }: { api: MidiInputApi; isChoice: boolean }) {
  // 节奏关卡为选择题作答，真琴无处发力——不展示 MIDI 状态，减少无关信息。
  if (isChoice) return null;
  const base = "mt-3 text-center text-xs";
  switch (api.status) {
    case "prompting": {
      const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
      return isFirefox ? (
        <p className={`${base} text-amber-700`}>
          🎹 Firefox 首次接入真琴：请按浏览器提示安装并授权「Site Permission Add-On（站点权限附加组件）」，
          完成后插入键盘即可直接弹奏作答。
        </p>
      ) : (
        <p className={`${base} text-neutral-500`}>🎹 正在请求真琴（MIDI）授权…</p>
      );
    }
    case "granted":
      return api.connected ? (
        <p className={`${base} text-emerald-700`}>
          🎹 真琴已接入（{api.inputNames.join("、")}）：直接弹奏作答；作答发声已关闭（真琴原声即反馈），示范音保留。
        </p>
      ) : (
        <p className={`${base} text-neutral-500`}>
          🎹 已授权 MIDI，未检测到真琴——插入键盘即自动接入；虚拟钢琴照常作答。
        </p>
      );
    case "denied":
      return (
        <p className={`${base} text-neutral-500`}>
          🎹 真琴授权未通过：使用虚拟钢琴作答，训练不受影响。
        </p>
      );
    default:
      // unsupported（Safari/iOS 静默回退）与 idle（未请求）：不渲染。
      return null;
  }
}

/**
 * 限时模式开关（ADR 0003：用户可选、默认关闭；仅节奏关卡渲染）。
 * idle 与 settled 两处展示——轮次进行中不可切换（一轮一个口径，限时轮独立落库）。
 */
function TimedModeToggle({
  limitMs,
  enabled,
  onToggle,
}: {
  limitMs: number;
  enabled: boolean;
  onToggle: () => void;
}) {
  const seconds = Math.round(limitMs / 1000);
  return (
    <div className="mt-5 flex items-start justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-sm">
        <p className="font-medium text-neutral-800">限时模式（可选）</p>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500">
          启用后每题时限 {seconds} 秒，超时记为错题、轮次继续；限时成绩单独计入个人排行榜。
          默认关闭，压力由自己掌控。
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="限时模式"
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-amber-500" : "bg-neutral-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            enabled ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/** 轮内进度点：绿 = 对 / 红 = 错 / 琥珀 = 当前题 / 灰 = 未出。 */
function ProgressDots({ history, total }: { history: History; total: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const state =
          i < history.length
            ? history[i]
              ? "bg-emerald-500"
              : "bg-red-500"
            : i === history.length
              ? "bg-amber-400"
              : "bg-neutral-200";
        return <span key={i} className={`h-2 w-2 rounded-full ${state}`} />;
      })}
    </div>
  );
}
