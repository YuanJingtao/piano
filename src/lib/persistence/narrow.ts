/**
 * unknown → 具体类型的手工收窄工具。
 * 不引校验库：payload 形状小且稳定，手写收窄即可给出精确错误信息，
 * 同时让 DB 行（postgres.js 返回弱类型）到领域类型的映射保持类型安全。
 */

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function asInteger(v: unknown): number | null {
  const n = asNumber(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

export function asDate(v: unknown): Date | null {
  return v instanceof Date && !Number.isNaN(v.getTime()) ? v : null;
}

export function asRowList(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of v) {
    const rec = asRecord(item);
    if (rec) out.push(rec);
  }
  return out;
}
