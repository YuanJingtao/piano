import { checkDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await checkDbConnection();
  return Response.json({ db: ok ? "up" : "down" }, { status: ok ? 200 : 503 });
}
