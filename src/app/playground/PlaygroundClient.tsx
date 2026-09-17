"use client";

/**
 * Playground（#36 交付的验证页）：发声层 + 共享交互组件的人工走查入口。
 *
 * 验证项（对应工单验收标准）：
 * 1. 启动按钮（用户手势内 Tone.start()）→ 音频解锁状态；
 * 2. 虚拟钢琴点击/触摸发声，产出统一作答事件 { kind, midi, velocity, timestamp }；
 * 3. VexFlow 真实五线谱谱例：逐音符着色 + 文字标注（含黑键升号、低音谱号、柱式和弦）；
 * 4. 发声按钮（教程页听音环节复用）：单音 + 柱式和弦；
 * 5. 节奏点击声：振荡器合成、无音高（ta / ti-ti / 组合节奏型）；
 * 6. 键盘图：地标音高亮 + 图例。
 *
 * browser-only 集成（tech-selection §4）：'use client' + next/dynamic ssr:false。
 */

import dynamic from "next/dynamic";
import { useState } from "react";

import type { MidiAnswerEvent } from "@/lib/answer-event";
import { getPianoAudio } from "@/lib/audio";
import { midiToNoteName } from "@/lib/music/midi";
import { beatsToClickOffsets } from "@/lib/music/rhythm";

const VirtualPiano = dynamic(() => import("@/components/shared/VirtualPiano"), { ssr: false });
const ScoreExample = dynamic(() => import("@/components/shared/ScoreExample"), { ssr: false });
const PlayNoteButton = dynamic(() => import("@/components/shared/PlayNoteButton"), { ssr: false });
const KeyboardDiagram = dynamic(() => import("@/components/shared/KeyboardDiagram"), { ssr: false });

/** 地标音五色（键盘图与谱例共用）。 */
const LANDMARK_COLORS = {
  middleC: "#2563eb", // blue-600 中央C
  trebleG: "#d97706", // amber-600 高音G
  bassF: "#059669", // emerald-600 低音F
  trebleC: "#7c3aed", // violet-600 高音C
  bassC: "#dc2626", // red-600 低音C
} as const;

const RHYTHM_PATTERNS = [
  { id: "ta", name: "ta（四分音符 ×1）", beats: [1] },
  { id: "ti-ti", name: "ti-ti（八分音符 ×2）", beats: [0.5, 0.5] },
  { id: "ta-titi-ta-ta", name: "ta ti-ti ta ta", beats: [1, 0.5, 0.5, 1, 1] },
] as const;

const RHYTHM_BPM = 90;

type AudioPhase = "locked" | "starting" | "ready" | "error";

export default function PlaygroundClient() {
  const [audioPhase, setAudioPhase] = useState<AudioPhase>("locked");
  const [lastEvent, setLastEvent] = useState<MidiAnswerEvent | null>(null);

  async function handleStartAudio() {
    setAudioPhase("starting");
    try {
      // 本按钮点击即用户手势：Tone.start()（AudioContext 解锁）绑定于此（ADR 0005 / tech-selection §4③）。
      await getPianoAudio().start();
      setAudioPhase(getPianoAudio().ready ? "ready" : "error");
    } catch (error) {
      console.error("[playground] 音频解锁失败：", error);
      setAudioPhase("error");
    }
  }

  function handlePianoAnswer(event: MidiAnswerEvent) {
    setLastEvent(event);
    // 虚拟钢琴作答发声（MIDI 真琴接入时此行关闭、真琴原声即反馈，ADR 0005）。
    getPianoAudio().playNote(event.midi, { durationSeconds: 1, velocity: event.velocity });
  }

  function handleRhythmPattern(beats: readonly number[]) {
    getPianoAudio().playRhythmClick(beatsToClickOffsets(beats, RHYTHM_BPM));
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Playground · 发声层与共享交互组件</h1>
        <p className="mt-2 text-neutral-600">
          工单 #36 验证页：音频解锁、虚拟钢琴作答、VexFlow 谱例、发声按钮、节奏点击声、键盘图。
        </p>
      </header>

      {/* 1. 音频解锁（用户手势内 Tone.start()） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1 · 音频解锁</h2>
        <p className="mt-1 text-sm text-neutral-600">
          浏览器要求在用户手势内解锁 AudioContext；点击启动后其余区块才可发声。
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleStartAudio}
            disabled={audioPhase === "starting" || audioPhase === "ready"}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {audioPhase === "ready" ? "已就绪" : audioPhase === "starting" ? "解锁中…" : "启动音频"}
          </button>
          <span
            className={`inline-flex items-center gap-2 text-sm ${
              audioPhase === "error" ? "text-rose-600" : "text-neutral-600"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                audioPhase === "ready"
                  ? "bg-emerald-500"
                  : audioPhase === "error"
                    ? "bg-rose-500"
                    : "bg-neutral-300"
              }`}
            />
            {audioPhase === "ready"
              ? "采样已加载，AudioContext 已解锁"
              : audioPhase === "error"
                ? "解锁/加载失败，请查看控制台"
                : "未解锁"}
          </span>
        </div>
      </section>

      {/* 2. 虚拟钢琴（作答入口） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">2 · 虚拟钢琴（C3–C6）</h2>
        <p className="mt-1 text-sm text-neutral-600">
          点击/触摸琴键：发声并产出统一作答事件（与 MIDI 真琴归一，#43 接入后同一出口）。
        </p>
        <div className="mt-4">
          <VirtualPiano onAnswer={handlePianoAnswer} />
        </div>
        <p className="mt-3 font-mono text-xs text-neutral-500" aria-live="polite">
          {lastEvent
            ? `最近作答：{ kind: "${lastEvent.kind}", midi: ${lastEvent.midi}（${midiToNoteName(lastEvent.midi)}）, velocity: ${lastEvent.velocity}, timestamp: ${lastEvent.timestamp.toFixed(1)} }`
            : "最近作答：（尚无）"}
        </p>
      </section>

      {/* 3. VexFlow 谱例（着色 + 标注） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">3 · VexFlow 谱例</h2>
        <p className="mt-1 text-sm text-neutral-600">
          真实五线谱 SVG 输出；逐音符着色 + 文字标注（教学标注 API）；黑键自动加升号；含低音谱号与柱式和弦。
        </p>
        <div className="mt-4 flex flex-col gap-6">
          <div>
            <h3 className="mb-1 text-sm font-medium text-neutral-700">高音谱号 · 地标音（着色 + 标注）</h3>
            <ScoreExample
              notes={[
                { midi: 60, duration: "q", color: LANDMARK_COLORS.middleC, label: "中央C" },
                { midi: 64, duration: "q" },
                { midi: 67, duration: "q", color: LANDMARK_COLORS.trebleG, label: "高音G" },
                { midi: 72, duration: "q", color: LANDMARK_COLORS.trebleC, label: "高音C" },
              ]}
              width={480}
            />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium text-neutral-700">低音谱号 · 低音F / 黑键升号 / 八分音符</h3>
            <ScoreExample
              clef="bass"
              notes={[
                { midi: 53, duration: "q", color: LANDMARK_COLORS.bassF, label: "低音F" },
                { midi: 54, duration: "8", label: "F#3（黑键适配）" },
                { midi: 48, duration: "h", color: LANDMARK_COLORS.bassC, label: "低音C" },
              ]}
              width={480}
            />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium text-neutral-700">柱式和弦（和弦题整体呈现）</h3>
            <ScoreExample
              notes={[
                { midi: [60, 64, 67], duration: "h", color: "#0891b2", label: "C 大三和弦" },
                { midi: [57, 60, 64], duration: "h" },
              ]}
              width={480}
            />
          </div>
        </div>
      </section>

      {/* 4. 发声按钮（教程页听音环节复用） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">4 · 发声按钮（示范音）</h2>
        <p className="mt-1 text-sm text-neutral-600">
          教程页听音环节复用件；首次点击的手势内同时完成音频解锁（无需先按上方启动按钮）。
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <PlayNoteButton midi={60} label="▶ 听中央C" />
          <PlayNoteButton midi={67} label="▶ 听高音G" />
          <PlayNoteButton midi={[60, 64, 67]} label="▶ 听 C 大三和弦（柱式）" durationSeconds={1.5} />
        </div>
      </section>

      {/* 5. 节奏点击声（振荡器合成、无音高） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">5 · 节奏点击声</h2>
        <p className="mt-1 text-sm text-neutral-600">
          振荡器合成短促打击声（无音高、非采样），服务于「听节奏选谱面」题型；bpm = {RHYTHM_BPM}。
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {RHYTHM_PATTERNS.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              onClick={() => handleRhythmPattern(pattern.beats)}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
            >
              ♪ {pattern.name}
            </button>
          ))}
        </div>
      </section>

      {/* 6. 键盘图（教学示意） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">6 · 键盘图（地标音高亮）</h2>
        <p className="mt-1 text-sm text-neutral-600">
          教程页示意件：五个地标音高亮 + 图例；不产出作答事件（作答用上方虚拟钢琴）。
        </p>
        <div className="mt-4">
          <KeyboardDiagram
            lowestMidi={48}
            highestMidi={72}
            highlights={[
              { midi: 48, color: LANDMARK_COLORS.bassC, label: "低音C" },
              { midi: 53, color: LANDMARK_COLORS.bassF, label: "低音F" },
              { midi: 60, color: LANDMARK_COLORS.middleC, label: "中央C" },
              { midi: 67, color: LANDMARK_COLORS.trebleG, label: "高音G" },
              { midi: 72, color: LANDMARK_COLORS.trebleC, label: "高音C" },
            ]}
          />
        </div>
      </section>
    </main>
  );
}
