import type { Metadata } from "next";
import Link from "next/link";

import type { LeaderboardData, LeaderboardLevel } from "@/lib/leaderboard/leaderboard";
import { loadLeaderboard } from "@/lib/persistence/leaderboard";

/**
 * 个人排行榜页（#46，ADR 0003）：单用户产品下的榜单 = 自己历史限时成绩的
 * 分列展示，用作正向激励——与自己较劲，无跨用户比较。
 *
 * 排序键与关卡通过同口径（正确率降序、中位响应升序 tiebreak，ADR 0006），
 * 不发明复合分数；成绩全量保留、查询时排序派生，仅限时轮入榜。
 * 数据在服务端渲染时从 practice_session 派生（force-dynamic，结算落库后
 * 再访问即最新）；DB 不可用退化为空态（loadLeaderboard 降级口径）。
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "个人排行榜 · 钢琴快速识谱" };

/** 每关展示的名次条数（榜单视图，长尾折叠为计数；数据层全量保留不截断）。 */
const TOP_N = 10;

/** 前三名的奖牌（榜单习惯用语，正向激励）。 */
const RANK_MEDALS = ["🥇", "🥈", "🥉"] as const;

function formatSettledAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

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

function LevelSection({ level }: { level: LeaderboardLevel }) {
  const top = level.entries.slice(0, TOP_N);
  return (
    <section
      aria-label={`${level.techniqueTitle} ${level.levelTitle}`}
      className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          {level.techniqueTitle}
          <span className="mx-1.5 text-neutral-300" aria-hidden>
            ·
          </span>
          {level.levelId} {level.levelTitle}
        </h2>
        <span className="whitespace-nowrap text-xs text-neutral-400">
          {level.totalCount} 轮限时成绩
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {top.map((entry) => (
          <li
            key={entry.sessionId}
            className={`grid grid-cols-[2.25rem_minmax(9.5rem,1fr)_auto_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-sm ${
              entry.rank === 1 ? "bg-amber-50" : ""
            }`}
          >
            <span
              className={`text-xs tabular-nums ${
                entry.rank <= RANK_MEDALS.length ? "text-base leading-none" : "text-neutral-400"
              }`}
              aria-label={`第 ${entry.rank} 名`}
            >
              {entry.rank <= RANK_MEDALS.length ? RANK_MEDALS[entry.rank - 1] : entry.rank}
            </span>
            <span className="truncate tabular-nums text-neutral-800">
              正确 {entry.correctCount}/{entry.questionCount}
              <span className="ml-1.5 font-medium">
                {Math.round(entry.accuracy * 100)}%
              </span>
              <span className="ml-1.5 text-xs text-neutral-400">
                中位 {formatSeconds(entry.medianResponseMs)}
              </span>
            </span>
            <span className="whitespace-nowrap text-xs text-neutral-400">
              {entry.passed ? (
                <span className="text-emerald-600">达标 ✓</span>
              ) : (
                "未达标"
              )}
              <span className="mx-1 text-neutral-200" aria-hidden>
                ·
              </span>
              限时 {formatSeconds(entry.timeLimitMs)}
            </span>
            <time
              dateTime={entry.settledAt}
              className="whitespace-nowrap text-xs tabular-nums text-neutral-400"
            >
              {formatSettledAt(entry.settledAt)}
            </time>
          </li>
        ))}
      </ul>
      {level.entries.length > TOP_N && (
        <p className="mt-3 text-xs text-neutral-400">
          仅显示前 {TOP_N} 名（共 {level.entries.length} 轮限时成绩，全量保留）。
        </p>
      )}
    </section>
  );
}

export default async function LeaderboardPage() {
  const board: LeaderboardData = await loadLeaderboard();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">个人排行榜</h1>
        <p className="mt-1 text-sm text-neutral-500">
          限时模式的历史成绩——与自己的过去较劲。按关卡分列，正确率降序、中位响应升序排序
          （与关卡通过同口径）；仅限时轮入榜，成绩全量保留、永不清理。
        </p>
      </header>

      {board.totalTimedRounds === 0 ? (
        <EmptyState
          emoji="🏅"
          title="尚无限时成绩"
          hint="在节奏关卡打开限时模式开关，完成一轮并结算后成绩即入榜。非限时轮不入榜——压力由你自己掌控。"
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            累计限时轮 <span className="font-medium tabular-nums">{board.totalTimedRounds}</span>{" "}
            轮 · 覆盖 <span className="font-medium tabular-nums">{board.levels.length}</span>{" "}
            个关卡（超时记为答错、轮次继续，口径与练习一致）
          </p>
          {board.levels.map((level) => (
            <LevelSection
              key={`${level.techniqueId}::${level.levelId}`}
              level={level}
            />
          ))}
        </div>
      )}
    </div>
  );
}
