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
import directionIntervalsPlugin from "./direction-intervals";
import keyboardGeographyPlugin from "./keyboard-geography";
import landmarkNotesPlugin from "./landmark-notes";

// 注册顺序 = 课程树主线呈现顺序（listTechniques 按注册序枚举）：键盘地理是主线第一站。
registerTechnique(keyboardGeographyPlugin);
registerTechnique(landmarkNotesPlugin);
registerTechnique(directionIntervalsPlugin);
// 主线其余技巧落地后在此追加（#41 节奏 / #42 五指位置）：
// registerTechnique(rhythmReadingPlugin); ...
