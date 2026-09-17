import type { Sql } from "@/lib/db";
import {
  DEFAULT_USER_ID,
  type BestScore,
  type CourseTechnique,
  type CourseTreeLevelState,
  type CourseTreeTechniqueState,
} from "./contracts";
import { asBoolean, asString } from "./narrow";
import { bestFromRow } from "./settlement";

/**
 * 占位注册表：技巧 manifest 的 truth 在 #34 的静态注册表（代码级插件目录），
 * 本分支与其并行开发、尚不可依赖，故此处为空数组；
 * 训练闭环集成（#38）时以注册表的 TechniqueManifest[] 直连 getCourseTree
 * （结构类型兼容，零转换）。集成测试直接注入 fixture manifest 验证派生逻辑。
 */
export const courseRegistry: readonly CourseTechnique[] = [];

/** LevelProgress 单行事实：某关卡的通过状态与最佳成绩快照。 */
export type LevelProgressRecord = {
  techniqueId: string;
  levelId: string;
  passed: boolean;
  best: BestScore | null;
};

function progressKey(techniqueId: string, levelId: string): string {
  return [techniqueId, levelId].join("::");
}

/**
 * 纯函数派生（ADR 0007：解锁/毕业运行时从 LevelProgress 与 manifest prerequisites
 * 派生，不落库）。规则：
 * - 技巧毕业 ⟺ 关卡列表非空且全部通过（只依赖进度事实，不递归）；
 * - 技巧解锁 ⟺ 全部前置技巧已毕业（主线线性、支线前置由 manifest prerequisites 声明）；
 * - 关卡内线性：技巧解锁后首关即开，第 i+1 关在第 i 关通过后开启；
 * - 复习不受解锁限制：已通过的关卡永远 unlocked（关卡通过永久有效，不衰减）。
 */
export function deriveCourseTree(
  techniques: readonly CourseTechnique[],
  progress: readonly LevelProgressRecord[],
): CourseTreeTechniqueState[] {
  const byKey = new Map<string, LevelProgressRecord>();
  for (const p of progress) byKey.set(progressKey(p.techniqueId, p.levelId), p);
  const techById = new Map<string, CourseTechnique>();
  for (const t of techniques) techById.set(t.id, t);

  const isPassed = (techniqueId: string, levelId: string): boolean =>
    byKey.get(progressKey(techniqueId, levelId))?.passed ?? false;

  const allLevelsPassed = (t: CourseTechnique): boolean =>
    t.levels.length > 0 && t.levels.every((lvl) => isPassed(t.id, lvl.id));

  return techniques.map((t) => {
    const unlocked = t.prerequisites.every((pre) => {
      const preTech = techById.get(pre);
      return preTech !== undefined && allLevelsPassed(preTech);
    });
    const graduated = allLevelsPassed(t);
    let prevPassed = true; // 首关：技巧解锁即开
    const levels: CourseTreeLevelState[] = t.levels.map((lvl) => {
      const rec = byKey.get(progressKey(t.id, lvl.id));
      const passed = rec?.passed ?? false;
      const levelUnlocked = (unlocked && prevPassed) || passed; // 复习不受解锁限制
      prevPassed = passed;
      return {
        id: lvl.id,
        ...(lvl.title !== undefined ? { title: lvl.title } : {}),
        unlocked: levelUnlocked,
        passed,
        best: rec?.best ?? null,
      };
    });
    return {
      id: t.id,
      ...(t.title !== undefined ? { title: t.title } : {}),
      track: t.track,
      unlocked,
      graduated,
      levels,
    };
  });
}

/** 从 DB 读 LevelProgress 并按 manifest 派生课程树（查询时派生，不落库）。 */
export async function getCourseTree(
  sql: Sql,
  techniques: readonly CourseTechnique[] = courseRegistry,
  userId: string = DEFAULT_USER_ID,
): Promise<CourseTreeTechniqueState[]> {
  const rows: unknown = await sql`
    select technique_id, level_id, passed,
           best_correct_count, best_question_count, best_accuracy,
           best_median_response_ms, best_achieved_at
    from level_progress
    where user_id = ${userId}`;
  const progress: LevelProgressRecord[] = [];
  for (const raw of Array.isArray(rows) ? (rows as unknown[]) : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const techniqueId = asString(row["technique_id"]);
    const levelId = asString(row["level_id"]);
    const passed = asBoolean(row["passed"]);
    if (techniqueId === null || levelId === null || passed === null) continue;
    progress.push({ techniqueId, levelId, passed, best: bestFromRow(row) });
  }
  return deriveCourseTree(techniques, progress);
}
