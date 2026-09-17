import { getSql } from "@/lib/db";
import { getCourseTree } from "@/lib/persistence/course-tree";

export const dynamic = "force-dynamic";

/**
 * GET /api/course-tree — 课程树状态。
 * 从 LevelProgress + manifest prerequisites 查询时派生（解锁/毕业不落库，ADR 0006/0007）。
 */
export async function GET() {
  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "db unavailable" }, { status: 503 });
  }
  try {
    const techniques = await getCourseTree(sql);
    return Response.json({ techniques });
  } catch (err) {
    console.error("[course-tree] derivation failed", err);
    return Response.json({ error: "course tree failed" }, { status: 500 });
  }
}
