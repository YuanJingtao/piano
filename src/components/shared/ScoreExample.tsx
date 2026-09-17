"use client";

/**
 * VexFlow 谱例组件（tech-selection §1：VexFlow 5，SVG 输出）：
 * 真实五线谱渲染，支持逐音符着色与文字标注（教学标注 API）——
 * 教程页内嵌谱例与训练关卡题目呈现共用（ADR 0007）。
 *
 * 音高唯一真源是 MIDI note number，经 midiToVexKey（src/lib/music/midi.ts）适配为
 * VexFlow key（如 60 → "c/4"）；黑键的升降号由本组件显式加 Accidental（StaveNote 不自动渲染）。
 *
 * browser-only：vexflow 在 effect 内动态 import；集成处用 next/dynamic ssr:false。
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
  /** 文字标注（音符上方，如「中央C」「高音G」）。 */
  label?: string;
};

export type ScoreExampleProps = {
  notes: readonly ScoreNoteSpec[];
  clef?: "treble" | "bass";
  /** 默认 "4/4"（首版仅 4/4 拍）；传 null 则不显示拍号。 */
  timeSignature?: string | null;
  width?: number;
  className?: string;
};

const HEIGHT = 150;

export default function ScoreExample({
  notes,
  clef = "treble",
  timeSignature = "4/4",
  width = 480,
  className,
}: ScoreExampleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    (async () => {
      const { Renderer, Stave, StaveNote, Accidental, Annotation, Formatter } = await import("vexflow");
      if (disposed || !containerRef.current) return;

      container.innerHTML = "";
      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(width, HEIGHT);
      const context = renderer.getContext();
      context.setFont("Arial", 10);

      const stave = new Stave(0, 10, width);
      stave.addClef(clef);
      if (timeSignature) stave.addTimeSignature(timeSignature);
      stave.setContext(context);
      stave.draw();

      const staveNotes = notes.map((spec) => {
        const midis = typeof spec.midi === "number" ? [spec.midi] : [...spec.midi].sort((a, b) => a - b);
        const vexKeys = midis.map(midiToVexKey);
        const note = new StaveNote({
          keys: vexKeys.map((k) => k.key),
          duration: spec.duration,
        });
        vexKeys.forEach((k, index) => {
          if (k.accidental) note.addModifier(new Accidental(k.accidental), index);
        });
        if (spec.color) {
          note.setStyle({ fillStyle: spec.color, strokeStyle: spec.color });
        }
        if (spec.label) {
          const annotation = new Annotation(spec.label);
          annotation.setFont("Arial", 11);
          annotation.setVerticalJustification(Annotation.VerticalJustify.TOP);
          note.addModifier(annotation);
        }
        return note;
      });

      Formatter.FormatAndDraw(context, stave, staveNotes);
    })().catch((error: unknown) => {
      console.error("[score-example] VexFlow 渲染失败：", error);
    });

    return () => {
      disposed = true;
      container.innerHTML = "";
    };
  }, [notes, clef, timeSignature, width]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`五线谱谱例（${clef === "treble" ? "高音" : "低音"}谱号，${notes.length} 个音符）`}
      className={className}
    />
  );
}
