import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { tutorials } from "@/content/tutorials";
import type { CourseNavTechnique } from "@/lib/course/nav-types";
import { loadCourseNav } from "@/lib/course/nav-view";

/**
 * 技巧教程页：长文 MDX（正文内嵌五线谱谱例 / 键盘图 / 听音环节，ADR 0002）。
 * 技巧解锁即可读（无阅读门槛、不追踪阅读状态）；未解锁渲染锁定提示。
 */

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function findTechnique(id: string): Promise<CourseNavTechnique | undefined> {
  const nav = await loadCourseNav();
  return [...nav.main, ...nav.side].find((t) => t.id === id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const technique = await findTechnique(id);
  return { title: technique ? `${technique.title} · 钢琴快速识谱` : "未找到技巧" };
}

export default async function TechniqueTutorialPage({ params }: PageProps) {
  const { id } = await params;
  const technique = await findTechnique(id);
  if (!technique) notFound();

  if (!technique.unlocked) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-5 py-16 lg:px-10">
        <p className="text-4xl" aria-hidden>
          🔒
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{technique.title}</h1>
        <p className="text-neutral-600">{technique.lockHint ?? "完成前置技巧后解锁。"}</p>
        <Link
          href="/"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
        >
          回到课程树
        </Link>
      </div>
    );
  }

  const Tutorial = tutorials[id];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
      <nav aria-label="面包屑" className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
        <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600">
          {technique.track === "main" ? "主线" : "支线"}
        </span>
        <span aria-hidden>/</span>
        <span className="font-medium text-neutral-800">{technique.title}</span>
        <span className="ml-auto text-xs text-neutral-400">
          关卡 {technique.levels.filter((l) => l.passed).length}/{technique.levels.length}
        </span>
      </nav>

      {Tutorial ? (
        <article className="prose prose-neutral max-w-none prose-headings:tracking-tight prose-figure:my-6">
          <Tutorial />
        </article>
      ) : (
        <p className="text-neutral-600">教程页编写中。</p>
      )}

      <LevelPracticeList technique={technique} />
    </div>
  );
}

/**
 * 教程页底部的关卡练习入口（#38）：读毕即练，教科书式「课后练习」形态。
 * 状态来自 loadCourseNav（LevelProgress 查询时派生）；点击进入关卡练习页，
 * 「开始」按钮在练习页内完成音频解锁（同一手势，AC1）。
 */
function LevelPracticeList({ technique }: { technique: CourseNavTechnique }) {
  return (
    <section aria-labelledby="level-practice-heading" className="mt-12 border-t border-neutral-200 pt-8">
      <h2 id="level-practice-heading" className="text-lg font-semibold tracking-tight">
        关卡练习
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        按顺序通过全部关卡即可毕业本技巧、解锁后续内容；已通过的关卡可随时复习。
      </p>
      <ul className="mt-4 space-y-2">
        {technique.levels.map((level) => {
          const href = `/techniques/${technique.id}/levels/${level.id}`;
          if (!level.unlocked) {
            return (
              <li
                key={level.id}
                className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-400"
              >
                <span aria-hidden>🔒</span>
                <span className="font-medium">
                  {level.id} · {level.title}
                </span>
                <span className="ml-auto text-xs">通过上一关后解锁</span>
              </li>
            );
          }
          return (
            <li key={level.id}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <span className="font-medium text-neutral-900">
                  {level.id} · {level.title}
                </span>
                {level.passed && level.best && (
                  <span className="text-xs tabular-nums text-emerald-700">
                    ✓ 已通过 · 最佳 {level.best.correctCount}/{level.best.questionCount} · 中位{" "}
                    {level.best.medianResponseMs}ms
                  </span>
                )}
                {level.passed && !level.best && (
                  <span className="text-xs text-emerald-700">✓ 已通过</span>
                )}
                <span className="ml-auto text-xs font-medium text-amber-700">
                  {level.passed ? "复习 →" : "开始练习 →"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
