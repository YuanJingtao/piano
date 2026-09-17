import type { Sql } from "@/lib/db";
import {
  DEFAULT_USER_ID,
  type AnswerPayload,
  type BestScore,
  type SettlementPayload,
} from "./contracts";
import {
  asBoolean,
  asDate,
  asInteger,
  asNumber,
  asRecord,
  asRowList,
  asString,
} from "./narrow";

/* ---------- 请求体校验（结构校验，不重判作答——判定在客户端，ADR 0006） ---------- */

export type ParseResult =
  | { ok: true; value: SettlementPayload }
  | { ok: false; error: string };

function fail(error: string): ParseResult {
  return { ok: false, error };
}

function requiredString(rec: Record<string, unknown>, key: string): string | null {
  const v = asString(rec[key]);
  return v !== null && v.length > 0 ? v : null;
}

function optionalPositiveInt(
  rec: Record<string, unknown>,
  key: string,
): number | null | undefined {
  const raw = rec[key];
  if (raw === undefined || raw === null) return null;
  const n = asInteger(raw);
  return n !== null && n > 0 ? n : undefined; // undefined = 校验失败
}

export function parseSettlementPayload(body: unknown): ParseResult {
  const root = asRecord(body);
  if (!root) return fail("请求体必须是 JSON 对象");

  const techniqueId = requiredString(root, "techniqueId");
  if (!techniqueId) return fail("techniqueId 必须是非空字符串");
  const levelId = requiredString(root, "levelId");
  if (!levelId) return fail("levelId 必须是非空字符串");

  const paramsRec = asRecord(root["params"]);
  if (!paramsRec) return fail("params 必须是对象");
  const questionType = requiredString(paramsRec, "questionType");
  if (!questionType) return fail("params.questionType 必须是非空字符串");
  const questionCount = asInteger(paramsRec["questionCount"]);
  if (questionCount === null || questionCount <= 0) {
    return fail("params.questionCount 必须是正整数");
  }
  const minAccuracy = asNumber(paramsRec["minAccuracy"]);
  if (minAccuracy === null || minAccuracy < 0 || minAccuracy > 1) {
    return fail("params.minAccuracy 必须在 0..1");
  }
  const maxMedianResponseMs = optionalPositiveInt(paramsRec, "maxMedianResponseMs");
  if (maxMedianResponseMs === undefined) {
    return fail("params.maxMedianResponseMs 必须是正整数或 null");
  }
  const timeLimitMs = optionalPositiveInt(paramsRec, "timeLimitMs");
  if (timeLimitMs === undefined) return fail("params.timeLimitMs 必须是正整数或 null");

  const resultRec = asRecord(root["result"]);
  if (!resultRec) return fail("result 必须是对象");
  const passed = asBoolean(resultRec["passed"]);
  if (passed === null) return fail("result.passed 必须是布尔值");
  const correctCount = asInteger(resultRec["correctCount"]);
  if (correctCount === null || correctCount < 0 || correctCount > questionCount) {
    return fail("result.correctCount 必须是 0..questionCount 的整数");
  }
  const accuracy = asNumber(resultRec["accuracy"]);
  if (accuracy === null || accuracy < 0 || accuracy > 1) {
    return fail("result.accuracy 必须在 0..1");
  }
  const medianResponseMs = asInteger(resultRec["medianResponseMs"]);
  if (medianResponseMs === null || medianResponseMs < 0) {
    return fail("result.medianResponseMs 必须是 >=0 的整数");
  }

  if (!Array.isArray(root["answers"])) return fail("answers 必须是数组");
  // 分母恒定（ADR 0004）：结算轮必须包含整轮全部作答记录
  if (root["answers"].length !== questionCount) {
    return fail(`answers 长度必须等于 params.questionCount（${questionCount}）`);
  }
  const answers: AnswerPayload[] = [];
  for (const [i, raw] of (root["answers"] as unknown[]).entries()) {
    const rec = asRecord(raw);
    if (!rec) return fail(`answers[${i}] 必须是对象`);
    const question = asRecord(rec["question"]);
    if (!question) return fail(`answers[${i}].question 必须是 JSONB 特征快照对象`);
    const ok = asBoolean(rec["ok"]);
    if (ok === null) return fail(`answers[${i}].ok 必须是布尔值`);
    const responseMs = asInteger(rec["responseMs"]);
    if (responseMs === null || responseMs < 0) {
      return fail(`answers[${i}].responseMs 必须是 >=0 的整数`);
    }
    const timedOut = asBoolean(rec["timedOut"]);
    if (timedOut === null) return fail(`answers[${i}].timedOut 必须是布尔值`);
    const answer = rec["answer"] === undefined ? null : rec["answer"];
    answers.push({ question, answer, ok, responseMs, timedOut });
  }

  return {
    ok: true,
    value: {
      techniqueId,
      levelId,
      params: { questionType, questionCount, minAccuracy, maxMedianResponseMs, timeLimitMs },
      result: { passed, correctCount, accuracy, medianResponseMs },
      answers,
    },
  };
}

/* ---------- 落库 ---------- */

/** postgres.js json() 的参数类型（JSONB 落库前已经过结构校验，此处收窄为库要求的形状）。 */
type JsonArg = Parameters<Sql["json"]>[0];

export type SettlementOutcome = {
  sessionId: string;
  levelProgress: {
    passed: boolean;
    best: BestScore | null;
  };
};

/** 从 level_progress 行映射 best 快照；无 best 时返回 null。 */
export function bestFromRow(row: Record<string, unknown>): BestScore | null {
  const correctCount = asInteger(row["best_correct_count"]);
  const questionCount = asInteger(row["best_question_count"]);
  const accuracy = asNumber(row["best_accuracy"]);
  const medianResponseMs = asInteger(row["best_median_response_ms"]);
  const achievedAt = asDate(row["best_achieved_at"]);
  if (
    correctCount === null ||
    questionCount === null ||
    accuracy === null ||
    medianResponseMs === null ||
    achievedAt === null
  ) {
    return null;
  }
  return {
    correctCount,
    questionCount,
    accuracy,
    medianResponseMs,
    achievedAt: achievedAt.toISOString(),
  };
}

/** best 比较口径：正确率降序、中位响应升序 tiebreak（与关卡通过同口径，ADR 0006）。 */
function beatsBest(
  candidate: { accuracy: number; medianResponseMs: number },
  best: { accuracy: number; medianResponseMs: number },
): boolean {
  if (candidate.accuracy !== best.accuracy) return candidate.accuracy > best.accuracy;
  return candidate.medianResponseMs < best.medianResponseMs;
}

/**
 * 轮次结算落库：单事务写 PracticeSession 一条 + AnswerRecord N 条，
 * 并维护 LevelProgress（passed 永久单调不回退；best 仅被更优结算刷新）。
 * 仅结算轮走此路径——中途放弃的轮次客户端不提交，服务端无"进行中"状态，天然不留痕。
 */
export async function submitSettlement(
  sql: Sql,
  payload: SettlementPayload,
  userId: string = DEFAULT_USER_ID,
): Promise<SettlementOutcome> {
  return sql.begin(async (tx) => {
    const sessionRows: unknown = await tx`
      insert into practice_session (
        user_id, technique_id, level_id,
        question_type, question_count, min_accuracy, max_median_response_ms, time_limit_ms,
        passed, correct_count, accuracy, median_response_ms
      ) values (
        ${userId}, ${payload.techniqueId}, ${payload.levelId},
        ${payload.params.questionType}, ${payload.params.questionCount},
        ${payload.params.minAccuracy}, ${payload.params.maxMedianResponseMs ?? null},
        ${payload.params.timeLimitMs ?? null},
        ${payload.result.passed}, ${payload.result.correctCount},
        ${payload.result.accuracy}, ${payload.result.medianResponseMs}
      )
      returning id, settled_at`;
    const session = asRowList(sessionRows)[0];
    const sessionId = String(session["id"]);
    const settledAt = asDate(session["settled_at"]) ?? new Date();

    for (const [i, a] of payload.answers.entries()) {
      await tx`
        insert into answer_record (
          session_id, user_id, position, question, answer, ok, response_ms, timed_out
        ) values (
          ${sessionId}, ${userId}, ${i + 1},
          ${tx.json(a.question as JsonArg)},
          ${a.answer === null || a.answer === undefined ? null : tx.json(a.answer as JsonArg)},
          ${a.ok}, ${a.responseMs}, ${a.timedOut}
        )`;
    }

    await tx`
      insert into level_progress (user_id, technique_id, level_id)
      values (${userId}, ${payload.techniqueId}, ${payload.levelId})
      on conflict do nothing`;
    const lockRows: unknown = await tx`
      select * from level_progress
      where user_id = ${userId}
        and technique_id = ${payload.techniqueId}
        and level_id = ${payload.levelId}
      for update`;
    const current = asRowList(lockRows)[0];
    const currentBestAccuracy = asNumber(current["best_accuracy"]);
    const currentBestMedian = asInteger(current["best_median_response_ms"]);
    const isNewBest =
      currentBestAccuracy === null ||
      currentBestMedian === null ||
      beatsBest(
        { accuracy: payload.result.accuracy, medianResponseMs: payload.result.medianResponseMs },
        { accuracy: currentBestAccuracy, medianResponseMs: currentBestMedian },
      );

    if (isNewBest) {
      await tx`
        update level_progress set
          passed = passed or ${payload.result.passed},
          best_session_id = ${sessionId},
          best_correct_count = ${payload.result.correctCount},
          best_question_count = ${payload.params.questionCount},
          best_accuracy = ${payload.result.accuracy},
          best_median_response_ms = ${payload.result.medianResponseMs},
          best_achieved_at = ${settledAt},
          updated_at = now()
        where user_id = ${userId}
          and technique_id = ${payload.techniqueId}
          and level_id = ${payload.levelId}`;
    } else if (payload.result.passed && asBoolean(current["passed"]) !== true) {
      await tx`
        update level_progress set passed = true, updated_at = now()
        where user_id = ${userId}
          and technique_id = ${payload.techniqueId}
          and level_id = ${payload.levelId}`;
    }

    const finalRows: unknown = await tx`
      select * from level_progress
      where user_id = ${userId}
        and technique_id = ${payload.techniqueId}
        and level_id = ${payload.levelId}`;
    const finalRow = asRowList(finalRows)[0];
    return {
      sessionId,
      levelProgress: {
        passed: asBoolean(finalRow["passed"]) ?? false,
        best: bestFromRow(finalRow),
      },
    };
  });
}
