/**
 * seam 3 集成测试：个人排行榜派生查询（#46）。
 * 真实 PostgreSQL（不 mock）：走生产写入路径 postSettlement 落库 practice_session，
 * 再验证 getLeaderboard / loadLeaderboard 的查询时派生结果。
 * 验收核心：排序正确性（正确率降序、中位响应升序 tiebreak）与「仅限时轮入榜」。
 */

import { afterAll, beforeEach, expect, it } from "vitest";

import type { SettlementPayload } from "@/lib/persistence/contracts";
import { getLeaderboard, loadLeaderboard } from "@/lib/persistence/leaderboard";
import { asRowList } from "@/lib/persistence/narrow";

import {
  closeDb,
  integration,
  makeAnswers,
  makePayload,
  postSettlement,
  resetDb,
  testSql,
} from "./helpers";

/** 节奏关限时轮结算 payload（10 题 / ≥80% / 时限按关声明——rhythm manifest 口径）。 */
function timedRhythmRound(over: {
  levelId?: string;
  timeLimitMs?: number;
  /** 答错总数（含超时）；超时轮次记错、ms 记为时限值（ADR 0006 限时口径）。 */
  wrong?: number;
  timeouts?: number;
  medianResponseMs: number;
}): SettlementPayload {
  const timeLimitMs = over.timeLimitMs ?? 8000;
  const wrong = over.wrong ?? 1;
  const timeouts = over.timeouts ?? 0;
  const correctCount = 10 - wrong;
  return makePayload({
    techniqueId: "rhythm-reading",
    levelId: over.levelId ?? "L1",
    params: {
      questionType: "rhythm-syllable-quiz",
      questionCount: 10,
      minAccuracy: 0.8,
      maxMedianResponseMs: null,
      timeLimitMs,
    },
    result: {
      passed: correctCount / 10 >= 0.8,
      correctCount,
      accuracy: correctCount / 10,
      medianResponseMs: over.medianResponseMs,
    },
    answers: makeAnswers(10, {
      wrongAt: Array.from({ length: wrong - timeouts }, (_, i) => i),
      timeoutAt: Array.from({ length: timeouts }, (_, i) => 9 - i),
      timeLimitMs,
    }),
  });
}

integration("个人排行榜派生查询（真实 PostgreSQL，不 mock）", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("空库 → 空榜（排行榜页「尚无限时成绩」空态的数据形状）", async () => {
    const board = await getLeaderboard(testSql());
    expect(board).toEqual({ totalTimedRounds: 0, levels: [] });
  });

  it("仅限时轮入榜：非限时结算轮不出现（验收第 3 条）", async () => {
    // 非限时轮：地标音快答（makePayload 默认 timeLimitMs null）
    const untimed = await postSettlement(makePayload());
    expect(untimed.status).toBe(201);
    // 限时轮：节奏 L1
    const timed = await postSettlement(timedRhythmRound({ medianResponseMs: 2400 }));
    expect(timed.status).toBe(201);

    const board = await getLeaderboard(testSql());
    expect(board.totalTimedRounds).toBe(1);
    expect(board.levels).toHaveLength(1);
    expect(board.levels[0]).toMatchObject({
      techniqueId: "rhythm-reading",
      levelId: "L1",
      totalCount: 1,
    });
    expect(board.levels[0].entries[0]).toMatchObject({
      rank: 1,
      accuracy: 0.9,
      medianResponseMs: 2400,
      timeLimitMs: 8000,
      passed: true,
    });
  });

  it("排序正确性：同关多轮按正确率降序、中位响应升序 tiebreak（验收第 1/4 条）", async () => {
    // 乱序写入：低正确率先落库，高正确率后落库，tie 轮中位交错
    await postSettlement(timedRhythmRound({ wrong: 2, medianResponseMs: 2000 })); // 0.8
    await postSettlement(timedRhythmRound({ wrong: 0, medianResponseMs: 3000 })); // 1.0
    await postSettlement(timedRhythmRound({ wrong: 1, medianResponseMs: 2500 })); // 0.9 慢
    await postSettlement(timedRhythmRound({ wrong: 1, medianResponseMs: 2200 })); // 0.9 快

    const board = await getLeaderboard(testSql());
    const entries = board.levels[0].entries;
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
    expect(
      entries.map((e) => [e.accuracy, e.medianResponseMs] as const),
    ).toEqual([
      [1, 3000], // 正确率最高者居首，即便中位最慢
      [0.9, 2200], // 同正确率 → 中位响应升序
      [0.9, 2500],
      [0.8, 2000],
    ]);
  });

  it("按关卡分列：列序 = 技巧注册序 × 关卡 manifest 序，超时轮照常入榜", async () => {
    await postSettlement(
      timedRhythmRound({ levelId: "L3", timeLimitMs: 10000, wrong: 3, timeouts: 2, medianResponseMs: 4000 }),
    );
    await postSettlement(timedRhythmRound({ levelId: "L1", medianResponseMs: 2400 }));
    await postSettlement(timedRhythmRound({ levelId: "L2", medianResponseMs: 2600 }));

    const board = await getLeaderboard(testSql());
    expect(board.totalTimedRounds).toBe(3);
    expect(board.levels.map((l) => l.levelId)).toEqual(["L1", "L2", "L3"]);
    // L3 列：标题来自 manifest、时限值为该轮快照（10s ≠ L1/L2 的 8s）
    expect(board.levels[2]).toMatchObject({
      techniqueTitle: "节奏阅读基础",
      levelTitle: "混合时值阅读",
    });
    expect(board.levels[2].entries[0]).toMatchObject({
      timeLimitMs: 10000,
      correctCount: 7,
      passed: false, // 0.7 < 0.8 未达标仍入榜（榜单是全量历史，不只达标轮）
    });
  });

  it("全量保留：同关多轮全部在榜、查询行数 = 落库行数（验收第 2 条）", async () => {
    for (const median of [2400, 2300, 2500]) {
      await postSettlement(timedRhythmRound({ medianResponseMs: median }));
    }
    const board = await getLeaderboard(testSql());
    expect(board.levels[0].totalCount).toBe(3);
    expect(board.levels[0].entries.map((e) => e.medianResponseMs)).toEqual([2300, 2400, 2500]);

    // DB 层核对：3 行限时 session 一行不少（不清理、不物化聚合）
    const rows = asRowList(
      await testSql()`select id from practice_session where time_limit_ms is not null`,
    );
    expect(rows).toHaveLength(3);
  });

  it("用户隔离：他人限时轮不混入 default 用户榜单（userId 列余量口径）", async () => {
    await postSettlement(timedRhythmRound({ medianResponseMs: 2400 }));
    const sql = testSql();
    await sql`insert into users (id, display_name) values ('other', '他人')`;
    await sql`
      insert into practice_session (
        user_id, technique_id, level_id, question_type, question_count,
        min_accuracy, time_limit_ms, passed, correct_count, accuracy, median_response_ms
      ) values ('other', 'rhythm-reading', 'L1', 'rhythm-syllable-quiz', 10,
        0.8, 8000, true, 10, 1, 1500)`;

    const board = await getLeaderboard(sql);
    expect(board.totalTimedRounds).toBe(1);
    expect(board.levels[0].entries).toHaveLength(1);
    expect(board.levels[0].entries[0].accuracy).toBe(0.9); // 未被他人 1.0 顶掉

    const otherBoard = await getLeaderboard(sql, "other");
    expect(otherBoard.totalTimedRounds).toBe(1);
    expect(otherBoard.levels[0].entries[0]).toMatchObject({ accuracy: 1, medianResponseMs: 1500 });
  });

  it("loadLeaderboard（排行榜页装载路径）→ 与直连查询同结果", async () => {
    await postSettlement(timedRhythmRound({ medianResponseMs: 2400 }));
    const viaLoader = await loadLeaderboard();
    const direct = await getLeaderboard(testSql());
    expect(viaLoader).toEqual(direct);
    expect(viaLoader.totalTimedRounds).toBe(1);
  });
});
