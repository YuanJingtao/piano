import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CourseTechnique } from "@/lib/persistence/contracts";
import {
  deriveCourseTree,
  getCourseTree,
  type LevelProgressRecord,
} from "@/lib/persistence/course-tree";
import { closeDb, integration, makeAnswers, makePayload, postSettlement, resetDb, testSql } from "./helpers";

/* ---------- fixture manifest：主线 A→B→C + 支线 D（前置 B），形如真实六技巧声明 ---------- */

const TECH_A: CourseTechnique = {
  id: "tech-a",
  title: "键盘地理锚点",
  track: "main",
  prerequisites: [],
  levels: [
    { id: "a1", title: "A1" },
    { id: "a2", title: "A2" },
    { id: "a3", title: "A3" },
  ],
};
const TECH_B: CourseTechnique = {
  id: "tech-b",
  title: "地标音系统",
  track: "main",
  prerequisites: ["tech-a"],
  levels: [{ id: "b1" }, { id: "b2" }],
};
const TECH_C: CourseTechnique = {
  id: "tech-c",
  title: "方向与音程阅读",
  track: "main",
  prerequisites: ["tech-b"],
  levels: [{ id: "c1" }],
};
const TECH_D: CourseTechnique = {
  id: "tech-d",
  title: "首调功能音组",
  track: "side",
  prerequisites: ["tech-b"],
  levels: [{ id: "d1" }, { id: "d2" }],
};
const FIXTURES: readonly CourseTechnique[] = [TECH_A, TECH_B, TECH_C, TECH_D];

function passed(techniqueId: string, ...levelIds: string[]): LevelProgressRecord[] {
  return levelIds.map((levelId) => ({ techniqueId, levelId, passed: true, best: null }));
}

function treeOf(progress: readonly LevelProgressRecord[]) {
  const tree = deriveCourseTree(FIXTURES, progress);
  const byId = new Map(tree.map((t) => [t.id, t]));
  return { tree, byId };
}

/* ---------- 纯函数派生：无 DB 依赖，任何环境都跑 ---------- */

describe("课程树派生（LevelProgress × manifest prerequisites，不落库）", () => {
  it("零进度：首技巧解锁且仅首关开放，其余全部锁死", () => {
    const { byId } = treeOf([]);
    const a = byId.get("tech-a");
    expect(a?.unlocked).toBe(true);
    expect(a?.graduated).toBe(false);
    expect(a?.levels.map((l) => l.unlocked)).toEqual([true, false, false]);
    expect(byId.get("tech-b")?.unlocked).toBe(false);
    expect(byId.get("tech-c")?.unlocked).toBe(false);
    expect(byId.get("tech-d")?.unlocked).toBe(false);
  });

  it("关卡内线性：a1 通过后 a2 开放，a3 仍锁", () => {
    const { byId } = treeOf(passed("tech-a", "a1"));
    const a = byId.get("tech-a");
    expect(a?.levels.map((l) => l.unlocked)).toEqual([true, true, false]);
    expect(a?.graduated).toBe(false);
    expect(byId.get("tech-b")?.unlocked).toBe(false);
  });

  it("技巧毕业解锁下一主线；支线仍锁（前置是 tech-b 而非 tech-a）", () => {
    const { byId } = treeOf(passed("tech-a", "a1", "a2", "a3"));
    expect(byId.get("tech-a")?.graduated).toBe(true);
    const b = byId.get("tech-b");
    expect(b?.unlocked).toBe(true);
    expect(b?.levels.map((l) => l.unlocked)).toEqual([true, false]);
    expect(byId.get("tech-c")?.unlocked).toBe(false);
    expect(byId.get("tech-d")?.unlocked).toBe(false);
  });

  it("前置主线毕业后，支线与下一主线同时开放", () => {
    const { byId } = treeOf([
      ...passed("tech-a", "a1", "a2", "a3"),
      ...passed("tech-b", "b1", "b2"),
    ]);
    expect(byId.get("tech-b")?.graduated).toBe(true);
    expect(byId.get("tech-c")?.unlocked).toBe(true);
    const d = byId.get("tech-d");
    expect(d?.unlocked).toBe(true);
    expect(d?.track).toBe("side");
    expect(d?.levels.map((l) => l.unlocked)).toEqual([true, false]);
  });

  it("复习不受解锁限制：跳空通过的关卡永远 unlocked", () => {
    // 构造非常规进度：a2 通过而 a1 未通过（如 manifest 调序后的历史数据）
    const { byId } = treeOf(passed("tech-a", "a2"));
    const a = byId.get("tech-a");
    expect(a?.levels.map((l) => [l.id, l.unlocked, l.passed])).toEqual([
      ["a1", true, false], // 首关随技巧解锁开放
      ["a2", true, true], // 已通过 → 永久可复习
      ["a3", true, false], // 线性推进以"前一关通过"为准：a2 已通过，a3 开放
    ]);
  });

  it("前置引用未知技巧 → 锁死；前置环 → 双双锁死（无死循环）", () => {
    const ghost: CourseTechnique = {
      id: "tech-e",
      track: "main",
      prerequisites: ["not-exist"],
      levels: [{ id: "e1" }],
    };
    const cyc1: CourseTechnique = {
      id: "tech-x",
      track: "main",
      prerequisites: ["tech-y"],
      levels: [{ id: "x1" }],
    };
    const cyc2: CourseTechnique = {
      id: "tech-y",
      track: "main",
      prerequisites: ["tech-x"],
      levels: [{ id: "y1" }],
    };
    const tree = deriveCourseTree([ghost, cyc1, cyc2], []);
    expect(tree.map((t) => t.unlocked)).toEqual([false, false, false]);
  });
});

/* ---------- 派生 × 真实 DB：LevelProgress 行来自结算落库 ---------- */

integration("课程树派生 × 真实 PostgreSQL", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("结算落库后 getCourseTree：passed / best 快照 / 线性解锁全部正确", async () => {
    // 通过 a1（全对）
    const r1 = await postSettlement(
      makePayload({
        techniqueId: "tech-a",
        levelId: "a1",
        answers: makeAnswers(12),
        result: { passed: true, correctCount: 12, accuracy: 1, medianResponseMs: 1500 },
      }),
    );
    expect(r1.status).toBe(201);

    const tree = await getCourseTree(testSql(), FIXTURES);
    const a = tree.find((t) => t.id === "tech-a");
    expect(a?.graduated).toBe(false);
    const a1 = a?.levels.find((l) => l.id === "a1");
    expect(a1?.passed).toBe(true);
    expect(a1?.unlocked).toBe(true);
    // best 是结算时刻快照，从 DB 完整带出
    expect(a1?.best).toMatchObject({
      correctCount: 12,
      questionCount: 12,
      accuracy: 1,
      medianResponseMs: 1500,
    });
    expect(typeof a1?.best?.achievedAt).toBe("string");
    expect(new Date(a1?.best?.achievedAt ?? "").getTime()).not.toBeNaN();
    // a2 线性开放，a3 仍锁
    expect(a?.levels.map((l) => l.unlocked)).toEqual([true, true, false]);
    // 下游技巧仍锁
    expect(tree.find((t) => t.id === "tech-b")?.unlocked).toBe(false);

    // 再通过 a2、a3 → tech-a 毕业，tech-b 解锁
    for (const levelId of ["a2", "a3"]) {
      const r = await postSettlement(
        makePayload({
          techniqueId: "tech-a",
          levelId,
          answers: makeAnswers(12, { wrongAt: [0] }),
          result: { passed: true, correctCount: 11, accuracy: 11 / 12, medianResponseMs: 1800 },
        }),
      );
      expect(r.status).toBe(201);
    }
    const tree2 = await getCourseTree(testSql(), FIXTURES);
    expect(tree2.find((t) => t.id === "tech-a")?.graduated).toBe(true);
    expect(tree2.find((t) => t.id === "tech-b")?.unlocked).toBe(true);
    expect(tree2.find((t) => t.id === "tech-d")?.unlocked).toBe(false);
  });

  it("迁移幂等：重复 migrate 不破坏既有数据", async () => {
    await postSettlement(makePayload({ techniqueId: "tech-a", levelId: "a1" }));
    const { migrate } = await import("@/lib/db/migrate");
    await migrate(testSql());
    await migrate(testSql());
    const tree = await getCourseTree(testSql(), FIXTURES);
    expect(tree.find((t) => t.id === "tech-a")?.levels[0]?.passed).toBe(true);
  });
});
