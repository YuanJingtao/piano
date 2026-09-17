import { drawQuestion, questionKey } from "./sampling";
import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  QuestionRecord,
  RoundResult,
  TechniquePlugin,
} from "./types";

export type RoundConfig = {
  level: LevelDef;
  plugin: TechniquePlugin;
  /** 上一轮（未达标重来/复习）带入的错题池；省略则为空。纯前端内存态，不跨轮次持久化。 */
  mistakePool?: readonly Question[];
  /** 注入以做确定性测试；默认 Math.random。 */
  rng?: () => number;
  /** 注入以做确定性测试；默认 Date.now。 */
  now?: () => number;
};

/**
 * 核心 Round 引擎：ADR 0004/0007 锁定的产品级流程规则全部集中在此，插件不含流程逻辑。
 *
 * 职责：轮次题数控制、有放回随机抽样 + 不连出、加权错题池（3× 权重、答对移出、
 * 达标即弃）、逐题记录、轮末结算与阈值判定、限时模式超时口径。
 *
 * 用法：
 * ```ts
 * const round = new Round({ level, plugin, mistakePool });
 * for (let q = round.next(); q; q = round.next()) {
 *   // 浏览器层：plugin.render(q.question) → plugin.interact() →
 *   //   round.submit(answer)；限时模式超时 → round.timeout()
 * }
 * const result = round.settle();
 * ```
 */
export class Round {
  private readonly level: LevelDef;
  private readonly plugin: TechniquePlugin;
  private readonly pool: Question[];
  private readonly rng: () => number;
  private readonly now: () => number;
  private readonly mistakes: Map<string, Question>;
  private readonly records: QuestionRecord[] = [];
  private current: { question: Question; issuedAt: number } | undefined;

  constructor(config: RoundConfig) {
    this.level = config.level;
    this.plugin = config.plugin;
    this.pool = [...config.plugin.samplePool(config.level)];
    if (this.pool.length === 0) {
      throw new Error(`Round: samplePool returned empty pool for level ${config.level.id}`);
    }
    this.rng = config.rng ?? Math.random;
    this.now = config.now ?? Date.now;
    this.mistakes = new Map((config.mistakePool ?? []).map((q) => [questionKey(q), q]));
  }

  /** 抽并签发下一题；轮次满员返回 undefined。当前题未 submit/timeout 前不得再抽。 */
  next(): { question: Question; index: number } | undefined {
    if (this.current) throw new Error("Round: current question not answered or timed out");
    if (this.records.length >= this.level.questionCount) return undefined;
    const last = this.records.at(-1);
    const q = drawQuestion({
      pool: this.pool,
      mistakes: [...this.mistakes.values()],
      lastKey: last ? questionKey(last.question) : undefined,
      rng: this.rng,
    });
    this.current = { question: q, issuedAt: this.now() };
    return { question: q, index: this.records.length };
  }

  /** 提交当前题作答；返回插件判定（行内反馈内容）。响应 ms 由引擎计时。 */
  submit(answer: AnswerEvent): Judgement {
    if (!this.current) throw new Error("Round: no current question");
    const { question, issuedAt } = this.current;
    const responseMs = this.now() - issuedAt;
    const judgement = this.plugin.judge(question, answer);
    this.records.push({ question, answer, ok: judgement.ok, responseMs, timedOut: false });
    this.current = undefined;
    return judgement;
  }

  /**
   * 当前题超时（仅限时模式关卡可用）：记为错题、responseMs 记为时限值、轮次继续
   * （ADR 0003）。不调用插件 judge——没有真实作答可判。
   */
  timeout(): void {
    if (!this.current) throw new Error("Round: no current question");
    if (this.level.timeLimitMs === undefined) {
      throw new Error("Round: timeout() called on a level without timeLimitMs");
    }
    this.records.push({
      question: this.current.question,
      ok: false,
      responseMs: this.level.timeLimitMs,
      timedOut: true,
    });
    this.current = undefined;
  }

  /** 轮次是否已满员且当前题已结（可 settle）。 */
  isComplete(): boolean {
    return this.current === undefined && this.records.length === this.level.questionCount;
  }

  /**
   * 轮末结算：正确率 + 中位响应 vs 阈值；达标即弃错题池，未达标产出下一轮错题池。
   * 分母恒为关卡题数（整轮重来、无补出题，ADR 0004）。
   */
  settle(): RoundResult {
    if (!this.isComplete()) throw new Error("Round: settle() before round complete");
    const questionCount = this.records.length;
    const correctCount = this.records.filter((r) => r.ok).length;
    const accuracy = correctCount / questionCount;
    const medianResponseMs = median(this.records.map((r) => r.responseMs));
    const passed =
      accuracy >= this.level.pass.minAccuracy &&
      (this.level.pass.maxMedianResponseMs === undefined ||
        medianResponseMs <= this.level.pass.maxMedianResponseMs);

    return {
      passed,
      questionCount,
      correctCount,
      accuracy,
      medianResponseMs,
      records: [...this.records],
      nextMistakePool: passed ? [] : this.computeNextMistakes(),
    };
  }

  /**
   * 错题池更新（仅未达标时调用，ADR 0004）：
   * - 本轮答错过的题全部入池——含轮内先错后对的题（未达标轮的失败成因
   *   必须在重来轮以 3× 权重再暴露，否则重来轮与全新轮无异）；
   * - 带入的错题：本轮答对一次即移出；再次答错或本轮未抽中则保留。
   */
  private computeNextMistakes(): Question[] {
    const wrong = new Map<string, Question>();
    const correct = new Set<string>();
    for (const r of this.records) {
      const k = questionKey(r.question);
      if (r.ok) correct.add(k);
      else wrong.set(k, r.question);
    }
    const next = new Map<string, Question>();
    for (const [k, q] of this.mistakes) {
      if (wrong.has(k) || !correct.has(k)) next.set(k, q);
    }
    for (const [k, q] of wrong) next.set(k, q);
    return [...next.values()];
  }
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
