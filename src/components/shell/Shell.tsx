"use client";

/**
 * 教科书式 IA 壳（ADR 0002）：侧栏课程树 + 内容区，桌面/平板单一响应式布局。
 *
 * - 桌面（≥lg）：课程树常驻左侧栏（sticky，独立滚动）；
 * - 平板/窄视口（<lg）：课程树收为抽屉（off-canvas），顶栏汉堡按钮开合，
 *   点遮罩 / Esc / 路由切换自动收起；训练区（内容区）最大化。
 *
 * sidebar 由服务端布局传入（RSC 作为 prop 穿过客户端边界，状态派生留在服务端）。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type ShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export default function Shell({ sidebar, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // 路由切换即收起抽屉（平板下点课程树导航后不遮挡内容）。
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
      {/* 顶栏：仅平板/窄视口（汉堡 + 品牌） */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="打开课程树"
          aria-expanded={drawerOpen}
          aria-controls="course-sidebar"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md border border-neutral-300 bg-white p-2 text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
            <path
              fillRule="evenodd"
              d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <Link href="/" className="text-sm font-semibold tracking-tight">
          钢琴快速识谱
        </Link>
      </header>

      {/* 抽屉遮罩（仅 <lg 且抽屉打开时） */}
      {drawerOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-neutral-900/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 课程树侧栏：桌面 sticky 常驻；<lg 为 off-canvas 抽屉 */}
      <aside
        id="course-sidebar"
        aria-label="课程树"
        className={`fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto border-r border-neutral-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:transition-none ${
          drawerOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      {/* 内容区：教程与训练（训练区最大化，ADR 0002） */}
      <main className="min-w-0">{children}</main>
    </div>
  );
}
