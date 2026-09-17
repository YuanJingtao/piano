"use client";

/**
 * VexFlow 谱例组件（tech-selection §1：VexFlow 5，SVG 输出）：
 * 真实五线谱渲染，支持逐音符着色与文字标注（教学标注 API）——
 * 教程页内嵌谱例与训练关卡题目呈现共用（ADR 0007）。
 *
 * 两种形态：
 * - 单谱表简写：notes + clef（训练题目、单行谱例）；
 * - 多谱表堆叠：staves 数组，单 SVG 内垂直排布（大谱表 / 地标音镜像对称谱例），
 *   brace=true 画大谱表花括号（StaveConnector）。VexFlow 多系统排版验证见 #37 决议：
 *   教程页由多个独立单行谱例 + 堆叠谱表构成，手动 Stave 排布完全够用。
 *
 * 音高唯一真源是 MIDI note number，经 midiToVexKey（src/lib/music/midi.ts）适配为
 * VexFlow key（如 60 → "c/4"）；黑键的升降号由本组件显式加 Accidental（StaveNote 不自动渲染）。
 *
 * browser-only：vexflow 在 effect 内动态 import；集成处用 next/dynamic ssr:false
 * 或直接作为客户端组件渲染（模块本身 SSR 安全，effect 在服务端不执行）。
 */

import { useEffect, useRef } from "react";

import { midiToVexKey } from "@/lib/music/midi";

/** 首版时值范围：全/二分/四分/八分音符（设计文档 #31「考核参数」），与 VexFlow duration 字符串一致。 */
export type ScoreDuration = "w" | "h" | "q" | "8";

export type ScoreNoteSpec = {
  /** 单音或柱式和弦（和弦题整体呈现，ADR 0005）。 */
  midi: number | readonly number[];
  duration: ScoreDuration;
  /** 逐音符着色（教学高亮 / 对错反馈色）。 */
  color?: string;
  /** 文字标注（音符上方，如「中央 C」「高音 G」）。 */
  label?: string;
};

/** 多谱表堆叠时的单行谱表定义。 */
export type ScoreStaveSpec = {
  /** 省略则沿用顶层 clef。 */
  clef?: "treble" | "bass";
  /** 省略则沿用顶层 timeSignature；显式传 null 不显示拍号。 */
  timeSignature?: string | null;
  notes: readonly ScoreNoteSpec[];
};

export type ScoreExampleProps = {
  /** 单谱表简写；提供 staves 时忽略。 */
  notes?: readonly ScoreNoteSpec[];
  clef?: "treble" | "bass";
  /** 默认 "4/4"（首版仅 4/4 拍）；传 null 则不显示拍号。 */
  timeSignature?: string | null;
  /** 多谱表垂直堆叠（大谱表 / 镜像对称谱例）；与 notes 二选一。 */
  staves?: readonly ScoreStaveSpec[];
  /** staves ≥2 时画大谱表花括号连接首末谱表。 */
  brace?: boolean;
  width?: number;
  className?: string;
};

/** 垂直排布：首谱表顶部留白（音符上方文字标注空间）→ 每谱表一块 → 底部留白（下加线空间）。 */
const TOP_PADDING = 30;
const STAVE_BLOCK = 100;
const BOTTOM_PADDING = 20;

export default function ScoreExample({
  notes = [],
  clef = "treble",
  timeSignature = "4/4",
  staves,
  brace = false,
  width = 480,
  className,
}: ScoreExampleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    (async () => {
      const { Renderer, Stave, StaveNote, Accidental, Annotation, Formatter, StaveConnector } =
        await import("vexflow");
      if (disposed || !containerRef.current) return;

      const staveSpecs: readonly ScoreStaveSpec[] = staves ?? [{ clef, notes }];

      container.innerHTML = "";
      const height = TOP_PADDING + staveSpecs.length * STAVE_BLOCK + BOTTOM_PADDING;
      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont("Arial", 10);

      const drawnStaves = staveSpecs.map((spec, index) => {
        const staveClef = spec.clef ?? clef;
        const staveTimeSignature = spec.timeSignature !== undefined ? spec.timeSignature : timeSignature;
        const stave = new Stave(0, TOP_PADDING + index * STAVE_BLOCK, width);
        stave.addClef(staveClef);
        if (staveTimeSignature) stave.addTimeSignature(staveTimeSignature);
        stave.setContext(context);
        stave.draw();

        if (spec.notes.length > 0) {
          const staveNotes = spec.notes.map((noteSpec) => {
            const midis =
              typeof noteSpec.midi === "number" ? [noteSpec.midi] : [...noteSpec.midi].sort((a, b) => a - b);
            const vexKeys = midis.map(midiToVexKey);
            const note = new StaveNote({
              keys: vexKeys.map((k) => k.key),
              duration: noteSpec.duration,
            });
            vexKeys.forEach((k, keyIndex) => {
              if (k.accidental) note.addModifier(new Accidental(k.accidental), keyIndex);
            });
            if (noteSpec.color) {
              note.setStyle({ fillStyle: noteSpec.color, strokeStyle: noteSpec.color });
            }
            if (noteSpec.label) {
              const annotation = new Annotation(noteSpec.label);
              annotation.setFont("Arial", 11);
              annotation.setVerticalJustification(Annotation.VerticalJustify.TOP);
              note.addModifier(annotation);
            }
            return note;
          });
          Formatter.FormatAndDraw(context, stave, staveNotes);
        }
        return stave;
      });

      if (brace && drawnStaves.length >= 2) {
        new StaveConnector(drawnStaves[0], drawnStaves[drawnStaves.length - 1])
          .setType("brace")
          .setContext(context)
          .draw();
      }
    })().catch((error: unknown) => {
      console.error("[score-example] VexFlow 渲染失败：", error);
    });

    return () => {
      disposed = true;
      container.innerHTML = "";
    };
  }, [notes, clef, timeSignature, staves, brace, width]);

  const staveSpecs = staves ?? [{ clef, notes }];
  const noteCount = staveSpecs.reduce((sum, s) => sum + s.notes.length, 0);
  const clefNames = [...new Set(staveSpecs.map((s) => s.clef ?? clef))]
    .map((c) => (c === "treble" ? "高音" : "低音"))
    .join(" + ");

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`五线谱谱例（${clefNames}谱号，${staveSpecs.length} 行谱表，${noteCount} 个音符）`}
      className={className}
    />
  );
}
