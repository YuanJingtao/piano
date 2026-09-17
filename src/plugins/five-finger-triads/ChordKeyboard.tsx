"use client";

/**
 * 多键作答键盘（插件局部组件，工单 #42；#43 真琴接入）：
 * 柱式和弦「多键同按」与键序列（级进片段/分解和弦）的作答收集——
 * 基于共享 KeyboardLayout（消费不改，核心共享件零改动，沿用 #40
 * PlayMelodyButton 插件局部件先例）。
 *
 * 交互口径：按序收集、集满 expectedCount 自动提交（与自动进题节奏协调）；
 * 提交前可「重按」清空重来。每按一键即发该键琴声（收集过程可听，边搭边校）——
 * 真琴接入时收集键声与判定声一同关闭（#43 AC3，真琴原声即反馈）。
 * 触屏多点同按天然支持（pointerdown 逐指触发）；桌面鼠标逐键点击等效。
 *
 * 真琴 noteon（#43 AC2）进入同一收集流：与虚拟按键同口径——集满自动提交；
 * 「集合无序」（柱式）还是「严格有序」（序列）语义由插件 judge 决定，
 * Round 引擎对来源全程不透明。
 *
 * browser-only：与 VirtualPiano 同定式，模块 SSR 安全（音频仅在事件内触达）。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { KeyboardLayout } from "@/components/shared/keyboard-layout";
import { getPianoAudio } from "@/lib/audio";
import type { MidiStageBridge } from "@/lib/midi/types";
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
  /** 真琴桥接（#43）：noteon 进入同一收集流；connected 时收集键声关闭。 */
  midi?: MidiStageBridge;
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
  midi,
  lowestMidi = 48,
  highestMidi = 84,
  className = "h-40",
}: ChordKeyboardProps) {
  const [collected, setCollected] = useState<readonly number[]>([]);
  const complete = collected.length >= expectedCount;

  /**
   * 事件回调读的最新快照：MIDI 订阅回调长寿命（collect 稳定引用），
   * 经 ref 读 props/收集态避免陈旧闭包；每次渲染提交后同步。
   */
  const collectedRef = useRef<readonly number[]>([]);
  const disabledRef = useRef(disabled);
  const expectedCountRef = useRef(expectedCount);
  const onSubmitRef = useRef(onSubmit);
  const midiConnectedRef = useRef(midi?.connected ?? false);
  useEffect(() => {
    disabledRef.current = disabled;
    expectedCountRef.current = expectedCount;
    onSubmitRef.current = onSubmit;
    midiConnectedRef.current = midi?.connected ?? false;
  });

  // 新题签发（question 引用变化）即清空收集；同题重出也重置。
  useEffect(() => {
    collectedRef.current = [];
    setCollected([]);
  }, [resetKey]);

  /** 统一收集入口（虚拟键点击与真琴 noteon 共用）；playSample = 虚拟键且未接真琴时发该键琴声。 */
  const collect = useCallback((note: number, playSample: boolean) => {
    if (disabledRef.current) return;
    const current = collectedRef.current;
    if (current.length >= expectedCountRef.current) return; // 已集满（提交后反馈锁定期间同样拦截）
    if (playSample && !midiConnectedRef.current) {
      getPianoAudio().playNote(note, { durationSeconds: 0.4 });
    }
    const next = [...current, note];
    collectedRef.current = next;
    setCollected(next);
    if (next.length === expectedCountRef.current) {
      onSubmitRef.current(next, performance.now());
    }
  }, []);

  // 真琴 noteon 进入同一收集流（#43 AC2）：不发采样声（真琴原声即反馈，AC3）。
  useEffect(() => {
    if (!midi) return;
    return midi.subscribeNoteOn(({ midi: note }) => collect(note, false));
  }, [midi, collect]);

  const highlights = Object.fromEntries(collected.map((note) => [note, COLLECTED_COLOR]));

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
          onClick={() => {
            collectedRef.current = [];
            setCollected([]);
          }}
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
        onKeyPointerDown={(note) => collect(note, true)}
        className={className}
        ariaLabel="虚拟钢琴（多键作答）"
      />
    </div>
  );
}
