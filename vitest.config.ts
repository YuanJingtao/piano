import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    // seam 3 集成测试共享同一个 PostgreSQL 数据库（用例间 truncate 清场），
    // 文件间串行避免互相清掉对方的数据。
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
