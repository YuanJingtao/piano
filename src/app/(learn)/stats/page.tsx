import type { Metadata } from "next";
import Link from "next/link";

import { loadWeaknessStats } from "@/lib/persistence/wrong-answer-stats";
import type { WeaknessCategoryStats, WeaknessStats } from "@/lib/stats/weakness";

/**
 * 弱项统计页（#45 错题特征聚合视图）：只读展示历史作答的弱项分布，
 * 不做任何自动调度（ADR 0004/0006——复习什么、何时复习由用户掌控）。
 * 数据在服务端渲染时从 answer_record 查询派生（force-dynamic，结算落库后
 * 再访问即最新）；DB 不可用退化为空态（loadWeaknessStats 降级口径）。
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "弱项统计 · 钢琴快速识谱" };

/** 每类展示的弱项条数（「最常答错」排行视图，长尾折叠为计数）。 */
const TOP_N = 10;

function EmptyState({
  emoji,
  title,
  hint,
}: {
  emoji: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        {emoji}
      </p>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="max-w-sm text-sm text-neutral-500">{hint}</p>
      <Link
        href="/"
        className="mt-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
      >
        回到课程树
      </Link>
    </div>
  );
}

function CategorySection({ stats }: { stats: WeaknessCategoryStats }) {
  const top = stats.entries.slice(0, TOP_N);
  const max = top[0]?.wrongCount ?? 1;
  return (
    <section
      aria-label={stats.title}
      className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-neutral-900">{stats.title}</h2>
      <ul className="mt-3 space-y-2.5">
        {top.map((entry, i) => (
          <li
            key={entry.key}
            className="grid grid-cols-[1.5rem_minmax(5.5rem,10rem)_1fr_auto] items-center gap-x-3 gap-y-1 text-sm"
          >
            <span className="text-xs tabular-nums text-neutral-400">{i + 1}</span>
            <span className="truncate font-medium text-neutral-800" title={entry.label}>
              {entry.label}
            </span>
            <span
              aria-hidden
              className="h-2 rounded-full bg-neutral-100"
            >
              <span
                className="block h-2 rounded-full bg-rose-400"
                style={{ width: `${Math.max(6, (entry.wrongCount / max) * 100)}%` }}
              />
            </span>
            <span className="whitespace-nowrap text-xs tabular-nums text-neutral-500">
              错 <span className="font-medium text-rose-600">{entry.wrongCount}</span> 次 / 出现{" "}
              {entry.totalCount} 次
            </span>
          </li>
        ))}
      </ul>
      {stats.entries.length > TOP_N && (
        <p className="mt-3 text-xs text-neutral-400">
          仅显示最常答错的前 {TOP_N} 项（共 {stats.entries.length} 项）。
        </p>
      )}
    </section>
  );
}

export default async function WeaknessStatsPage() {
  const stats: WeaknessStats = await loadWeaknessStats();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">弱项统计</h1>
        <p className="mt-1 text-sm text-neutral-500">
          历史作答的错题特征聚合——最常答错的音名 / 节奏型等弱项分布。只读展示，
          系统不会替你自动调度复习；练习节奏由你掌控。
        </p>
      </header>

      {stats.totalAnswers === 0 ? (
        <EmptyState
          emoji="🌱"
          title="尚无作答记录"
          hint="完成任意关卡的一轮练习并结算后，这里会展示你的弱项分布。中途放弃的轮次不计入统计。"
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            累计作答 <span className="font-medium tabular-nums">{stats.totalAnswers}</span> 题 ·
            答错 <span className="font-medium tabular-nums text-rose-600">{stats.totalWrong}</span>{" "}
            题（限时模式超时记为答错）
          </p>

          {stats.categories.length === 0 ? (
            <EmptyState
              emoji="🎉"
              title="还没有答错的题"
              hint="目前所有作答全部正确，保持下去！弱项分布会在出现错题后自动呈现。"
            />
          ) : (
            stats.categories.map((category) => (
              <CategorySection key={category.category} stats={category} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
