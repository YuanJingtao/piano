/**
 * 持久化层契约：前后端共享类型（ADR 0006 全 TypeScript 栈）。
 * 字段命名与领域内核（#34 的 QuestionRecord / RoundResult / PassRule / LevelDef）
 * 结构对齐，训练闭环集成（#38）时客户端可直接映射提交。
 */

/** 首版 seed 单用户的固定 id（迁移 0001 写入）。 */
export const DEFAULT_USER_ID = "default";

/**
 * 当轮参数反规范化快照（题型、题数、阈值、时限值）。
 * 结算时刻定格：插件日后调参不使历史统计口径漂移。
 */
export type SessionParamsSnapshot = {
  /** 题型（Question.type 的关卡口径，如 "note-choice"）。 */
  questionType: string;
  /** 题数（快答 12 / 弹奏 8，分母恒定）。 */
  questionCount: number;
  /** 正确率阈值下限，0..1（快答 0.9 / 弹奏 0.85）。 */
  minAccuracy: number;
  /** 中位响应阈值上限（ms），仅快答关卡；弹奏/节奏为 null。 */
  maxMedianResponseMs?: number | null;
  /** 逐题响应时限（ms），仅限时模式启用；非限时为 null。 */
  timeLimitMs?: number | null;
};

/** 轮末结算结果。判定在客户端 Round 引擎完成，服务端只持久化、不做判定。 */
export type SessionResult = {
  passed: boolean;
  correctCount: number;
  accuracy: number;
  medianResponseMs: number;
};

/** 逐题作答载荷：题目 JSONB 特征快照 + 用户作答 + 对错 + 响应 ms。 */
export type AnswerPayload = {
  /** 题目特征快照（如 {type, midi, clef} / {type, patternId}），JSONB 落库。 */
  question: Record<string, unknown>;
  /** 用户作答（统一作答事件）；超时未作答为 null。 */
  answer?: unknown;
  ok: boolean;
  /** 响应毫秒；超时题记为时限值。 */
  responseMs: number;
  timedOut: boolean;
};

/** POST /api/sessions 请求体：一次提交当轮 PracticeSession + 全部 AnswerRecord。 */
export type SettlementPayload = {
  techniqueId: string;
  levelId: string;
  params: SessionParamsSnapshot;
  result: SessionResult;
  answers: AnswerPayload[];
};

/** 最佳成绩：结算时刻快照（正确率降序、中位响应升序 tiebreak 的胜者）。 */
export type BestScore = {
  correctCount: number;
  questionCount: number;
  accuracy: number;
  medianResponseMs: number;
  /** ISO 时间戳。 */
  achievedAt: string;
};

/**
 * 课程树派生所需的技巧 manifest 结构视图（ADR 0007：解锁/毕业运行时派生，不落库）。
 * #34 静态注册表的 TechniqueManifest 结构上满足此类型（多出的字段自动兼容），
 * 集成时直接传入，无需转换。
 */
export type CourseTechnique = {
  id: string;
  title?: string;
  /** 主线 / 支线归属。 */
  track: "main" | "side";
  /** 前置技巧 id；主线线性、支线声明前置主线。 */
  prerequisites: string[];
  /** 关卡按教学顺序排列 = 关卡内线性递进。 */
  levels: ReadonlyArray<{ id: string; title?: string }>;
};

export type CourseTreeLevelState = {
  id: string;
  title?: string;
  unlocked: boolean;
  passed: boolean;
  best: BestScore | null;
};

export type CourseTreeTechniqueState = {
  id: string;
  title?: string;
  track: "main" | "side";
  unlocked: boolean;
  /** 全部关卡通过 = 技巧毕业（派生，不落库）。 */
  graduated: boolean;
  levels: CourseTreeLevelState[];
};
