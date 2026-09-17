import { Round } from "@/domain/round";
import type {
  AnswerEvent,
  LevelDef,
  Question,
  RoundResult,
  TechniquePlugin,
} from "@/domain/types";

/** 可控时钟：Round 的 now() 注入点，逐题推进以制造确定的 responseMs。 */
export class FakeClock {
  private t = 0;
  now = (): number => this.t;
  advance(ms: number): void {
    this.t += ms;
  }
}

/** 关卡工厂：默认快答口径（12 题 / ≥90% / 中位 ≤3s）。 */
export function makeLevel(overrides: Partial<LevelDef> & { pool: LevelDef["pool"] }): LevelDef {
  return {
    id: "L-test",
    title: "测试关卡",
    questionCount: 12,
    pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
    ...overrides,
  };
}

export function quickLevel(midis = [60, 61, 62, 63]): LevelDef {
  return makeLevel({ pool: { midis } });
}

export function playLevel(midis = [60, 61, 62, 63]): LevelDef {
  return makeLevel({
    id: "L-play",
    questionCount: 8,
    pass: { minAccuracy: 0.85 }, // 弹奏关卡无中位响应约束
    pool: { midis },
  });
}

export function timedLevel(midis = [60, 61, 62, 63]): LevelDef {
  return makeLevel({
    id: "L-timed",
    questionCount: 4,
    pass: { minAccuracy: 0.75 },
    timeLimitMs: 2000,
    pool: { midis },
  });
}

/** 桩插件：judge 由 choiceId === "correct" 决定，便于精确控制对错分布。 */
export function makeStubPlugin(levels: LevelDef[] = []): TechniquePlugin {
  return {
    manifest: {
      id: "stub",
      title: "测试桩",
      track: "main",
      prerequisites: [],
      levels,
    },
    samplePool(level) {
      const spec = level.pool as { midis: number[] };
      return spec.midis.map((midi, i) => ({ type: "stub", i, midi }));
    },
    render() {
      /* 纯逻辑 seam 不涉及 */
    },
    interact(): Promise<AnswerEvent> {
      return Promise.reject(new Error("stub: interact 不应在纯 TS 测试中被调用"));
    },
    judge(_q, a) {
      const ok = a.kind === "choice" && a.choiceId === "correct";
      return { ok, feedback: ok ? "✓" : "✗" };
    },
  };
}

export type Outcome = "ok" | "wrong" | "timeout";

/**
 * 驱动一整轮：next → 推进时钟 → submit/timeout，返回结算结果。
 * outcomes/responseMs 支持数组或按题号取值函数。
 */
export function playFullRound(
  round: Round,
  clock: FakeClock,
  outcomes: Outcome | Outcome[] | ((i: number) => Outcome) = "ok",
  responseMs: number | number[] | ((i: number) => number) = 100,
): RoundResult {
  const outcomeAt = toIndexFn(outcomes, "ok");
  const msAt = toIndexFn(responseMs, 100);
  let i = 0;
  for (let issued = round.next(); issued; issued = round.next()) {
    clock.advance(msAt(i));
    const outcome = outcomeAt(i);
    if (outcome === "timeout") {
      round.timeout();
    } else {
      round.submit({
        kind: "choice",
        choiceId: outcome === "ok" ? "correct" : "wrong",
        timestamp: clock.now(),
      });
    }
    i += 1;
  }
  return round.settle();
}

function toIndexFn<T>(v: T | T[] | ((i: number) => T), fallback: T): (i: number) => T {
  if (typeof v === "function") return v as (i: number) => T;
  if (Array.isArray(v)) return (i) => (i < v.length ? v[i] : fallback);
  return () => v;
}

/** 题目身份（测试断言用）：与引擎同口径的稳定 key。 */
export function keyOf(q: Question): string {
  return JSON.stringify(q, Object.keys(q).sort());
}

/** 轮次记录中相邻两题是否全部不同（不连出断言用）。 */
export function hasAdjacentDuplicates(records: RoundResult["records"]): boolean {
  return records.some((r, i) => i > 0 && keyOf(r.question) === keyOf(records[i - 1].question));
}
