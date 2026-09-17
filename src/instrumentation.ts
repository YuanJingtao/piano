/**
 * Next.js 服务启动钩子：自动应用 DB 迁移。
 * docker compose up 即完成建表 + seed，无需独立迁移命令。
 * DATABASE_URL 未配置（如 docker build 阶段）或 DB 暂不可达时只记日志不崩启动，
 * 连通状态由 /api/health 暴露。
 *
 * 注意：动态 import 必须写在正向 if 块内部——Next 会为 edge 运行时编译
 * instrumentation，NEXT_RUNTIME 经 DefinePlugin 常量折叠后该分支为死分支，
 * webpack 才会跳过其中的 postgres（node-only，依赖 net/tls）；
 * 早退（!== "nodejs" 就 return）写法会让 edge 编译静态解析到 postgres 而报
 * "Can't resolve 'net'"。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getSql } = await import("@/lib/db");
    const { migrate } = await import("@/lib/db/migrate");
    const sql = getSql();
    if (!sql) return;
    try {
      await migrate(sql);
      console.log("[db] schema ready");
    } catch (err) {
      console.error("[db] migration failed", err);
    }
  }
}
