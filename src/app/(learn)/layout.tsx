import CourseTreeNav from "@/components/shell/CourseTreeNav";
import Shell from "@/components/shell/Shell";
import { loadCourseNav } from "@/lib/course/nav-view";

/**
 * 学习壳布局（教科书式 IA，ADR 0002）：侧栏课程树 + 内容区。
 * 课程树数据在布局层服务端装载（manifest 结构 + 进度派生状态），
 * 以可序列化视图模型传入客户端组件；#38 结算落库后经 router.refresh() 更新。
 */

export const dynamic = "force-dynamic";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const nav = await loadCourseNav();
  return (
    <Shell sidebar={<CourseTreeNav nav={nav} />}>
      {children}
    </Shell>
  );
}
