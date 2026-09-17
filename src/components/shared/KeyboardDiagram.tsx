"use client";

/**
 * 键盘图（教学示意件，ADR 0007：MDX 教程页内嵌的核心共享组件之一）：
 * 静态键盘 + 高亮键位 + 图例标注；不产出作答事件（作答用 VirtualPiano）。
 *
 * 典型用法：地标音教程页高亮五个锚点音（中央C / 高音G / 低音F / 高音C / 低音C）。
 */

import { midiToNoteName } from "@/lib/music/midi";

import { KeyboardLayout } from "./keyboard-layout";

export type KeyboardDiagramHighlight = {
  /** MIDI note number（音高唯一真源）。 */
  midi: number;
  /** 高亮色（CSS color）。 */
  color: string;
  /** 图例标注（如「中央C」）；提供后键盘图下方渲染图例。 */
  label?: string;
};

export type KeyboardDiagramProps = {
  /** 最低键（须为白键），默认 C3 = 48。 */
  lowestMidi?: number;
  /** 最高键（须为白键），默认 C5 = 72。 */
  highestMidi?: number;
  highlights?: readonly KeyboardDiagramHighlight[];
  className?: string;
};

export default function KeyboardDiagram({
  lowestMidi = 48,
  highestMidi = 72,
  highlights = [],
  className = "h-28",
}: KeyboardDiagramProps) {
  const highlightMap = Object.fromEntries(highlights.map((h) => [h.midi, h.color]));
  const legend = highlights.filter((h) => h.label);

  return (
    <figure className="not-prose">
      <KeyboardLayout
        lowestMidi={lowestMidi}
        highestMidi={highestMidi}
        highlights={highlightMap}
        className={className}
        ariaLabel="键盘图（示意）"
      />
      {legend.length > 0 && (
        <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
          {legend.map((h) => (
            <span key={h.midi} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: h.color }}
              />
              {h.label}（{midiToNoteName(h.midi)}）
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
