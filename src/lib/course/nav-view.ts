import { getSql } from "@/lib/db";
import type { CourseTreeTechniqueState } from "@/lib/persistence/contracts";
import {
  deriveCourseTree,
  getCourseTree,
  registeredTechniques,
} from "@/lib/persistence/course-tree";

import type { CourseNavData, CourseNavTechnique } from "./nav-types";

/**
 * 课程树侧栏数据装载（服务端专用）：
 * 结构 = 静态注册表 manifest（ADR 0007），状态 = LevelProgress 查询时派生（ADR 0006/0007）。
 * DB 不可用时退化为空进度派生（结构完整、状态回退），教程页不因 DB 故障白屏。
 */
export async function loadCourseNav(): Promise<CourseNavData> {
  const techniques = registeredTechniques();
  let states: CourseTreeTechniqueState[];
  const sql = getSql();
  if (sql) {
    try {
      states = await getCourseTree(sql, techniques);
    } catch (err) {
      console.error("[course-nav] 课程树派生失败，退化为空进度", err);
      states = deriveCourseTree(techniques, []);
    }
  } else {
    states = deriveCourseTree(techniques, []);
  }

  const manifestById = new Map(techniques.map((t) => [t.id, t]));
  const merged: CourseNavTechnique[] = states.map((state) => {
    const manifest = manifestById.get(state.id);
    const lockHint =
      state.unlocked || !manifest
        ? undefined
        : `「${manifest.prerequisites
            .map((pre) => manifestById.get(pre)?.title ?? pre)
            .join("」「")}」毕业后解锁`;
    return {
      id: state.id,
      title: state.title ?? manifest?.title ?? state.id,
      track: state.track,
      unlocked: state.unlocked,
      graduated: state.graduated,
      ...(lockHint !== undefined ? { lockHint } : {}),
      levels: state.levels.map((lvl) => ({
        id: lvl.id,
        title: lvl.title ?? lvl.id,
        unlocked: lvl.unlocked,
        passed: lvl.passed,
        best: lvl.best,
      })),
    };
  });

  return {
    main: merged.filter((t) => t.track === "main"),
    side: merged.filter((t) => t.track === "side"),
  };
}
