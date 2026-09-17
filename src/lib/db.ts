import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // onnotice 置空：迁移里 create-if-not-exists 的 NOTICE 属预期噪音，不打日志
  client = postgres(url, {
    max: 1,
    connect_timeout: 2,
    idle_timeout: 5,
    onnotice: () => {},
  });
  return client;
}

/** 共享连接池单例；DATABASE_URL 未配置时返回 null（由调用方决定降级行为）。 */
export function getSql(): Sql | null {
  return getClient();
}

export async function checkDbConnection(): Promise<boolean> {
  const sql = getClient();
  if (!sql) return false;
  try {
    await sql`select 1`;
    return true;
  } catch (err) {
    console.error("[db] connectivity check failed", err);
    return false;
  }
}
