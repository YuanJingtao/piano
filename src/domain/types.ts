/**
 * 领域内核类型：技巧插件窄接口 + Round 引擎数据流。
 *
 * 纯 TypeScript，无 DOM / DB / 浏览器 API 依赖（seam 1 的测试底座）。
 * 插件内容差异点四件（ADR 0007）：题池采样空间 / 题目渲染 / 作答交互 / 判定——
 * 其中纯逻辑两件（samplePool / judge）由本接口约束；
 * 浏览器两件（渲染 + 作答交互）落为插件目录的 React 题面组件 stage.tsx
 * （契约见 src/components/training/types.ts，按题型注册），#38 训练闭环形态确定。
 */

/** 题目：插件产出的 JSON 可序列化对象；`type` 为判别字段，其余字段由技巧自定义。 */
export type Question = { type: string } & Record<string, unknown>;

/**
 * 统一作答事件：虚拟钢琴与 MIDI 真琴归一为 midi；节奏选择/匹配题为 choice；
 * 多键作答为 keys（#42 附加扩展：柱式和弦 / 级进片段 / 分解和弦——按键顺序收集，
 * 「集合无序」（柱式）还是「严格有序」（片段/分解）语义由插件 judge 决定；
 * Round 引擎对作答事件全程不透明，流程规则零改动）。
 */
export type AnswerEvent =
  | { kind: "midi"; midi: number; velocity: number; timestamp: number }
  | { kind: "choice"; choiceId: string; timestamp: number }
  | { kind: "keys"; midis: readonly number[]; timestamp: number };

/** 判定结果：核心引擎只消费 ok；feedback 为行内展示内容（✓/✗ + 音名 + ms），由插件负责。 */
export type Judgement = {
  ok: boolean;
  feedback: string;
};

/** 通过规则：正确率下限；快答关卡另加中位响应上限。 */
export type PassRule = {
  /** 0..1，如快答 0.9 / 弹奏 0.85。 */
  minAccuracy: number;
  /** 快答关卡必填（如 3000）；弹奏/节奏省略。 */
  maxMedianResponseMs?: number;
};

/** 关卡定义：题数、阈值、时限（限时模式）；pool 为技巧自定义的题池采样空间描述。 */
export type LevelDef = {
  id: string;
  title: string;
  questionCount: number;
  pass: PassRule;
  /** 逐题响应时限（ms），仅限时模式关卡设置；超时记为错题、ms 记为时限值。 */
  timeLimitMs?: number;
  /** 技巧自定义的题池采样空间；由 samplePool 消费。 */
  pool: unknown;
};

/** 技巧 manifest：身份、主线/支线归属、前置技巧、关卡列表。 */
export type TechniqueManifest = {
  id: string;
  title: string;
  track: "main" | "side";
  /** 前置技巧 id 列表；主线线性、支线声明前置主线。 */
  prerequisites: string[];
  levels: LevelDef[];
};

/**
 * 技巧插件窄接口：类型即契约（纯逻辑两件）。
 * 流程规则全部在核心 Round 引擎；题目渲染与作答交互（浏览器两件）
 * 由插件目录的 stage.tsx React 组件承担（#38 定形，见 QuestionStageProps）。
 */
export interface TechniquePlugin {
  manifest: TechniqueManifest;
  /** 题池采样空间：供核心抽取，返回该关全部候选题。 */
  samplePool(level: LevelDef): Question[];
  /** 判定：ok + 行内反馈内容。 */
  judge(q: Question, a: AnswerEvent): Judgement;
}

/** 逐题作答记录：结算后持久化为 AnswerRecord（#35 落库）。 */
export type QuestionRecord = {
  question: Question;
  /** 实际作答；超时无作答时为 undefined。 */
  answer?: AnswerEvent;
  ok: boolean;
  /** 响应毫秒；超时题记为时限值。 */
  responseMs: number;
  timedOut: boolean;
};

/** 轮次结算结果。 */
export type RoundResult = {
  passed: boolean;
  questionCount: number;
  correctCount: number;
  accuracy: number;
  medianResponseMs: number;
  records: QuestionRecord[];
  /** 下一轮（重来/复习）应使用的错题池；达标时为空（池即弃）。 */
  nextMistakePool: Question[];
};
