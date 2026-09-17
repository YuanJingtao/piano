import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  client = postgres(url, { max: 1, connect_timeout: 2, idle_timeout: 5 });
  return client;
}

export async function checkDbConnection(): Promise<boolean> {
  const sql = getClient();
  if (!sql) return false;
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
