import path from "node:path";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

/**
 * MDX 管线 = @next/mdx（#37 选型决议）：教程内容在仓库内随插件目录版本化
 * （代码即 truth，ADR 0007），构建期编译、零运行时依赖；next-mdx-remote 的
 * 运行时编译/序列化面向 CMS/DB 内容，本产品（单用户本地部署）用不到。
 * 共享交互组件经 src/mdx-components.tsx 全局注入教程页。
 *
 * 注意：dev 必须走 Turbopack（npm run dev = next dev --turbopack）。
 * Next 15.5 webpack dev 的 RSC 层渲染 MDX 会命中 React internals 版本错配
 * （TypeError: Cannot read properties of undefined (reading 'recentlyCreatedOwnerStacks')，
 * 上游 vercel/next.js#77554 同族问题，Next 16 起 Turbopack 为 dev 默认）；
 * 生产 webpack 构建（npm run build/start）不受影响，CI 与部署路径不变。
 */
const withMDX = createMDX();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname),
};

export default withMDX(nextConfig);
