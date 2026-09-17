/**
 * 个人排行榜派生（#46，纯函数 seam）：限时轮结算成绩 → 按关卡分列的榜单。
 *
 * 口径（ADR 0003/0006，CONTEXT.md「个人排行榜」）：
 * - 单用户产品：榜单 = 自己历史限时成绩，与自己较劲的正向激励，无跨用户比较；
 * - 仅限时轮入榜：timeLimitMs 为 null 的结算轮（非限时练习）不出现；
 * - 按关卡分列：技巧注册序 × 关卡 manifest 序（与课程树呈现序同源）；
 * - 排序键与关卡通过同口径：正确率降序、中位响应升序 tiebreak，不发明复合分数；
 *   两键全平时早结算者排前（与 level_progress best「平手不刷新」同一精神，
 *   保证并列确定、测试可断言）；
 * - 全量保留：成绩不清理、不物化，每轮限时结算都是榜上一条（查询时排序派生）；
 * - 未知技巧/关卡（插件下线后的历史行）计入总数但不产出榜单列——#45 弱项聚合
 *   「脏快照跳过类别但计入总数」同款防御口径。
 */

import type { CourseTechnique } from "@/lib/persistence/contracts";

/** 派生输入：practice_session 行的最小视图（结算轮参数快照 + 结果）。 */
export type LeaderboardSessionInput = {
  sessionId: string;
  techniqueId: string;
  levelId: string;
  /** 逐题时限（ms）当轮快照；null = 非限时轮（不入榜）。 */
  timeLimitMs: number | null;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  accuracy: number;
  medianResponseMs: number;
  settledAt: Date;
};

/** 榜单单条：一轮限时结算的成绩快照（含名次）。 */
export type LeaderboardEntry = {
  /** 关卡内名次，1 起。 */
  rank: number;
  sessionId: string;
  correctCount: number;
  questionCount: number;
  accuracy: number;
  medianResponseMs: number;
  /** 该轮时限值快照（插件调参不使历史榜单口径漂移）。 */
  timeLimitMs: number;
  passed: boolean;
  /** ISO 时间戳。 */
  settledAt: string;
};

/** 榜单单列：一个关卡的全部限时成绩（entries 已排序、带 rank，全量不截断）。 */
export type LeaderboardLevel = {
  techniqueId: string;
  techniqueTitle: string;
  levelId: string;
  levelTitle: string;
  /** 该关限时轮总数（= entries.length，全量保留）。 */
  totalCount: number;
  entries: LeaderboardEntry[];
};

/** 排行榜全量结果。 */
export type LeaderboardData = {
  /** 限时结算轮总数（含未知关卡行：不入列但计数）。 */
  totalTimedRounds: number;
  /** 有限时成绩的关卡列，按技巧注册序 × 关卡 manifest 序。 */
  levels: LeaderboardLevel[];
};

/** 空榜（无限时成绩 / DB 不可用降级共用）。 */
export const EMPTY_LEADERBOARD: LeaderboardData = {
  totalTimedRounds: 0,
  levels: [],
};

/** 排序口径：正确率降序 → 中位响应升序 → 结算时间升序（并列确定）。 */
function compareSessions(
  a: LeaderboardSessionInput,
  b: LeaderboardSessionInput,
): number {
  if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
  if (a.medianResponseMs !== b.medianResponseMs) {
    return a.medianResponseMs - b.medianResponseMs;
  }
  return a.settledAt.getTime() - b.settledAt.getTime();
}

/** 入榜行：timeLimitMs 已收窄为非空（限时轮）。 */
type TimedSession = LeaderboardSessionInput & { timeLimitMs: number };

export function deriveLeaderboard(
  sessions: readonly LeaderboardSessionInput[],
  techniques: readonly CourseTechnique[],
): LeaderboardData {
  // 仅限时轮入榜（SQL 已按 time_limit_ms is not null 过滤，此处为纯函数层的同口径防御）
  const timed: TimedSession[] = [];
  for (const s of sessions) {
    if (s.timeLimitMs !== null) timed.push({ ...s, timeLimitMs: s.timeLimitMs });
  }

  const byLevel = new Map<string, TimedSession[]>();
  for (const s of timed) {
    const key = `${s.techniqueId}::${s.levelId}`;
    const group = byLevel.get(key);
    if (group) group.push(s);
    else byLevel.set(key, [s]);
  }

  const levels: LeaderboardLevel[] = [];
  for (const technique of techniques) {
    for (const level of technique.levels) {
      const key = `${technique.id}::${level.id}`;
      const group = byLevel.get(key);
      if (!group || group.length === 0) continue; // 无限时成绩的关卡不产出列
      const sorted = [...group].sort(compareSessions);
      levels.push({
        techniqueId: technique.id,
        techniqueTitle: technique.title ?? technique.id,
        levelId: level.id,
        levelTitle: level.title ?? level.id,
        totalCount: sorted.length,
        entries: sorted.map((s, i) => ({
          rank: i + 1,
          sessionId: s.sessionId,
          correctCount: s.correctCount,
          questionCount: s.questionCount,
          accuracy: s.accuracy,
          medianResponseMs: s.medianResponseMs,
          timeLimitMs: s.timeLimitMs,
          passed: s.passed,
          settledAt: s.settledAt.toISOString(),
        })),
      });
    }
  }

  return { totalTimedRounds: timed.length, levels };
}
