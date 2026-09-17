/**
 * CI 门槛守卫：seam 3 集成测试要求真实 PostgreSQL（ci.yml 的 service 容器）。
 * CI 上缺 DATABASE_URL 直接报错，防止集成测试被静默跳过、门槛形同虚设。
 */
export default function globalSetup() {
  if (process.env.CI && !process.env.DATABASE_URL) {
    throw new Error(
      "CI 必须显式设置 DATABASE_URL：集成测试需要真实 PostgreSQL service（见 .github/workflows/ci.yml）",
    );
  }
}
