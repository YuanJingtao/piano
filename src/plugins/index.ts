/**
 * 技巧静态注册表入口（ADR 0007）。
 *
 * 新增技巧 = 新增 src/plugins/<id>/ 目录 + 下方一行注册，核心零改动。
 * 使用方 import "@/plugins" 触发全部注册，再经 getTechnique/listTechniques 消费。
 *
 * 只注册产品技巧：内存示例插件（./example）是 #34 验收演示，不进生产注册表——
 * 课程树从注册表枚举渲染，示例技巧不属于课程内容；其测试显式注册。
 */
import { registerTechnique } from "@/domain/registry";
import landmarkNotesPlugin from "./landmark-notes";
import rhythmReadingPlugin from "./rhythm-reading";

registerTechnique(landmarkNotesPlugin);
registerTechnique(rhythmReadingPlugin);
// 主线其余技巧落地后在此追加（#39 键盘地理 / #40 方向与音程 / #42 五指位置）：
// registerTechnique(keyboardGeographyPlugin); ...
// 教学顺序 = 注册顺序；#39/#40 合入时按主线顺序调整注册位置（键盘地理 → 地标音 → 方向音程 → 节奏）。
