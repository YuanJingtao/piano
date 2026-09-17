import type { MDXComponents } from "mdx/types";

import KeyboardDiagram from "@/components/shared/KeyboardDiagram";
import PlayNoteButton from "@/components/shared/PlayNoteButton";
import PlayRhythmButton from "@/components/shared/PlayRhythmButton";
import ScoreExample from "@/components/shared/ScoreExample";

/**
 * MDX 全局组件注入（@next/mdx 约定文件，必须位于 src/ 根）。
 *
 * 教程页（MDX）直接以 JSX 使用共享交互组件（ADR 0007：MDX 教程页与训练关卡共用），
 * 无需在每个 MDX 文件里 import。各组件均为 'use client' 且模块 SSR 安全
 * （VexFlow / Tone 仅在 effect / 事件处理器内动态加载，#36 定式），
 * 可在服务端渲染的 MDX 中直接引用。
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    ScoreExample,
    KeyboardDiagram,
    PlayNoteButton,
    PlayRhythmButton,
  };
}
