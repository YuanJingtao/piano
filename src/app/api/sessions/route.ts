import { getSql } from "@/lib/db";
import { parseSettlementPayload, submitSettlement } from "@/lib/persistence/settlement";

export const dynamic = "force-dynamic";

/**
 * POST /api/sessions — 轮次结算提交。
 * 客户端 Round 引擎完成整轮判定后一次提交当轮 PracticeSession + 全部 AnswerRecord；
 * 服务端只校验结构并持久化，不做判定（ADR 0006）。仅结算轮走此端点，中途放弃不留痕。
 */
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = parseSettlementPayload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "db unavailable" }, { status: 503 });
  }
  try {
    const outcome = await submitSettlement(sql, parsed.value);
    return Response.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[sessions] settlement failed", err);
    return Response.json({ error: "settlement failed" }, { status: 500 });
  }
}
