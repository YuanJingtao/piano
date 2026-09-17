import type { ComponentType } from "react";

import LandmarkNoteStage from "@/plugins/landmark-notes/stage";

import type { QuestionStageProps } from "./types";

/**
 * 题型 → 题面组件注册表（浏览器层，#38）：与技巧静态注册表同哲学（ADR 0007），
 * 新增题型 = 插件目录 stage.tsx + 此处一行。
 * 仅被客户端组件（PracticeStage）消费；未注册题型视为程序错误，直接抛。
 */
const QUESTION_STAGES: Readonly<Record<string, ComponentType<QuestionStageProps>>> = {
  "landmark-note": LandmarkNoteStage,
  // 后续技巧题型落地后在此追加（#39 键盘地理 / #40 方向与音程 / #41 节奏选择 …）
};

export function getQuestionStage(questionType: string): ComponentType<QuestionStageProps> {
  const stage = QUESTION_STAGES[questionType];
  if (!stage) {
    throw new Error(`getQuestionStage: 题型 "${questionType}" 未注册题面组件`);
  }
  return stage;
}
