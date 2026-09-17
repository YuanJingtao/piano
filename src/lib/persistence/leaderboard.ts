/**
 * 个人排行榜的派生查询装载（#46）：从 practice_session 读限时轮结算行，
 * 查询时在 TS 纯函数里分列排序（lib/leaderboard/leaderboard.ts）——不落库、
 * 零 schema 变更（ADR 0003/0006：毕业 / 解锁 / 排行榜全部为派生查询，
 * 成绩全量保留、查询时排序）。
 *
 * SQL 只做行读取（time_limit_ms is not null 即「仅限时轮入榜」的库层口径），
 * 排序 / 分列 / 名次的解释权在可单测的纯函数 seam——与 #45 错题聚合同款分层。
 */

import { getSql, type Sql } from "@/lib/db";
import {
  deriveLeaderboard,
  EMPTY_LEADERBOARD,
  type LeaderboardData,
  type LeaderboardSessionInput,
} from "@/lib/leaderboard/leaderboard";

import { registeredTechniques } from "./course-tree";
import { DEFAULT_USER_ID } from "./contracts";
import { asBoolean, asDate, asInteger, asNumber, asRowList, asString } from "./narrow";

/** 从 DB 读限时轮结算成绩并派生榜单（查询时派生，不落库）。 */
export async function getLeaderboard(
  sql: Sql,
  userId: string = DEFAULT_USER_ID,
): Promise<LeaderboardData> {
  const rows: unknown = await sql`
    select id, technique_id, level_id, time_limit_ms, passed,
           correct_count, question_count, accuracy, median_response_ms, settled_at
    from practice_session
    where user_id = ${userId} and time_limit_ms is not null`;
  const sessions: LeaderboardSessionInput[] = [];
  for (const row of asRowList(rows)) {
    const sessionId = asString(row["id"]);
    const techniqueId = asString(row["technique_id"]);
    const levelId = asString(row["level_id"]);
    const timeLimitMs = asInteger(row["time_limit_ms"]);
    const passed = asBoolean(row["passed"]);
    const correctCount = asInteger(row["correct_count"]);
    const questionCount = asInteger(row["question_count"]);
    const accuracy = asNumber(row["accuracy"]);
    const medianResponseMs = asInteger(row["median_response_ms"]);
    const settledAt = asDate(row["settled_at"]);
    if (
      sessionId === null ||
      techniqueId === null ||
      levelId === null ||
      timeLimitMs === null ||
      passed === null ||
      correctCount === null ||
      questionCount === null ||
      accuracy === null ||
      medianResponseMs === null ||
      settledAt === null
    ) {
      continue; // NOT NULL 列，防御性跳过脏行（同 getWrongAnswerStats 口径）
    }
    sessions.push({
      sessionId,
      techniqueId,
      levelId,
      timeLimitMs,
      passed,
      correctCount,
      questionCount,
      accuracy,
      medianResponseMs,
      settledAt,
    });
  }
  return deriveLeaderboard(sessions, registeredTechniques());
}

/**
 * 排行榜页数据装载（服务端专用，loadWeaknessStats 同款降级口径）：
 * DB 不可用 / 查询失败时退化为空榜，页面渲染空态而非白屏。
 */
export async function loadLeaderboard(): Promise<LeaderboardData> {
  const sql = getSql();
  if (!sql) return EMPTY_LEADERBOARD;
  try {
    return await getLeaderboard(sql);
  } catch (err) {
    console.error("[leaderboard] 个人排行榜派生失败，退化为空榜", err);
    return EMPTY_LEADERBOARD;
  }
}
