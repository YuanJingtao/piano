import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  TechniqueManifest,
  TechniquePlugin,
} from "@/domain/types";
import { midiToNoteName } from "@/lib/music/midi";

/**
 * 五指位置与三和弦技巧插件（P3 主线末站，工单 #42）。
 *
 * 两种题型，全部弹奏类（多键作答，keys 变体）：
 * - 「键序列」key-sequence：按谱面顺序弹出一串音——五指位置内的级进片段
 *   （C/G 位置，pedagogy C4：谱上音符映射为固定指法图案）与同形分解和弦
 *   （根-三-五-三，pedagogy E2：琶音图案）；判定严格有序。
 * - 「柱式和弦」block-chord：三和弦整体多键同按（pedagogy E1：原位三和弦 =
 *   谱上"叠罗汉"，一眼识别和弦块）；判定按集合无序（同按无先后语义）。
 *
 * 声音（ADR 0005）：和弦题出题即发声播柱式和弦整体（playChord），
 * 序列题按序发声——都在题面组件（./stage.tsx）实现。
 * 多键同按的作答交互由插件局部 ChordKeyboard 承接（./ChordKeyboard.tsx），
 * 核心引擎零改动（AnswerEvent 仅附加 keys 变体，Round 对作答事件不透明）。
 *
 * 关卡按教学子步骤递进：C 位置级进 → G 位置级进（同手型平移）→
 * 原位三和弦柱式弹 → 同形分解和弦（同一组音拆开弹）。
 *
 * 纯逻辑两件（samplePool / judge）在本文件（seam 2 单测覆盖）；
 * 浏览器两件落为 ./stage.tsx 的两个题面组件
 * （按题型注册于 src/components/training/question-stages.tsx，#38 定形）。
 */

/* ---------- 五指位置 ---------- */

/** 首版两个五指位置：C 位置（拇指 C4）与 G 位置（拇指 G4），右手、高音谱。 */
export type FingerPositionId = "C" | "G";

export type FingerPosition = {
  /** 教学名（题面/反馈文案）。 */
  label: string;
  /** 位置内五个音（低 → 高），一指一键。 */
  scale: readonly number[];
};

export const FINGER_POSITIONS: Readonly<Record<FingerPositionId, FingerPosition>> = {
  C: { label: "C 位置", scale: [60, 62, 64, 65, 67] }, // C4 D4 E4 F4 G4
  G: { label: "G 位置", scale: [67, 69, 71, 72, 74] }, // G4 A4 B4 C5 D5
};

/** 级进片段长度：三音（一个手势的形状单位，教程页口径）。 */
export const FRAGMENT_LENGTH = 3;

/** 位置内全部三音级进片段（上行 3 + 下行 3，确定性枚举序）。 */
export function enumerateFragments(position: FingerPositionId): number[][] {
  const scale = FINGER_POSITIONS[position].scale;
  const fragments: number[][] = [];
  for (let start = 0; start + FRAGMENT_LENGTH <= scale.length; start++) {
    fragments.push(scale.slice(start, start + FRAGMENT_LENGTH));
  }
  for (const ascending of [...fragments]) {
    fragments.push([...ascending].reverse());
  }
  return fragments;
}

/* ---------- 顺阶三和弦 ---------- */

/** C 大调音阶（C4 起两个八度内，三和弦取材范围；内容口径 C 大调/a 小调）。 */
export const C_MAJOR_SCALE: readonly number[] = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76];

/** 音级字母名（三和弦教学名用，不带八度：如 "C 大三和弦"）。 */
const SCALE_LETTERS = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E"] as const;

export type Triad = {
  /** 原位三和弦（低 → 高）：根-三-五。 */
  midis: readonly [number, number, number];
  /** 大三 / 小三（三度叠置的音响色彩，教程页听辨口径）。 */
  quality: "major" | "minor";
  /** 教学名，如 "C 大三和弦"。 */
  label: string;
};

/**
 * C 大调顺阶原位三和弦（根音 C4–A4 共六个：C/Dm/Em/F/G/Am）。
 * 谱面即"叠罗汉"：线-线-线 或 间-间-间（pedagogy E1）。
 */
export function diatonicTriads(): Triad[] {
  const triads: Triad[] = [];
  for (let i = 0; i + 4 < C_MAJOR_SCALE.length; i++) {
    const midis = [C_MAJOR_SCALE[i], C_MAJOR_SCALE[i + 2], C_MAJOR_SCALE[i + 4]] as [
      number,
      number,
      number,
    ];
    const quality: Triad["quality"] = midis[1] - midis[0] === 4 ? "major" : "minor";
    triads.push({
      midis,
      quality,
      label: `${SCALE_LETTERS[i]} ${quality === "major" ? "大" : "小"}三和弦`,
    });
  }
  return triads;
}

/* ---------- 题型 ---------- */

/** 题目：键序列（级进片段 / 分解和弦），按弹奏顺序判定。 */
export type KeySequenceQuestion = Question & {
  type: "key-sequence";
  /** 目标键序列（低 → 高再回落等，按弹奏顺序）。 */
  midis: readonly number[];
  /** 教学标签（题面提示与反馈文案），如 "C 位置级进" / "C 大三和弦分解"。 */
  label: string;
};

/** 题目：柱式和弦（多键同按），按集合判定、无关于键顺序。 */
export type BlockChordQuestion = Question & {
  type: "block-chord";
  /** 原位三和弦（低 → 高）。 */
  midis: readonly number[];
  /** 和弦教学名（反馈文案），如 "C 大三和弦"。 */
  label: string;
};

/** level.pool 的技巧自定义形状。 */
export type FiveFingerPoolSpec =
  | { kind: "fragment"; position: FingerPositionId }
  | { kind: "block" }
  | { kind: "broken" };

/** 音名串（反馈文案），如 [60,64,67] → "C4-E4-G4"。 */
export function noteNames(midis: readonly number[]): string {
  return midis.map(midiToNoteName).join("-");
}

/* ---------- manifest 与插件 ---------- */

/** 弹奏关卡统一参数（ADR 0001）：8 题 / ≥85%；本技巧无快答与限时关卡。 */
const PLAY_LEVEL = {
  questionCount: 8,
  pass: { minAccuracy: 0.85 },
} as const;

export const fiveFingerTriadsManifest: TechniqueManifest = {
  id: "five-finger-triads",
  title: "五指位置与三和弦",
  track: "main",
  /** 主线线性解锁：节奏阅读毕业后开放（主线最后一站，设计文档 #31 学习路径）。 */
  prerequisites: ["rhythm-reading"],
  levels: [
    {
      id: "L1",
      title: "C 位置五指级进",
      ...PLAY_LEVEL,
      pool: { kind: "fragment", position: "C" } satisfies FiveFingerPoolSpec,
    },
    {
      id: "L2",
      title: "G 位置五指级进",
      ...PLAY_LEVEL,
      pool: { kind: "fragment", position: "G" } satisfies FiveFingerPoolSpec,
    },
    {
      id: "L3",
      title: "原位三和弦叠罗汉",
      ...PLAY_LEVEL,
      pool: { kind: "block" } satisfies FiveFingerPoolSpec,
    },
    {
      id: "L4",
      title: "同形分解和弦",
      ...PLAY_LEVEL,
      pool: { kind: "broken" } satisfies FiveFingerPoolSpec,
    },
  ],
};

export const fiveFingerTriadsPlugin: TechniquePlugin = {
  manifest: fiveFingerTriadsManifest,

  samplePool(level: LevelDef): Question[] {
    const spec = level.pool as FiveFingerPoolSpec;
    if (spec.kind === "fragment") {
      const position = FINGER_POSITIONS[spec.position];
      return enumerateFragments(spec.position).map(
        (midis) =>
          ({
            type: "key-sequence",
            midis,
            label: `${position.label}级进`,
          }) satisfies KeySequenceQuestion,
      );
    }
    const triads = diatonicTriads();
    if (spec.kind === "block") {
      return triads.map(
        (triad) =>
          ({
            type: "block-chord",
            midis: triad.midis,
            label: triad.label,
          }) satisfies BlockChordQuestion,
      );
    }
    // broken：同形分解和弦——根-三-五-三（do-mi-so-mi 波形，手型仍是 1-3-5-3）。
    return triads.map(
      (triad) =>
        ({
          type: "key-sequence",
          midis: [triad.midis[0], triad.midis[1], triad.midis[2], triad.midis[1]],
          label: `${triad.label}分解`,
        }) satisfies KeySequenceQuestion,
    );
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (a.kind !== "keys") return { ok: false, feedback: "✗ 非多键作答" };
    if (q.type === "block-chord") {
      const question = q as BlockChordQuestion;
      const target = [...question.midis].sort((x, y) => x - y);
      const played = [...a.midis].sort((x, y) => x - y);
      if (sameSequence(played, target)) {
        return { ok: true, feedback: `✓ ${question.label}（${noteNames(target)} 柱式和弦）` };
      }
      return {
        ok: false,
        feedback: `✗ 你弹了 ${noteNames(played)}，正确是 ${noteNames(target)}（${question.label}）`,
      };
    }
    if (q.type === "key-sequence") {
      const question = q as KeySequenceQuestion;
      if (sameSequence(a.midis, question.midis)) {
        return { ok: true, feedback: `✓ ${noteNames(question.midis)}（${question.label}）` };
      }
      return {
        ok: false,
        feedback: `✗ 你弹了 ${noteNames(a.midis)}，正确是 ${noteNames(question.midis)}（${question.label}）`,
      };
    }
    throw new Error(`five-finger-triads: unexpected question type "${q.type}"`);
  },
};

/** 序列相等（长度 + 逐位）；柱式和弦判定前双方已排序，即集合相等语义。 */
function sameSequence(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((midi, i) => midi === b[i]);
}

export default fiveFingerTriadsPlugin;
