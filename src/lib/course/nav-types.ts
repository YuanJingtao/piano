/**
 * 课程树侧栏视图模型（纯类型，客户端/服务端共享）。
 * 由 nav-view.ts 在服务端从注册表 manifest + LevelProgress 派生状态合并而成。
 */

import type { BestScore } from "@/lib/persistence/contracts";

export type CourseNavLevel = {
  id: string;
  title: string;
  unlocked: boolean;
  passed: boolean;
  /** 最佳成绩快照（练习页复习轮展示用，#38）；无结算记录为 null。 */
  best: BestScore | null;
};

export type CourseNavTechnique = {
  id: string;
  title: string;
  track: "main" | "side";
  unlocked: boolean;
  /** 全部关卡通过 = 技巧毕业（派生）。 */
  graduated: boolean;
  /** 未解锁时的提示文案（如「键盘地理毕业后解锁」）；已解锁为 undefined。 */
  lockHint?: string;
  levels: CourseNavLevel[];
};

export type CourseNavData = {
  /** 主线技巧（注册顺序 = 展示顺序 = 教学顺序）。 */
  main: CourseNavTechnique[];
  /** 支线技巧。 */
  side: CourseNavTechnique[];
};
