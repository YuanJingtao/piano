import { redirect } from "next/navigation";

import { registeredTechniques } from "@/lib/persistence/course-tree";

/**
 * 应用入口：打开即进入教科书（侧栏课程树 + 首个主线技巧教程页）。
 * 首个主线技巧 = 注册表主线顺序第一位（注册顺序即教学顺序；
 * #39 键盘地理落地后将先于地标音注册，本路由零改动跟随）。
 */
export default function LearnHome() {
  const techniques = registeredTechniques();
  const first = techniques.find((t) => t.track === "main") ?? techniques[0];
  if (first) redirect(`/techniques/${first.id}`);
  return (
    <div className="p-10 text-neutral-600">
      尚无已注册技巧（src/plugins/index.ts 为空）。
    </div>
  );
}
