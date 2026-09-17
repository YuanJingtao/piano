import type { LevelDef, RoundResult } from "@/domain/types";
import type { SettlementPayload } from "@/lib/persistence/contracts";

/**
 * RoundResult → POST /api/sessions 请求体的纯函数映射（#38 训练闭环接线）。
 *
 * 口径对齐 #35 契约：
 * - params = 当轮参数反规范化快照（结算时刻定格，来源 LevelDef，ADR 0006）；
 * - questionType = 题目判别字段的关卡口径（同关卡题型一致，取首条记录）；
 * - responseMs / medianResponseMs 取整（引擎中位数在偶数题时可能为 x.5，
 *   服务端校验要求整数）；
 * - answers 覆盖整轮全部记录（分母恒定，服务端校验长度 = questionCount）；
 *   超时未作答的记录 answer 为 null（#34 QuestionRecord.answer 省略 → 契约 null）。
 */
export function buildSettlementPayload(args: {
  techniqueId: string;
  level: LevelDef;
  result: RoundResult;
}): SettlementPayload {
  const { techniqueId, level, result } = args;
  // settle() 前置条件保证 records 满员（questionCount ≥ 1），首条必存在；
  // 兜底仅为类型完备，正常流程不会走到。
  const questionType = result.records[0]?.question.type ?? level.id;

  return {
    techniqueId,
    levelId: level.id,
    params: {
      questionType,
      questionCount: level.questionCount,
      minAccuracy: level.pass.minAccuracy,
      maxMedianResponseMs: level.pass.maxMedianResponseMs ?? null,
      timeLimitMs: level.timeLimitMs ?? null,
    },
    result: {
      passed: result.passed,
      correctCount: result.correctCount,
      accuracy: result.accuracy,
      medianResponseMs: Math.round(result.medianResponseMs),
    },
    answers: result.records.map((r) => ({
      question: r.question,
      answer: r.answer ?? null,
      ok: r.ok,
      responseMs: Math.round(r.responseMs),
      timedOut: r.timedOut,
    })),
  };
}
