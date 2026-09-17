/**
 * 领域内核公开面：类型 + Round 引擎 + 静态注册表。
 * 纯 TypeScript，无 DOM/DB 依赖；浏览器层与服务端均经此消费领域逻辑。
 */
export * from "./types";
export { drawQuestion, questionKey, MISTAKE_WEIGHT } from "./sampling";
export { Round, type RoundConfig } from "./round";
export { registerTechnique, getTechnique, listTechniques } from "./registry";
