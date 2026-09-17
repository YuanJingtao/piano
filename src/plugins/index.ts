/**
 * 技巧静态注册表入口（ADR 0007）。
 *
 * 新增技巧 = 新增 src/plugins/<id>/ 目录 + 下方一行注册，核心零改动。
 * 使用方 import "@/plugins" 触发全部注册，再经 getTechnique/listTechniques 消费。
 */
import { registerTechnique } from "@/domain/registry";
import examplePlugin from "./example";

registerTechnique(examplePlugin);
// #37 起真实技巧在此追加：registerTechnique(landmarkNotesPlugin); ...
