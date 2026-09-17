import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PracticeStage from "@/components/training/PracticeStage";
import { getTechnique } from "@/domain/registry";
import type { CourseNavTechnique } from "@/lib/course/nav-types";
import { loadCourseNav } from "@/lib/course/nav-view";
import "@/plugins"; // 静态注册副作用（ADR 0007）

/**
 * 关卡练习页（#38 训练闭环入口）：内容区训练（ADR 0002），侧栏课程树保持可见。
 *
 * 状态派生留在服务端：解锁校验走 loadCourseNav（LevelProgress 查询时派生，
 * ADR 0006/0007；DB 故障退化为空进度，首关仍可练习）；
 * 关卡定义（题数/阈值/题池）从注册表 manifest 取——代码即 truth，
 * LevelDef 为 JSON 可序列化对象，原样穿过客户端边界交给 PracticeStage。
 */

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string; levelId: string }> };

async function findTechnique(id: string): Promise<CourseNavTechnique | undefined> {
  const nav = await loadCourseNav();
  return [...nav.main, ...nav.side].find((t) => t.id === id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, levelId } = await params;
  const technique = await findTechnique(id);
  const level = technique?.levels.find((l) => l.id === levelId);
  return {
    title: level && technique
      ? `${level.id} ${level.title} · ${technique.title} · 钢琴快速识谱`
      : "未找到关卡",
  };
}

export default async function LevelPracticePage({ params }: PageProps) {
  const { id, levelId } = await params;
  const technique = await findTechnique(id);
  if (!technique) notFound();
  const levelState = technique.levels.find((l) => l.id === levelId);
  if (!levelState) notFound();

  // 关卡定义以注册表 manifest 为准（loadCourseNav 只带 id/title/状态视图）。
  let manifest;
  try {
    manifest = getTechnique(id).manifest;
  } catch {
    notFound();
  }
  const levelIndex = manifest.levels.findIndex((l) => l.id === levelId);
  if (levelIndex < 0) notFound();
  const levelDef = manifest.levels[levelIndex];
  const next = manifest.levels[levelIndex + 1];

  const locked = !technique.unlocked || !levelState.unlocked;
  if (locked) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-5 py-16 lg:px-10">
        <p className="text-4xl" aria-hidden>
          🔒
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {levelDef.id} · {levelDef.title}
        </h1>
        <p className="text-neutral-600">
          {!technique.unlocked
            ? technique.lockHint ?? "完成前置技巧后解锁。"
            : "通过上一关后解锁本关。"}
        </p>
        <Link
          href={`/techniques/${id}`}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
        >
          返回 {technique.title} 教程
        </Link>
      </div>
    );
  }

  return (
    <PracticeStage
      techniqueId={id}
      techniqueTitle={technique.title}
      level={levelDef}
      initialState={{ passed: levelState.passed, best: levelState.best }}
      nextLevel={next ? { id: next.id, title: next.title } : null}
    />
  );
}
