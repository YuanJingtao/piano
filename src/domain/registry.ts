import type { TechniquePlugin } from "./types";

/**
 * 技巧静态注册表（ADR 0007）：代码级注册，不做运行时热加载、不 DB 配置驱动。
 * 新增技巧 = 新增 src/plugins/<id>/ 目录 + src/plugins/index.ts 注册表一行，核心零改动。
 */
const registry = new Map<string, TechniquePlugin>();

/** 注册一个技巧插件；id 重复视为程序错误，直接抛。 */
export function registerTechnique(plugin: TechniquePlugin): void {
  const id = plugin.manifest.id;
  if (registry.has(id)) throw new Error(`registerTechnique: duplicate technique id "${id}"`);
  registry.set(id, plugin);
}

/** 按 manifest id 取插件；未注册抛错（引用完整性由静态注册保证）。 */
export function getTechnique(id: string): TechniquePlugin {
  const plugin = registry.get(id);
  if (!plugin) throw new Error(`getTechnique: unknown technique "${id}"`);
  return plugin;
}

/** 全部已注册技巧（只读视图）；课程树/解锁派生从这里枚举。 */
export function listTechniques(): readonly TechniquePlugin[] {
  return [...registry.values()];
}

/** 仅供测试隔离使用：清空注册表。生产代码不得调用。 */
export function __clearRegistryForTests(): void {
  registry.clear();
}
