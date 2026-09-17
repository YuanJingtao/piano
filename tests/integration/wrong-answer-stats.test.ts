/**
 * seam 3 集成测试：错题特征聚合派生查询（#45）。
 * 真实 PostgreSQL（不 mock）：走生产写入路径 postSettlement 落库 answer_record，
 * 再验证 getWrongAnswerStats / loadWeaknessStats 的查询时派生结果。
 */

import { afterAll, beforeEach, expect, it } from "vitest";

import type { Sql } from "@/lib/db";
import type { AnswerPayload } from "@/lib/persistence/contracts";
import { asRowList } from "@/lib/persistence/narrow";
import {
  getWrongAnswerStats,
  loadWeaknessStats,
} from "@/lib/persistence/wrong-answer-stats";
import type { WeaknessStats } from "@/lib/stats/weakness";

/** postgres.js json() 参数类型（同 settlement.ts 口径）。 */
type JsonArg = Parameters<Sql["json"]>[0];

import {
  closeDb,
  integration,
  makePayload,
  postSettlement,
  resetDb,
  testSql,
} from "./helpers";

/** 作答记录构造（判定在客户端，服务端只持久化——answer 内容对聚合不透明）。 */
function ans(question: Record<string, unknown>, ok: boolean): AnswerPayload {
  return { question, ok, responseMs: 1000, timedOut: false };
}

/** 一轮混合技巧特征的结算（12 题、8 错），覆盖五类特征 + 未知题型。 */
const MIXED_ROUND: AnswerPayload[] = [
  ans({ type: "landmark-note", midi: 60, clef: "treble" }, false), // 音名 C4 错
  ans({ type: "landmark-note", midi: 60, clef: "treble" }, true), // 音名 C4 对
  ans({ type: "keyboard-geo", midi: 62, cue: { kind: "note-name" } }, false), // 音名 D4 错（跨技巧同特征）
  ans({ type: "interval-melody", clef: "treble", notes: [60, 62] }, false), // 音程「上二度」错
  ans({ type: "interval-melody", clef: "treble", notes: [60, 62] }, true),
  ans({ type: "rhythm-ear-quiz", pattern: ["q", "tt", "q", "q"] }, false), // 节奏型错
  ans({ type: "rhythm-syllable-quiz", pattern: ["q", "tt", "q", "q"] }, false), // 同节奏型跨题型合并
  ans({ type: "group-notation-quiz", groupId: "do-mi-so" }, false), // 音组错
  ans({ type: "group-play", groupId: "do-mi-so" }, true),
  ans({ type: "key-sequence", midis: [60, 62, 64], label: "C 位置级进" }, false), // 音型错
  ans({ type: "block-chord", midis: [60, 64, 67], label: "C 大三和弦" }, true), // 全对 → 不进弱项
  ans({ type: "note-choice", midi: 99 }, false), // 未知题型 → 只计总数
];

/** 类别 → 条目的便捷索引。 */
function entriesOf(stats: WeaknessStats, category: string) {
  return stats.categories.find((c) => c.category === category)?.entries ?? [];
}

integration("错题特征聚合派生查询（真实 PostgreSQL，不 mock）", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("空库 → 空统计（统计页「尚无作答记录」空态的数据形状）", async () => {
    const stats = await getWrongAnswerStats(testSql());
    expect(stats).toEqual({ totalAnswers: 0, totalWrong: 0, categories: [] });
  });

  it("一轮混合技巧结算 → 五类特征聚合正确（查询时派生，不落库）", async () => {
    const { status } = await postSettlement(
      makePayload({ techniqueId: "landmark-notes", answers: MIXED_ROUND }),
    );
    expect(status).toBe(201);

    const stats = await getWrongAnswerStats(testSql());
    expect(stats.totalAnswers).toBe(12);
    expect(stats.totalWrong).toBe(8);
    // 类别顺序固定：音名 → 音程与轮廓 → 节奏型 → 功能音组 → 音型与和弦
    expect(stats.categories.map((c) => c.category)).toEqual([
      "note",
      "interval",
      "rhythm",
      "group",
      "figure",
    ]);

    // 音名：C4 错 1/出现 2 排前（出现次数 tiebreak），D4 错 1/出现 1
    expect(entriesOf(stats, "note")).toEqual([
      { key: "60", label: "C4", wrongCount: 1, totalCount: 2 },
      { key: "62", label: "D4", wrongCount: 1, totalCount: 1 },
    ]);
    // 音程：关系特征而非目标音名（读关系不读名口径）
    expect(entriesOf(stats, "interval")).toEqual([
      { key: "上二度", label: "上二度", wrongCount: 1, totalCount: 2 },
    ]);
    // 节奏型：跨题型（听音/看谱）合并到同一条目
    expect(entriesOf(stats, "rhythm")).toEqual([
      { key: "q tt q q", label: "ta ti-ti ta ta", wrongCount: 2, totalCount: 2 },
    ]);
    // 功能音组：groupId 特征（#44 落库预留）
    expect(entriesOf(stats, "group")).toEqual([
      { key: "do-mi-so", label: "1-3-5（do-mi-so）", wrongCount: 1, totalCount: 2 },
    ]);
    // 音型与和弦：全对的「C 大三和弦」不进弱项
    expect(entriesOf(stats, "figure")).toEqual([
      { key: "C 位置级进", label: "C 位置级进", wrongCount: 1, totalCount: 1 },
    ]);
  });

  it("跨轮次累计：新一轮答错叠加频次并重排序", async () => {
    await postSettlement(makePayload({ answers: MIXED_ROUND }));
    await postSettlement(
      makePayload({
        answers: [
          ans({ type: "landmark-note", midi: 62, clef: "treble" }, false), // D4 第 2 错
          ans({ type: "landmark-note", midi: 62, clef: "treble" }, true),
        ],
      }),
    );

    const stats = await getWrongAnswerStats(testSql());
    expect(stats.totalAnswers).toBe(14);
    expect(stats.totalWrong).toBe(9);
    // D4 错 2 次升为音名弱项第一，C4 错 1 次退居第二
    expect(entriesOf(stats, "note")).toEqual([
      { key: "62", label: "D4", wrongCount: 2, totalCount: 3 },
      { key: "60", label: "C4", wrongCount: 1, totalCount: 2 },
    ]);
  });

  it("用户隔离：他人作答不混入 default 用户统计（userId 列余量口径）", async () => {
    await postSettlement(makePayload({ answers: MIXED_ROUND }));
    const sql = testSql();
    await sql`insert into users (id, display_name) values ('other', '他人')`;
    const sessions = asRowList(
      await sql`
      insert into practice_session (
        user_id, technique_id, level_id, question_type, question_count,
        min_accuracy, passed, correct_count, accuracy, median_response_ms
      ) values ('other', 'landmark-notes', 'quick-answer-1', 'note-choice', 1,
        0.9, false, 0, 0, 1000)
      returning id`,
    );
    const otherSessionId = String(sessions[0]?.["id"] ?? "");
    await sql`
      insert into answer_record (session_id, user_id, position, question, ok, response_ms)
      values (
        ${otherSessionId}, 'other', 1,
        ${sql.json({ type: "landmark-note", midi: 60, clef: "treble" })},
        false, 1000
      )`;

    const stats = await getWrongAnswerStats(sql); // 默认 default 用户
    expect(stats.totalAnswers).toBe(12); // 不含他人的 1 条
    expect(entriesOf(stats, "note")[0]).toMatchObject({ key: "60", wrongCount: 1 }); // 未被他人错题叠加

    const otherStats = await getWrongAnswerStats(sql, "other");
    expect(otherStats.totalAnswers).toBe(1);
    expect(entriesOf(otherStats, "note")).toEqual([
      { key: "60", label: "C4", wrongCount: 1, totalCount: 1 },
    ]);
  });

  it("脏 JSONB / 未知题型：类别跳过但计入总数，查询不崩溃", async () => {
    const { status } = await postSettlement(
      makePayload({
        answers: [ans({ type: "landmark-note", midi: 60, clef: "treble" }, false)],
      }),
    );
    expect(status).toBe(201);
    const sql = testSql();
    const sessions = asRowList(await sql`select id from practice_session limit 1`);
    const sessionId = String(sessions[0]?.["id"] ?? "");
    // 直接注入生产写入路径不会产生的脏快照（历史数据 / 未来插件缺陷的防御口径）
    const dirtyQuestions: Record<string, unknown>[] = [
      { type: "landmark-note" }, // 缺 midi
      { type: "rhythm-ear-quiz", pattern: ["q", "x"] }, // 非法节奏单位
      { type: "brand-new-type", foo: 1 }, // 未知题型
    ];
    for (const [i, question] of dirtyQuestions.entries()) {
      await sql`
        insert into answer_record (session_id, user_id, position, question, ok, response_ms)
        values (
          ${sessionId}, 'default', ${i + 2},
          ${sql.json(question as JsonArg)}, false, 1000
        )`;
    }

    const stats = await getWrongAnswerStats(sql);
    expect(stats.totalAnswers).toBe(4);
    expect(stats.totalWrong).toBe(4);
    expect(stats.categories).toHaveLength(1); // 仅音名类，脏数据未产出任何条目
    expect(entriesOf(stats, "note")).toHaveLength(1);
  });

  it("loadWeaknessStats（统计页装载路径）→ 与直连查询同结果", async () => {
    await postSettlement(makePayload({ answers: MIXED_ROUND }));
    const viaLoader = await loadWeaknessStats();
    const direct = await getWrongAnswerStats(testSql());
    expect(viaLoader).toEqual(direct);
    expect(viaLoader.totalAnswers).toBe(12);
  });
});
