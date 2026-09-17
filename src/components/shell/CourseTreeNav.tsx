"use client";

/**
 * 侧栏课程树（ADR 0002 教科书式 IA）：主线/支线技巧 + 关卡状态。
 * 结构与状态由服务端从注册表 manifest + LevelProgress 派生后经 props 传入
 * （可序列化视图模型 nav-types.ts）；本组件只做展示与交互
 * （当前技巧高亮、关卡列表展开/收起）。
 *
 * 关卡行 = 练习入口链接（#38 训练闭环）：已解锁关卡链到练习页，未解锁为纯展示。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { CourseNavData, CourseNavTechnique } from "@/lib/course/nav-types";

/** 状态点：已通过 / 已解锁未通过 / 未解锁（类名收敛一处，避免重复拼接）。 */
const LEVEL_DOT_CLASS = {
  passed: "bg-emerald-500",
  unlocked: "border border-neutral-400 bg-white",
  locked: "bg-neutral-200",
} as const;

function levelDotClass(level: { passed: boolean; unlocked: boolean }): string {
  if (level.passed) return LEVEL_DOT_CLASS.passed;
  return level.unlocked ? LEVEL_DOT_CLASS.unlocked : LEVEL_DOT_CLASS.locked;
}

function TechniqueBlock({
  technique,
  active,
  expanded,
  onToggle,
  pathname,
}: {
  technique: CourseNavTechnique;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const passedCount = technique.levels.filter((l) => l.passed).length;

  const heading = (
    <span className="flex flex-1 items-center gap-1.5 text-left">
      <span className={`flex-1 truncate ${technique.unlocked ? "" : "text-neutral-400"}`}>
        {technique.title}
      </span>
      {!technique.unlocked && <span aria-label="未解锁">🔒</span>}
      {technique.unlocked && technique.graduated && (
        <span className="text-emerald-600" aria-label="已毕业">
          ✅
        </span>
      )}
      {technique.unlocked && !technique.graduated && (
        <span className="text-xs text-neutral-400">
          {passedCount}/{technique.levels.length}
        </span>
      )}
    </span>
  );

  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded-md pr-1 transition-colors ${
          active ? "bg-amber-50" : ""
        }`}
      >
        {technique.unlocked ? (
          <Link
            href={`/techniques/${technique.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 ${
              active ? "text-amber-900" : "text-neutral-800"
            }`}
          >
            {heading}
          </Link>
        ) : (
          <span className="flex flex-1 cursor-not-allowed items-center gap-1.5 px-2.5 py-2 text-sm font-medium text-neutral-400">
            {heading}
          </span>
        )}
        {technique.unlocked && technique.levels.length > 0 && (
          <button
            type="button"
            aria-label={expanded ? `收起 ${technique.title} 关卡` : `展开 ${technique.title} 关卡`}
            aria-expanded={expanded}
            onClick={onToggle}
            className="rounded p-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            {expanded ? "▾" : "▸"}
          </button>
        )}
      </div>

      {!technique.unlocked && technique.lockHint && (
        <p className="px-2.5 pb-1 text-xs text-neutral-400">{technique.lockHint}</p>
      )}

      {technique.unlocked && expanded && (
        <ul className="mt-0.5 space-y-0.5 border-l border-neutral-200 pb-1 pl-3 ml-4">
          {technique.levels.map((level) => {
            const href = `/techniques/${technique.id}/levels/${level.id}`;
            const active = pathname === href;
            const rowClass = `flex items-center gap-2 rounded px-2 py-1 text-sm ${
              active ? "bg-amber-50 font-medium text-amber-900" : "text-neutral-600"
            }`;
            const content = (
              <>
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${levelDotClass(level)}`} />
                <span className="flex-1 truncate">
                  {level.id} · {level.title}
                </span>
                {level.passed && (
                  <span className="text-xs text-emerald-600" aria-label="已通过">
                    ✓
                  </span>
                )}
                {!level.passed && !level.unlocked && (
                  <span className="text-xs text-neutral-300" aria-label="未解锁">
                    🔒
                  </span>
                )}
              </>
            );
            return (
              <li key={level.id}>
                {level.unlocked ? (
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`${rowClass} transition-colors hover:bg-neutral-100 hover:text-neutral-900`}
                  >
                    {content}
                  </Link>
                ) : (
                  <span className={rowClass}>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function CourseTreeNav({ nav }: { nav: CourseNavData }) {
  const pathname = usePathname();
  const activeTechniqueId = pathname.startsWith("/techniques/")
    ? decodeURIComponent(pathname.slice("/techniques/".length).split("/")[0])
    : undefined;

  // 展开状态：当前技巧默认展开，其余收起；手动开合覆盖默认。
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isExpanded = (id: string): boolean => overrides[id] ?? id === activeTechniqueId;
  const toggle = (id: string) =>
    setOverrides((prev) => ({ ...prev, [id]: !(prev[id] ?? id === activeTechniqueId) }));

  const section = (label: string, techniques: CourseNavTechnique[]) =>
    techniques.length === 0 ? null : (
      <section aria-label={label}>
        <h2 className="px-2.5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {label}
        </h2>
        <ul className="space-y-0.5">
          {techniques.map((technique) => (
            <TechniqueBlock
              key={technique.id}
              technique={technique}
              active={technique.id === activeTechniqueId}
              expanded={isExpanded(technique.id)}
              onToggle={() => toggle(technique.id)}
              pathname={pathname}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <nav className="flex min-h-full flex-col px-2 pb-4" aria-label="课程树">
      <div className="flex items-center gap-2 px-2.5 pb-2 pt-5">
        <span aria-hidden className="text-xl">
          🎹
        </span>
        <div>
          <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-900">
            钢琴快速识谱
          </Link>
          <p className="text-xs text-neutral-400">教科书式识谱训练</p>
        </div>
      </div>

      <div className="flex-1">
        {section("主线", nav.main)}
        {section("支线", nav.side)}
      </div>

      <div className="space-y-1 border-t border-neutral-100 px-2.5 pt-3 text-xs">
        <Link
          href="/stats"
          aria-current={pathname === "/stats" ? "page" : undefined}
          className={`block transition-colors ${
            pathname === "/stats"
              ? "font-medium text-amber-900"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          弱项统计（错题特征聚合）
        </Link>
        <Link
          href="/leaderboard"
          aria-current={pathname === "/leaderboard" ? "page" : undefined}
          className={`block transition-colors ${
            pathname === "/leaderboard"
              ? "font-medium text-amber-900"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          个人排行榜（限时模式）
        </Link>
        <Link
          href="/playground"
          className="block text-neutral-400 transition-colors hover:text-neutral-600"
        >
          Playground（发声层与组件走查）
        </Link>
      </div>
    </nav>
  );
}
