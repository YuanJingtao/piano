import type { ComponentType } from "react";

import DirectionIntervalsTutorial from "@/plugins/direction-intervals/tutorial.mdx";
import FiveFingerTriadsTutorial from "@/plugins/five-finger-triads/tutorial.mdx";
import KeyboardGeographyTutorial from "@/plugins/keyboard-geography/tutorial.mdx";
import LandmarkNotesTutorial from "@/plugins/landmark-notes/tutorial.mdx";
import RhythmReadingTutorial from "@/plugins/rhythm-reading/tutorial.mdx";

/**
 * 教程页注册表（内容层）：技巧 id → MDX 教程组件，每技巧一行（ADR 0007 口径）。
 *
 * 为什么独立于 src/plugins/index.ts：MDX 模块只能由 Next 构建管线编译，
 * 而插件纯逻辑模块（manifest / samplePool / judge）要被 vitest（node 环境）直接 import，
 * 两者分层——插件目录同时含 index.ts（纯）与 tutorial.mdx（内容），
 * 注册分别落在两处，新增技巧 = 插件目录 + 两行注册。
 */
export const tutorials: Record<string, ComponentType> = {
  "keyboard-geography": KeyboardGeographyTutorial,
  "landmark-notes": LandmarkNotesTutorial,
  "direction-intervals": DirectionIntervalsTutorial,
  "rhythm-reading": RhythmReadingTutorial,
  "five-finger-triads": FiveFingerTriadsTutorial,
};
