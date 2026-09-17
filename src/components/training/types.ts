import type { AnswerEvent, Judgement, Question } from "@/domain/types";
import type { MidiStageBridge } from "@/lib/midi/types";

/**
 * 题面组件契约（浏览器层内容差异点，#38 定形）：
 * ADR 0007 四件内容差异点中的「题目渲染 + 作答交互」两件的 React 形态——
 * 每个题型一个组件，落在插件目录 stage.tsx，按 Question.type 注册于
 * question-stages.tsx；流程规则（轮次控制 / 结算 / 落库）全部在 PracticeStage，
 * 题面组件只做呈现与作答收集。
 *
 * 声音约定（ADR 0005）：出题即发声与作答反馈声（答错播「你的音→正确音」）
 * 属题型内容差异，由题面组件内部实现——仅内部钩子，无用户开关。
 */
export type QuestionStageProps = {
  /** 当前题目（插件产出的可序列化对象）。 */
  question: Question;
  /** 本题已提交的作答；等待作答时为 null。 */
  answer: AnswerEvent | null;
  /** 本题判定结果（含行内反馈文案）；等待作答时为 null。 */
  judgement: Judgement | null;
  /** 作答事件上抛（PracticeStage 调 Round.submit 并驱动流程）。 */
  onAnswer: (event: AnswerEvent) => void;
  /** 是否可作答：反馈展示 / 结算阶段为 false（锁定交互）。 */
  interactive: boolean;
  /**
   * MIDI 真琴桥接（#43）：noteon 归一为统一作答事件与虚拟钢琴同流；
   * connected 时作答发声关闭、示范音保留（ADR 0005）。
   * 选择题题面（节奏）无键盘作答，忽略即可。
   */
  midi?: MidiStageBridge;
};
