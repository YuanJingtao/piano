import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  TechniqueManifest,
  TechniquePlugin,
} from "@/domain/types";

/**
 * 节奏阅读基础技巧插件（P3，工单 #41，ADR 0001/0003）。
 *
 * 两种题型（每关卡题池各半，全部为选择·匹配题，不做时序判分）：
 * - 「看谱选音节」rhythm-syllable-quiz：呈现一小节 4/4 谱面，选出对应 Kodály 音节串；
 * - 「听节奏选谱面」rhythm-ear-quiz：播放节奏点击声（示范 bpm 60），选出对应谱面。
 *
 * 内容范围（设计文档 #31）：仅 4/4 拍、时值到八分音符——节奏单位四个：
 * 全音符 w（4 拍）/ 二分音符 h（2 拍）/ 四分音符 q（1 拍）/ 八分音符对 tt（两个
 * 八分音符合 1 拍，成对出现、谱面符杠相连）。Kodály 音节：ta-a-a-a / ta-a / ta / ti-ti。
 *
 * 关卡按节奏词汇递进：L1 长时值（w/h/q）→ L2 细分入门（q/tt）→ L3 全词汇混合。
 * 每关卡声明 timeLimitMs（限时模式为用户可选开关，ADR 0003；开关与超时口径在
 * PracticeStage + 核心 Round 引擎，插件不含流程逻辑）。通过口径仅正确率——
 * 节奏关非快答关卡，不设中位响应上限（否则等同强制限时，违背 ADR 0003 可选语义）。
 *
 * 纯逻辑两件（samplePool / judge）在本文件（seam 2 单测覆盖）；
 * 浏览器两件（谱面/选项渲染 + 点击声示范）落为 ./stage.tsx 的两个题面组件
 * （按题型注册于 src/components/training/question-stages.tsx）。
 */

/** 节奏单位：全/二分/四分音符与八分音符对（首版时值到八分，且八分恒成对）。 */
export type RhythmUnit = "w" | "h" | "q" | "tt";

/** 单位时值（拍）。tt = 两个八分音符 = 1 拍。 */
export const UNIT_BEATS: Readonly<Record<RhythmUnit, number>> = { w: 4, h: 2, q: 1, tt: 1 };

/** 单位 → Kodály 音节（ADR 0001：ta / ti-ti 体系；全/二分延长音节按惯例拼写）。 */
export const UNIT_SYLLABLE: Readonly<Record<RhythmUnit, string>> = {
  w: "ta-a-a-a",
  h: "ta-a",
  q: "ta",
  tt: "ti-ti",
};

/** 节奏示范速度（bpm）：1 拍 1 秒，与教程页「一拍一秒」的讲解口径一致。 */
export const RHYTHM_DEMO_BPM = 60;

/** 谱面呈现音高：节奏题只考时值，音符统一画在 B4（高音谱表中线，无加线）。 */
export const RHYTHM_NOTATION_MIDI = 71;

/** 选项字母（choiceId 与 UI 展示同源）。 */
export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

/** 节奏型：一小节内的节奏单位序列（总拍数 = 4 由枚举保证）。 */
export type RhythmPattern = readonly RhythmUnit[];

/** 题目：看谱选音节。options 为音节串（含正确项），correctIndex 为正确项下标。 */
export type RhythmSyllableQuizQuestion = Question & {
  type: "rhythm-syllable-quiz";
  pattern: RhythmPattern;
  options: readonly string[];
  correctIndex: number;
};

/** 题目：听节奏选谱面。options 为四个候选节奏型（含正确项）。 */
export type RhythmEarQuizQuestion = Question & {
  type: "rhythm-ear-quiz";
  pattern: RhythmPattern;
  options: readonly RhythmPattern[];
  correctIndex: number;
};

/** level.pool 的技巧自定义形状：本关允许的节奏单位词汇表。 */
export type RhythmPoolSpec = { units: readonly RhythmUnit[] };

/** 每拍音节串：如 [q, tt, q, q] → "ta ti-ti ta ta"。 */
export function patternSyllables(pattern: RhythmPattern): string {
  return pattern.map((u) => UNIT_SYLLABLE[u]).join(" ");
}

/** 节奏型总拍数。 */
export function patternBeats(pattern: RhythmPattern): number {
  return pattern.reduce((sum, u) => sum + UNIT_BEATS[u], 0);
}

/**
 * 节奏型 → 逐音符时值序列（拍）：tt 展开为两个八分音符 [0.5, 0.5]，
 * 其余单位即自身拍数。供 beatsToClickOffsets（点击声示范）与谱面渲染消费。
 */
export function patternToBeats(pattern: RhythmPattern): number[] {
  return pattern.flatMap((u) => (u === "tt" ? [0.5, 0.5] : [UNIT_BEATS[u]]));
}

/**
 * 枚举全部 4/4 小节节奏型（题池采样空间的生成器）：
 * 从单位词汇表出发做确定性深度优先枚举，总拍数恰好 4 的序列全部入选，
 * 枚举序即题池序（samplePool 无随机——随机抽取是核心 Round 引擎的职责）。
 */
export function enumerateMeasures(units: readonly RhythmUnit[]): RhythmPattern[] {
  if (units.length === 0) throw new Error("rhythm-reading: pool 单位词汇表不得为空");
  const measures: RhythmPattern[] = [];
  const walk = (acc: RhythmUnit[], remaining: number): void => {
    if (remaining === 0) {
      measures.push([...acc]);
      return;
    }
    for (const unit of units) {
      const beats = UNIT_BEATS[unit];
      if (beats <= remaining) walk([...acc, unit], remaining - beats);
    }
  };
  walk([], 4);
  return measures;
}

/** 统一节奏关参数：10 题 / 正确率 ≥80%（选择·匹配题口径，见文件头注释）。 */
const RHYTHM_LEVEL = {
  questionCount: 10,
  pass: { minAccuracy: 0.8 },
} as const;

export const rhythmReadingManifest: TechniqueManifest = {
  id: "rhythm-reading",
  title: "节奏阅读基础",
  track: "main",
  /** 主线顺序为 … → 方向与音程阅读（#40）→ 节奏阅读基础（CONTEXT.md 主线）。 */
  prerequisites: ["direction-intervals"],
  levels: [
    {
      id: "L1",
      title: "全·二分·四分音符",
      ...RHYTHM_LEVEL,
      timeLimitMs: 8000,
      pool: { units: ["w", "h", "q"] } satisfies RhythmPoolSpec,
    },
    {
      id: "L2",
      title: "ti-ti 八分音符对",
      ...RHYTHM_LEVEL,
      timeLimitMs: 8000,
      pool: { units: ["q", "tt"] } satisfies RhythmPoolSpec,
    },
    {
      id: "L3",
      title: "混合时值阅读",
      ...RHYTHM_LEVEL,
      timeLimitMs: 10000,
      pool: { units: ["w", "h", "q", "tt"] } satisfies RhythmPoolSpec,
    },
  ],
};

/**
 * 确定性选项装配：干扰项 = 枚举序中正确项之后的三个节奏型（循环取），
 * 正确项位置 = 枚举序下标 mod 4。无随机——同一题跨轮次重出时对象完全一致
 * （错题池按 questionKey 匹配的前提）。词汇表 < 4 个节奏型时无合法干扰项，视为
 * manifest 配置错误直接抛。
 */
function buildOptions<T>(
  space: readonly RhythmPattern[],
  correctAt: number,
  toOption: (pattern: RhythmPattern) => T,
): { options: T[]; correctIndex: number } {
  if (space.length < 4) {
    throw new Error("rhythm-reading: 节奏型空间不足 4 个，无法装配选项");
  }
  const correct = space[correctAt] as RhythmPattern;
  const correctIndex = correctAt % 4;
  const options: T[] = [];
  let offset = 1;
  for (let slot = 0; slot < 4; slot++) {
    if (slot === correctIndex) {
      options.push(toOption(correct));
    } else {
      options.push(toOption(space[(correctAt + offset) % space.length] as RhythmPattern));
      offset++;
    }
  }
  return { options, correctIndex };
}

export const rhythmReadingPlugin: TechniquePlugin = {
  manifest: rhythmReadingManifest,

  samplePool(level: LevelDef): Question[] {
    const spec = level.pool as RhythmPoolSpec;
    const patterns = enumerateMeasures(spec.units);
    const questions: Question[] = [];
    patterns.forEach((pattern, i) => {
      const syllable = buildOptions<string>(patterns, i, patternSyllables);
      questions.push({
        type: "rhythm-syllable-quiz",
        pattern,
        options: syllable.options,
        correctIndex: syllable.correctIndex,
      } satisfies RhythmSyllableQuizQuestion);
      const ear = buildOptions<RhythmPattern>(patterns, i, (p) => p);
      questions.push({
        type: "rhythm-ear-quiz",
        pattern,
        options: ear.options,
        correctIndex: ear.correctIndex,
      } satisfies RhythmEarQuizQuestion);
    });
    return questions;
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (a.kind !== "choice") return { ok: false, feedback: "✗ 非选项作答" };
    if (q.type === "rhythm-syllable-quiz") {
      const question = q as RhythmSyllableQuizQuestion;
      const correctText = question.options[question.correctIndex] ?? patternSyllables(question.pattern);
      if (a.choiceId === OPTION_LETTERS[question.correctIndex]) {
        return { ok: true, feedback: `✓ ${correctText}` };
      }
      const chosen = OPTION_LETTERS.findIndex((letter) => letter === a.choiceId);
      const chosenText = chosen >= 0 ? question.options[chosen] : undefined;
      return {
        ok: false,
        feedback: chosenText
          ? `✗ 你选「${chosenText}」，正确是「${correctText}」`
          : `✗ 正确是「${correctText}」`,
      };
    }
    if (q.type === "rhythm-ear-quiz") {
      const question = q as RhythmEarQuizQuestion;
      const correctLetter = OPTION_LETTERS[question.correctIndex];
      const correctSyllables = patternSyllables(question.pattern);
      if (a.choiceId === correctLetter) {
        return { ok: true, feedback: `✓ ${correctLetter}（${correctSyllables}）` };
      }
      return {
        ok: false,
        feedback: `✗ 你选了 ${a.choiceId}，正确是 ${correctLetter}（${correctSyllables}）`,
      };
    }
    throw new Error(`rhythm-reading: unexpected question type "${q.type}"`);
  },
};

export default rhythmReadingPlugin;
