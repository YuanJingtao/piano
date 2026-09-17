import type { Sql } from "@/lib/db";
import { migrations } from "./migrations";

/**
 * 幂等迁移：schema_migration 记录已应用 id，按声明顺序补齐未应用的。
 * 每条迁移在独立事务里执行（DDL + 记录原子提交）。
 */
export async function migrate(sql: Sql): Promise<void> {
  await sql`
    create table if not exists schema_migration (
      id text primary key,
      applied_at timestamptz not null default now()
    )`;
  const applied: unknown = await sql`select id from schema_migration`;
  const done = new Set(
    (Array.isArray(applied) ? applied : []).map((r) => String((r as { id: unknown }).id)),
  );
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      await tx`insert into schema_migration (id) values (${m.id})`;
    });
  }
}
