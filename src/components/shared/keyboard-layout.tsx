"use client";

/**
 * 键盘布局（内部共享展示件）：虚拟钢琴（可交互）与键盘图（纯示意）共用的
 * 白/黑键几何渲染；几何计算在 src/lib/music/midi.ts（纯逻辑、可单测）。
 *
 * 不含发声与作答语义：交互事件原样上抛，由消费方（VirtualPiano → 训练/教程）决定。
 */

import { buildKeyboardGeometry, midiToNoteName } from "@/lib/music/midi";

/** 按下反馈色（无显式高亮时）：白键 / 黑键。 */
const PRESSED_WHITE_COLOR = "#fbbf24"; // amber-400
const PRESSED_BLACK_COLOR = "#d97706"; // amber-600

/** 黑键宽度 = 白键宽 × 该系数；黑键高度 = 整键盘高 × 该系数。 */
const BLACK_KEY_WIDTH_RATIO = 0.62;
const BLACK_KEY_HEIGHT_RATIO = 0.62;

export type KeyboardLayoutProps = {
  /** 最低键（白键）。 */
  lowestMidi: number;
  /** 最高键（白键）。 */
  highestMidi: number;
  /** midi → 高亮色（CSS color）：键盘图教学高亮 / 反馈着色共用。 */
  highlights?: Readonly<Record<number, string>>;
  /** 当前按下的键（虚拟钢琴视觉反馈）。 */
  pressedMidi?: number | null;
  /** false = 纯示意（键盘图）；true = 可交互（虚拟钢琴）。 */
  interactive?: boolean;
  disabled?: boolean;
  onKeyPointerDown?: (midi: number) => void;
  onKeyPointerUp?: (midi: number) => void;
  /** 外层容器类名；高度在此指定（如 h-40），默认 h-40。 */
  className?: string;
  ariaLabel?: string;
};

export function KeyboardLayout({
  lowestMidi,
  highestMidi,
  highlights = {},
  pressedMidi = null,
  interactive = false,
  disabled = false,
  onKeyPointerDown,
  onKeyPointerUp,
  className = "h-40",
  ariaLabel = "钢琴键盘",
}: KeyboardLayoutProps) {
  const geometry = buildKeyboardGeometry(lowestMidi, highestMidi);
  const whiteWidthPct = 100 / geometry.whiteKeyCount;
  const blackWidthPct = whiteWidthPct * BLACK_KEY_WIDTH_RATIO;
  const usable = interactive && !disabled;

  const backgroundFor = (midi: number, pressedColor: string): string | undefined =>
    highlights[midi] ?? (pressedMidi === midi ? pressedColor : undefined);

  const keyHandlers = (midi: number) =>
    usable
      ? {
          onPointerDown: (event: React.PointerEvent) => {
            // 阻止触摸端滚动/双击缩放与文本选择（配合 touch-none）。
            event.preventDefault();
            onKeyPointerDown?.(midi);
          },
          onPointerUp: () => onKeyPointerUp?.(midi),
          onPointerLeave: () => onKeyPointerUp?.(midi),
          onPointerCancel: () => onKeyPointerUp?.(midi),
        }
      : {};

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`relative w-full touch-none select-none ${className}`}
    >
      <div className="flex h-full w-full">
        {geometry.whiteKeys.map((key) => (
          <button
            key={key.midi}
            type="button"
            aria-label={midiToNoteName(key.midi)}
            disabled={!usable}
            className={`h-full flex-1 rounded-b-md border border-neutral-300 bg-white shadow-sm ${
              usable ? "cursor-pointer" : "cursor-default"
            }`}
            style={{ backgroundColor: backgroundFor(key.midi, PRESSED_WHITE_COLOR) }}
            {...keyHandlers(key.midi)}
          />
        ))}
      </div>
      {geometry.blackKeys.map((key) => (
        <button
          key={key.midi}
          type="button"
          aria-label={midiToNoteName(key.midi)}
          disabled={!usable}
          className={`absolute top-0 z-10 rounded-b-md border border-neutral-950 bg-neutral-900 shadow ${
            usable ? "cursor-pointer" : "cursor-default"
          }`}
          style={{
            left: `calc(${(key.leftWhiteIndex + 1) * whiteWidthPct}% - ${blackWidthPct / 2}%)`,
            width: `${blackWidthPct}%`,
            height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
            backgroundColor: backgroundFor(key.midi, PRESSED_BLACK_COLOR),
          }}
          {...keyHandlers(key.midi)}
        />
      ))}
    </div>
  );
}
