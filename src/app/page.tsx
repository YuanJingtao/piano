import { checkDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dbOk = await checkDbConnection();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">钢琴快速识谱</h1>
      <p className="text-lg text-neutral-600">
        面向钢琴初学者的识谱训练 · Walking skeleton 占位首页
      </p>
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${dbOk ? "bg-emerald-500" : "bg-rose-500"}`}
        />
        <span>PostgreSQL {dbOk ? "已连通" : "未连通"}</span>
      </div>
    </main>
  );
}
