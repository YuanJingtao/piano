/**
 * seam：个人排行榜派生纯函数（#46）。
 * 覆盖入榜过滤（仅限时轮）、排序口径（正确率降序 → 中位响应升序 → 结算时间升序）、
 * 按关卡分列与注册序、全量保留、未知关卡防御、标题回退。
 */

import { describe, expect, it } from "vitest";

import {
  deriveLeaderboard,
  EMPTY_LEADERBOARD,
  type LeaderboardSessionInput,
} from "@/lib/leaderboard/leaderboard";
import type { CourseTechnique } from "@/lib/persistence/contracts";

/** fixture manifest：结构 = 注册序（节奏在功能音组前），关卡 = manifest 序。 */
const TECHNIQUES: readonly CourseTechnique[] = [
  {
    id: "rhythm-reading",
    title: "节奏阅读基础",
    track: "main",
    prerequisites: ["direction-intervals"],
    levels: [
      { id: "L1", title: "全·二分·四分音符" },
      { id: "L2", title: "ti-ti 八分音符对" },
      { id: "L3", title: "混合时值阅读" },
    ],
  },
  {
    id: "functional-groups",
    title: "首调功能音组",
    track: "side",
    prerequisites: ["landmark-notes"],
    levels: [{ id: "G1", title: "三组功能音组识别" }],
  },
];

/** 便捷构造：节奏 L1 限时轮结算行（8s 时限、10 题对 9）。 */
function sess(over: Partial<LeaderboardSessionInput> = {}): LeaderboardSessionInput {
  return {
    sessionId: "s",
    techniqueId: "rhythm-reading",
    levelId: "L1",
    timeLimitMs: 8000,
    passed: true,
    correctCount: 9,
    questionCount: 10,
    accuracy: 0.9,
    medianResponseMs: 2400,
    settledAt: new Date("2026-09-01T10:00:00Z"),
    ...over,
  };
}

describe("deriveLeaderboard：空榜与入榜过滤", () => {
  it("零结算轮 → 空榜（排行榜页空态的数据形状）", () => {
    expect(deriveLeaderboard([], TECHNIQUES)).toEqual(EMPTY_LEADERBOARD);
  });

  it("非限时轮不入榜：timeLimitMs null 被过滤且不计总数", () => {
    const board = deriveLeaderboard(
      [sess({ timeLimitMs: null }), sess({ timeLimitMs: null, levelId: "L2" })],
      TECHNIQUES,
    );
    expect(board).toEqual(EMPTY_LEADERBOARD);
  });

  it("限时与非限时混合 → 仅限时轮出现（验收：非限时轮不入榜）", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "untimed", timeLimitMs: null }),
        sess({ sessionId: "timed" }),
      ],
      TECHNIQUES,
    );
    expect(board.totalTimedRounds).toBe(1);
    expect(board.levels).toHaveLength(1);
    expect(board.levels[0].entries.map((e) => e.sessionId)).toEqual(["timed"]);
  });
});

describe("deriveLeaderboard：排序口径（与关卡通过同口径，ADR 0006）", () => {
  it("正确率降序：插入乱序 → 榜单有序、rank 连续", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "mid", accuracy: 0.9 }),
        sess({ sessionId: "top", accuracy: 1 }),
        sess({ sessionId: "low", accuracy: 0.8 }),
      ],
      TECHNIQUES,
    );
    expect(board.levels[0].entries.map((e) => e.sessionId)).toEqual(["top", "mid", "low"]);
    expect(board.levels[0].entries.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("正确率相同 → 中位响应升序 tiebreak", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "slow", medianResponseMs: 3100 }),
        sess({ sessionId: "fast", medianResponseMs: 2200 }),
        sess({ sessionId: "mid", medianResponseMs: 2600 }),
      ],
      TECHNIQUES,
    );
    expect(board.levels[0].entries.map((e) => e.sessionId)).toEqual(["fast", "mid", "slow"]);
  });

  it("正确率与中位响应全平 → 早结算者排前（并列确定、测试可断言）", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "later", settledAt: new Date("2026-09-02T10:00:00Z") }),
        sess({ sessionId: "earlier", settledAt: new Date("2026-09-01T10:00:00Z") }),
      ],
      TECHNIQUES,
    );
    expect(board.levels[0].entries.map((e) => e.sessionId)).toEqual(["earlier", "later"]);
  });

  it("正确率优先于中位响应：高正确率慢中位排在低正确率快中位之前", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "fast-low", accuracy: 0.8, medianResponseMs: 1500 }),
        sess({ sessionId: "slow-high", accuracy: 1, medianResponseMs: 5000 }),
      ],
      TECHNIQUES,
    );
    expect(board.levels[0].entries.map((e) => e.sessionId)).toEqual(["slow-high", "fast-low"]);
  });
});

describe("deriveLeaderboard：按关卡分列与全量保留", () => {
  it("列序 = 技巧注册序 × 关卡 manifest 序（与课程树呈现序同源）", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "fg", techniqueId: "functional-groups", levelId: "G1" }),
        sess({ sessionId: "l3", levelId: "L3" }),
        sess({ sessionId: "l1", levelId: "L1" }),
      ],
      TECHNIQUES,
    );
    expect(board.levels.map((l) => `${l.techniqueId}/${l.levelId}`)).toEqual([
      "rhythm-reading/L1",
      "rhythm-reading/L3",
      "functional-groups/G1",
    ]);
  });

  it("全量保留：同关多轮全部入榜、各占一名，totalCount = 条目数", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "r1", accuracy: 0.8 }),
        sess({ sessionId: "r2", accuracy: 1 }),
        sess({ sessionId: "r3", accuracy: 0.9 }),
      ],
      TECHNIQUES,
    );
    const level = board.levels[0];
    expect(level.totalCount).toBe(3);
    expect(level.entries).toHaveLength(3);
    expect(level.entries.map((e) => [e.rank, e.sessionId])).toEqual([
      [1, "r2"],
      [2, "r3"],
      [3, "r1"],
    ]);
  });

  it("无限时成绩的关卡不产出列（数据派生，不占位）", () => {
    const board = deriveLeaderboard([sess({ levelId: "L2" })], TECHNIQUES);
    expect(board.levels.map((l) => l.levelId)).toEqual(["L2"]);
  });

  it("条目字段：时限值当轮快照 / 达标标记 / ISO 时间戳原样携带", () => {
    const board = deriveLeaderboard(
      [
        sess({
          sessionId: "snap",
          timeLimitMs: 10000,
          passed: false,
          accuracy: 0.7,
          settledAt: new Date("2026-09-01T10:00:00Z"),
        }),
      ],
      TECHNIQUES,
    );
    // 派生不重判成绩（服务端只持久化不判定，ADR 0006）：accuracy 与 correctCount 原样携带
    expect(board.levels[0].entries[0]).toEqual({
      rank: 1,
      sessionId: "snap",
      correctCount: 9,
      questionCount: 10,
      accuracy: 0.7,
      medianResponseMs: 2400,
      timeLimitMs: 10000,
      passed: false,
      settledAt: "2026-09-01T10:00:00.000Z",
    });
  });

  it("标题取 manifest；manifest 缺 title 回退 id（结构视图 title 可选）", () => {
    const bare: readonly CourseTechnique[] = [
      { id: "rhythm-reading", track: "main", prerequisites: [], levels: [{ id: "L1" }] },
    ];
    const fallback = deriveLeaderboard([sess()], bare);
    expect(fallback.levels[0].techniqueTitle).toBe("rhythm-reading");
    expect(fallback.levels[0].levelTitle).toBe("L1");

    const named = deriveLeaderboard([sess()], TECHNIQUES);
    expect(named.levels[0].techniqueTitle).toBe("节奏阅读基础");
    expect(named.levels[0].levelTitle).toBe("全·二分·四分音符");
  });
});

describe("deriveLeaderboard：防御口径", () => {
  it("未知技巧/关卡计入总数但不产出列（插件下线后的历史行，#45 同款口径）", () => {
    const board = deriveLeaderboard(
      [
        sess({ sessionId: "known" }),
        sess({ sessionId: "orphan-tech", techniqueId: "removed-plugin", levelId: "X9" }),
        sess({ sessionId: "orphan-level", levelId: "gone-level" }),
      ],
      TECHNIQUES,
    );
    expect(board.totalTimedRounds).toBe(3);
    expect(board.levels).toHaveLength(1);
    expect(board.levels[0].entries.map((e) => e.sessionId)).toEqual(["known"]);
  });
});
