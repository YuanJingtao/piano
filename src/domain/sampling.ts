import type { Question } from "./types";

/** 错题在题池抽样中的权重倍数（ADR 0004：上一轮错题以 3× 权重被抽中）。 */
export const MISTAKE_WEIGHT = 3;

/**
 * 题目身份 key：稳定 JSON 序列化（键排序），用于不连出与错题池去重。
 * 同内容不同键序的题目视为同题。
 */
export function questionKey(q: Question): string {
  return stableStringify(q);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`);
  return `{${entries.join(",")}}`;
}

/**
 * 有放回随机抽题（ADR 0004）：
 *
 * - 候选题 = 题池全集；错题池中的题权重 ×MISTAKE_WEIGHT，其余 ×1。
 * - 不连出：优先从排除 lastKey 后的候选中抽；仅当排除后为空
 *   （题池只有 1 题，如地标 L1 仅中央 C）才允许与上一题相同。
 * - rng 返回 [0,1)，可注入以做确定性测试；默认 Math.random。
 */
export function drawQuestion(args: {
  pool: readonly Question[];
  mistakes?: readonly Question[];
  lastKey?: string;
  rng?: () => number;
}): Question {
  const { pool, mistakes = [], lastKey, rng = Math.random } = args;
  if (pool.length === 0) throw new Error("drawQuestion: empty pool");

  const mistakeKeys = new Set(mistakes.map(questionKey));
  let candidates = pool.map((q) => ({
    q,
    weight: mistakeKeys.has(questionKey(q)) ? MISTAKE_WEIGHT : 1,
  }));

  if (lastKey !== undefined) {
    const filtered = candidates.filter((c) => questionKey(c.q) !== lastKey);
    if (filtered.length > 0) candidates = filtered;
  }

  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll < 0) return c.q;
  }
  return candidates[candidates.length - 1].q;
}
