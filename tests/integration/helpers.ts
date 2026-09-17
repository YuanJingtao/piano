import postgres from "postgres";
import { describe } from "vitest";
import { getSql, type Sql } from "@/lib/db";
import { migrate } from "@/lib/db/migrate";
import {
  DEFAULT_USER_ID,
  type AnswerPayload,
  type SessionParamsSnapshot,
  type SessionResult,
  type SettlementPayload,
} from "@/lib/persistence/contracts";
import { asRecord } from "@/lib/persistence/narrow";

/** 本地缺省用 docker compose 的 db；CI 由 service 容器注入 DATABASE_URL。 */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://piano:piano@localhost:5432/piano";

// 让被测生产路径（route 里的 getSql 懒读取 env）与测试使用同一 URL
process.env.DATABASE_URL = TEST_DATABASE_URL;

async function probeDb(): Promise<boolean> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, connect_timeout: 2 });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export const dbAvailable = await probeDb();

/**
 * seam 3 集成测试套件：真实容器化 PostgreSQL，不 mock。
 * 本地无 DB 时跳过；CI 必有 DATABASE_URL（global-setup 校验存在性），
 * 连不上时在 beforeAll 响亮失败而不是静默跳过。
 */
export const integration = describe.skipIf(!dbAvailable && !process.env.CI);

export function testSql(): Sql {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL 未生效（helpers 顶层已兜底赋值，不应走到这里）");
  return sql;
}

/** 每个用例前：幂等补迁移 + 清空四实体 + 重 seed 单用户。 */
export async function resetDb(): Promise<void> {
  const sql = testSql();
  await migrate(sql);
  await sql`truncate users cascade`;
  await sql`insert into users (id, display_name)
    values (${DEFAULT_USER_ID}, '琴童')
    on conflict (id) do nothing`;
}

export async function closeDb(): Promise<void> {
  await getSql()?.end({ timeout: 5 }).catch(() => undefined);
}

/* ---------- 结算 payload 构造 ---------- */

export function makeAnswers(
  count: number,
  opts: {
    wrongAt?: readonly number[];
    timeoutAt?: readonly number[];
    timeLimitMs?: number;
  } = {},
): AnswerPayload[] {
  const wrong = new Set(opts.wrongAt ?? []);
  const timeout = new Set(opts.timeoutAt ?? []);
  return Array.from({ length: count }, (_, i) => {
    const timedOut = timeout.has(i);
    const ok = !timedOut && !wrong.has(i);
    return {
      question: { type: "note-choice", midi: 60 + i, clef: "treble" },
      ...(timedOut ? {} : { answer: { kind: "midi", midi: 60 + i, velocity: 80 } }),
      ok,
      responseMs: timedOut ? (opts.timeLimitMs ?? 5000) : 1000 + i * 10,
      timedOut,
    };
  });
}

export function makePayload(
  over: {
    techniqueId?: string;
    levelId?: string;
    params?: Partial<SessionParamsSnapshot>;
    result?: Partial<SessionResult>;
    answers?: AnswerPayload[];
  } = {},
): SettlementPayload {
  const answers = over.answers ?? makeAnswers(12, { wrongAt: [3] });
  const base: SettlementPayload = {
    techniqueId: "landmark-notes",
    levelId: "quick-answer-1",
    params: {
      questionType: "note-choice",
      questionCount: answers.length,
      minAccuracy: 0.9,
      maxMedianResponseMs: 3000,
      timeLimitMs: null,
    },
    result: {
      passed: true,
      correctCount: answers.filter((a) => a.ok).length,
      accuracy: answers.filter((a) => a.ok).length / answers.length,
      medianResponseMs: 1200,
    },
    answers,
  };
  return {
    ...base,
    ...(over.techniqueId !== undefined ? { techniqueId: over.techniqueId } : {}),
    ...(over.levelId !== undefined ? { levelId: over.levelId } : {}),
    params: { ...base.params, ...over.params },
    result: { ...base.result, ...over.result },
  };
}

/* ---------- HTTP 调用（直接调 route handler，走真实生产代码路径） ---------- */

export async function postSettlement(
  payload: SettlementPayload,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const { POST } = await import("@/app/api/sessions/route");
  const res = await POST(
    new Request("http://test/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body: asRecord(body) };
}

export async function postRaw(
  raw: string,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const { POST } = await import("@/app/api/sessions/route");
  const res = await POST(
    new Request("http://test/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
    }),
  );
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body: asRecord(body) };
}

export async function getCourseTreeHttp(): Promise<{
  status: number;
  body: Record<string, unknown> | null;
}> {
  const { GET } = await import("@/app/api/course-tree/route");
  const res = await GET();
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body: asRecord(body) };
}
