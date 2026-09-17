/**
 * 错题特征聚合的派生查询装载（#45）：从 answer_record 读题目 JSONB 特征快照，
 * 查询时在 TS 纯函数里聚合弱项分布——不落库、无 schema 变更（ADR 0006/0007，
 * 「特征即数据」在 #35 建表时的承诺在此兑现）。
 *
 * 聚合逻辑不写 SQL 的原因：特征提取按题型判别（10 种题型 → 5 类特征，
 * 见 lib/stats/features.ts），JSONB 形状的解释权在 TS 纯函数——可单测、
 * 与插件展示辅助函数同源，SQL 只做行读取。
 */

import { getSql, type Sql } from "@/lib/db";
import {
  aggregateWeaknesses,
  EMPTY_WEAKNESS_STATS,
  type WeaknessInput,
  type WeaknessStats,
} from "@/lib/stats/weakness";

import { DEFAULT_USER_ID } from "./contracts";
import { asBoolean, asRowList } from "./narrow";

/** 从 DB 读作答记录并聚合弱项分布（查询时派生，不落库）。 */
export async function getWrongAnswerStats(
  sql: Sql,
  userId: string = DEFAULT_USER_ID,
): Promise<WeaknessStats> {
  const rows: unknown = await sql`
    select question, ok
    from answer_record
    where user_id = ${userId}`;
  const records: WeaknessInput[] = [];
  for (const row of asRowList(rows)) {
    const ok = asBoolean(row["ok"]);
    if (ok === null) continue; // NOT NULL 列，防御性跳过脏行
    records.push({ question: row["question"], ok });
  }
  return aggregateWeaknesses(records);
}

/**
 * 统计页数据装载（服务端专用，loadCourseNav 同款降级口径）：
 * DB 不可用 / 查询失败时退化为空统计，页面渲染空态而非白屏。
 */
export async function loadWeaknessStats(): Promise<WeaknessStats> {
  const sql = getSql();
  if (!sql) return EMPTY_WEAKNESS_STATS;
  try {
    return await getWrongAnswerStats(sql);
  } catch (err) {
    console.error("[weakness-stats] 错题特征聚合失败，退化为空统计", err);
    return EMPTY_WEAKNESS_STATS;
  }
}
