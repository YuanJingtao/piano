import { afterAll, beforeEach, expect, it } from "vitest";
import { DEFAULT_USER_ID, type BestScore } from "@/lib/persistence/contracts";
import { asRecord, asRowList } from "@/lib/persistence/narrow";
import {
  closeDb,
  getCourseTreeHttp,
  integration,
  makeAnswers,
  makePayload,
  postRaw,
  postSettlement,
  resetDb,
  testSql,
} from "./helpers";

integration("轮次结算落库（真实 PostgreSQL，不 mock）", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("一次结算提交 → PracticeSession 一条 + 全部 AnswerRecord 落库，userId 全覆盖", async () => {
    const payload = makePayload();
    const { status, body } = await postSettlement(payload);
    expect(status).toBe(201);

    const sql = testSql();
    const sessions = asRowList(await sql`select * from practice_session`);
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(String(s["user_id"])).toBe(DEFAULT_USER_ID);
    expect(String(s["technique_id"])).toBe(payload.techniqueId);
    expect(String(s["level_id"])).toBe(payload.levelId);
    expect(String(s["id"])).toBe(String(body?.["sessionId"]));

    const records = asRowList(await sql`select * from answer_record order by position`);
    expect(records).toHaveLength(payload.answers.length);
    expect(records.map((r) => Number(r["position"]))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    for (const r of records) {
      expect(String(r["user_id"])).toBe(DEFAULT_USER_ID);
      expect(String(r["session_id"])).toBe(String(s["id"]));
    }
    // 题目 JSONB 特征快照 + 用户作答 + 对错 + 响应 ms 原样往返
    expect(records[0]["question"]).toEqual({ type: "note-choice", midi: 60, clef: "treble" });
    expect(records[0]["answer"]).toEqual({ kind: "midi", midi: 60, velocity: 80 });
    expect(records[0]["ok"]).toBe(true);
    expect(Number(records[0]["response_ms"])).toBe(1000);
    expect(records[0]["timed_out"]).toBe(false);
    // 第 4 题（下标 3）是错题
    expect(records[3]["ok"]).toBe(false);

    // 响应体带出 LevelProgress 当前态
    const progress = asRecord(body?.["levelProgress"]);
    expect(progress?.["passed"]).toBe(true);
    const best = asRecord(progress?.["best"]);
    expect(Number(best?.["correctCount"])).toBe(11);
  });

  it("当轮参数快照完整：题型 / 题数 / 阈值 / 时限值反规范化在行上", async () => {
    const { status } = await postSettlement(
      makePayload({
        params: {
          questionType: "rhythm-match",
          minAccuracy: 0.9,
          maxMedianResponseMs: 3000,
          timeLimitMs: 5000,
        },
      }),
    );
    expect(status).toBe(201);

    const sql = testSql();
    const [s] = asRowList(await sql`select * from practice_session`);
    expect(String(s["question_type"])).toBe("rhythm-match");
    expect(Number(s["question_count"])).toBe(12);
    expect(Number(s["min_accuracy"])).toBeCloseTo(0.9);
    expect(Number(s["max_median_response_ms"])).toBe(3000);
    expect(Number(s["time_limit_ms"])).toBe(5000);
    // 结算结果列
    expect(s["passed"]).toBe(true);
    expect(Number(s["correct_count"])).toBe(11);
    expect(Number(s["median_response_ms"])).toBe(1200);
    expect(s["settled_at"]).toBeInstanceOf(Date);
  });

  it("限时轮口径：超时题记错、ms 记时限值、作答空缺，整轮照常落库", async () => {
    const timeLimitMs = 4000;
    const answers = makeAnswers(12, { timeoutAt: [2, 7], timeLimitMs });
    const correct = answers.filter((a) => a.ok).length;
    const { status } = await postSettlement(
      makePayload({
        params: { questionType: "rhythm-match", timeLimitMs, maxMedianResponseMs: null },
        result: {
          passed: false,
          correctCount: correct,
          accuracy: correct / 12,
          medianResponseMs: 2600,
        },
        answers,
      }),
    );
    expect(status).toBe(201);

    const sql = testSql();
    const records = asRowList(await sql`select * from answer_record order by position`);
    const timed = records[2];
    expect(timed["timed_out"]).toBe(true);
    expect(timed["ok"]).toBe(false);
    expect(Number(timed["response_ms"])).toBe(timeLimitMs);
    expect(timed["answer"]).toBeNull();
    // 未达阈值的结算轮同样落库（仅"中途放弃"不留痕——那根本没有提交动作）
    const [s] = asRowList(await sql`select * from practice_session`);
    expect(s["passed"]).toBe(false);
    expect(Number(s["time_limit_ms"])).toBe(timeLimitMs);
  });

  it("结构校验失败 → 400 且四实体零落库", async () => {
    const badRequests: Array<Promise<{ status: number }>> = [
      // answers 数与 questionCount 不符（分母恒定被破坏）
      postSettlement(makePayload({ params: { questionCount: 12 }, answers: makeAnswers(11) })),
      // correctCount 越界
      postSettlement(makePayload({ result: { correctCount: 13 } })),
      // 负响应时长
      postSettlement(makePayload({ result: { medianResponseMs: -1 } })),
      // 缺 params
      postRaw(JSON.stringify({ techniqueId: "t", levelId: "l", result: {}, answers: [] })),
      // 非法 JSON
      postRaw("{not json"),
    ];
    for (const p of badRequests) {
      const { status } = await p;
      expect(status).toBe(400);
    }

    const sql = testSql();
    const [sessions] = asRowList(await sql`select count(*)::int as n from practice_session`);
    expect(Number(sessions?.["n"])).toBe(0);
    const [records] = asRowList(await sql`select count(*)::int as n from answer_record`);
    expect(Number(records?.["n"])).toBe(0);
    const [progress] = asRowList(await sql`select count(*)::int as n from level_progress`);
    expect(Number(progress?.["n"])).toBe(0);
  });

  it("LevelProgress：passed 永久单调，best 仅被更优结算刷新（正确率降序、中位升序 tiebreak）", async () => {
    const sql = testSql();
    const bestOf = (body: Record<string, unknown> | null): BestScore | null =>
      asRecord(asRecord(body?.["levelProgress"])?.["best"]) as BestScore | null;

    // A：达标轮，accuracy 11/12
    const a = await postSettlement(makePayload({ result: { medianResponseMs: 2000 } }));
    expect(a.status).toBe(201);
    const sessionIdA = String(a.body?.["sessionId"]);
    expect(bestOf(a.body)?.correctCount).toBe(11);

    // B：更差且未达标 → passed 不回退，best 不动
    const b = await postSettlement(
      makePayload({
        answers: makeAnswers(12, { wrongAt: [0, 1, 2, 3, 4, 5] }),
        result: { passed: false, correctCount: 6, accuracy: 0.5, medianResponseMs: 2500 },
      }),
    );
    expect(b.status).toBe(201);
    const progressB = asRecord(b.body?.["levelProgress"]);
    expect(progressB?.["passed"]).toBe(true); // 永久有效，不因后续失败轮回退
    expect(bestOf(b.body)?.correctCount).toBe(11); // best 仍是 A

    // C：全对（更优）→ best 刷新并指向 C 的 session
    const c = await postSettlement(
      makePayload({
        answers: makeAnswers(12),
        result: { correctCount: 12, accuracy: 1, medianResponseMs: 2100 },
      }),
    );
    expect(bestOf(c.body)?.correctCount).toBe(12);
    expect(bestOf(c.body)?.medianResponseMs).toBe(2100);

    // D：同正确率、更低中位 → tiebreak 胜出
    const d = await postSettlement(
      makePayload({
        answers: makeAnswers(12),
        result: { correctCount: 12, accuracy: 1, medianResponseMs: 1900 },
      }),
    );
    expect(bestOf(d.body)?.medianResponseMs).toBe(1900);

    // E：同正确率、更高中位 → best 保持 D
    const e = await postSettlement(
      makePayload({
        answers: makeAnswers(12),
        result: { correctCount: 12, accuracy: 1, medianResponseMs: 2200 },
      }),
    );
    expect(bestOf(e.body)?.medianResponseMs).toBe(1900);

    // DB 终态：单行、passed、best 指向 D 的 session
    const [row] = asRowList(await sql`select * from level_progress`);
    expect(row?.["passed"]).toBe(true);
    expect(Number(row?.["best_correct_count"])).toBe(12);
    expect(Number(row?.["best_median_response_ms"])).toBe(1900);
    expect(Number(row?.["best_question_count"])).toBe(12);
    expect(String(row?.["best_session_id"])).toBe(String(d.body?.["sessionId"]));
    expect(sessionIdA).not.toBe(String(d.body?.["sessionId"]));
    // 五轮全部落库：每轮一条
    const [count] = asRowList(await sql`select count(*)::int as n from practice_session`);
    expect(Number(count?.["n"])).toBe(5);
  });

  it("GET /api/course-tree：200 + 注册表技巧入树，结算落库即时反映到派生状态", async () => {
    // #37 起注册表装载真实技巧（landmark-notes），本用例走通
    // 结算落库 → 查询期派生（ADR 0006）→ HTTP 视图 的全链路。
    const settle = await postSettlement(
      makePayload({ techniqueId: "landmark-notes", levelId: "L1" }),
    );
    expect(settle.status).toBe(201);

    const { status, body } = await getCourseTreeHttp();
    expect(status).toBe(200);
    const techniques = body?.["techniques"];
    expect(Array.isArray(techniques)).toBe(true);
    const landmark = (techniques as Record<string, unknown>[]).find(
      (t) => t["id"] === "landmark-notes",
    );
    expect(landmark).toBeDefined();
    const levels = landmark?.["levels"] as Record<string, unknown>[];
    expect(levels).toHaveLength(4);
    // L1 本轮通过 → passed 且仍解锁（复习）；L2 因 L1 通过而解锁；L3 未解锁
    expect(levels[0]).toMatchObject({ id: "L1", passed: true, unlocked: true });
    expect(levels[1]).toMatchObject({ id: "L2", passed: false, unlocked: true });
    expect(levels[2]).toMatchObject({ id: "L3", passed: false, unlocked: false });
  });
});
