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
 * 首调功能音组技巧插件（P4 首版唯一支线，工单 #44；pedagogy D1/D3/D5 + 考证①）。
 *
 * 以首调唱名读出的调内功能音组（CONTEXT.md 术语），首版三组 + 简谱数字对照
 * （1=do，中文用户的简谱先验迁移桥）：
 * - do-mi-so（1-3-5）：C 大调主三和弦，首调教学里「家」的和弦；
 * - la-so-mi（6-5-3）：Kodály 最早期基础音集（so-mi 小三度的扩展）；
 * - la-do-mi（6-1-3）：la-based minor 的 a 小调主三和弦（#4 决议：唯一 a 小调内容）。
 *
 * 三种题型：
 * - 「看谱选唱名」group-notation-quiz：谱面呈现三音组，选出对应的简谱数字串 +
 *   唱名（快答类；出题即发声，凭耳朵答也是预期行为，ADR 0005）；
 * - 「听音选谱面」group-ear-quiz：播放三音组，从四个谱面选项中选出听到的音组
 *   （与节奏插件 rhythm-ear-quiz 同构的听辨形态）；
 * - 「音组弹奏」group-play：看谱按顺序弹出三音组（弹奏类，AnswerEvent keys 变体、
 *   严格有序判定——#42 定形的多键作答口径，收集交互复用 ChordKeyboard）。
 *
 * 关卡（#4 决议 ⑥ 的引擎落地：「L4 附加键盘弹奏、L4 弹奏部分按弹奏类」在
 * 「一关一口径」约束下拆为 L4 混合识别（快答）+ L5 混合弹奏（弹奏）两关）：
 * L1–L3 逐组识别 → L4 三音组混合识别 → L5 三音组键盘弹奏。
 *
 * 首版调性口径（#4 决议 §4）：C 大调 / a 小调、无升降号——唱名到音高的映射
 * 固定（do=C），简谱数字与音高一一对应；移调（同手型换调）不入首版。
 *
 * 纯逻辑两件（samplePool / judge）在本文件（seam 2 单测覆盖）；
 * 浏览器两件落为 ./stage.tsx 的三个题面组件
 * （按题型注册于 src/components/training/question-stages.tsx，#38 定形）。
 */

/* ---------- 首调唱名与简谱 ---------- */

/** 首调唱名音节（CONTEXT.md「首调功能音组」；拼写统一用 so，非 sol）。 */
export type SolfegeSyllable = "do" | "re" | "mi" | "fa" | "so" | "la" | "ti";

/** 简谱数字：简谱 = 首调唱名的数字书写（1=do，pedagogy D5 迁移桥）。 */
export const SYLLABLE_DIGIT: Readonly<Record<SolfegeSyllable, number>> = {
  do: 1,
  re: 2,
  mi: 3,
  fa: 4,
  so: 5,
  la: 6,
  ti: 7,
};

/** 选项字母（choiceId 与 UI 展示同源；与节奏插件同款口径）。 */
export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

/* ---------- 三组功能音组 ---------- */

export type GroupId = "do-mi-so" | "la-so-mi" | "la-do-mi";

export type FunctionalGroup = {
  id: GroupId;
  /** 组名唱名序（la-so-mi → ["la","so","mi"]），也是该组的特征音型序。 */
  syllables: readonly [SolfegeSyllable, SolfegeSyllable, SolfegeSyllable];
  /** 本组内唱名 → 固定音高（首版 C 大调 / a 小调口径，MIDI note number 真源）。 */
  pitchOf: Readonly<Partial<Record<SolfegeSyllable, number>>>;
  /** 调性语境（教程与反馈文案）。 */
  keyContext: "C 大调" | "a 小调";
  /** 教学名（题面 / 反馈 / 教程），如「大三和弦『家』」。 */
  label: string;
};

/**
 * 三组功能音组的固定音高 placements：
 * - do-mi-so = C4-E4-G4（大调主三和弦原位，高音谱下加一线起）；
 * - la-so-mi = A4-G4-E4（C 大调里 do 上方的 la，Kodály 音集特征序为下行）；
 * - la-do-mi = A3-C4-E4（a 小调主音 la 在 do 下方——la-based minor 口径；
 *   A3 为高音谱下加二线，#40 已验证加线 ≤2 的可读范围）。
 * 同一唱名在两组里八度不同（la=A4 / A3）正是教学点：简谱与唱名记「音级功能」，
 * 不绑定具体八度（教程页第五节展开）。
 */
export const FUNCTIONAL_GROUPS: Readonly<Record<GroupId, FunctionalGroup>> = {
  "do-mi-so": {
    id: "do-mi-so",
    syllables: ["do", "mi", "so"],
    pitchOf: { do: 60, mi: 64, so: 67 },
    keyContext: "C 大调",
    label: "大三和弦「家」",
  },
  "la-so-mi": {
    id: "la-so-mi",
    syllables: ["la", "so", "mi"],
    pitchOf: { la: 69, so: 67, mi: 64 },
    keyContext: "C 大调",
    label: "Kodály 基础音集",
  },
  "la-do-mi": {
    id: "la-do-mi",
    syllables: ["la", "do", "mi"],
    pitchOf: { la: 57, do: 60, mi: 64 },
    keyContext: "a 小调",
    label: "小调主和弦",
  },
};

/** 三组的呈现 / 枚举顺序（教学序：大调「家」→ Kodály 音集 → 小调「家」）。 */
export const ALL_GROUP_IDS: readonly GroupId[] = ["do-mi-so", "la-so-mi", "la-do-mi"];

/* ---------- 音型（组内三唱名的排列） ---------- */

/**
 * 音型排列序：每组 6 个全排列，字典序枚举、组名序居首
 * （do-mi-so 组的第一个音型即 do-mi-so 本身）。确定性枚举，无随机——
 * 随机抽取是核心 Round 引擎的职责（ADR 0004）。
 */
export const FIGURE_ORDERS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/** 音型：某组三个唱名按某一排列构成的三音旋律组（读谱词汇的一个「词」）。 */
export type GroupFigure = {
  groupId: GroupId;
  syllables: readonly [SolfegeSyllable, SolfegeSyllable, SolfegeSyllable];
  /** 按音型顺序的音高（MIDI note number 唯一真源）。 */
  pitches: readonly [number, number, number];
};

/** 枚举音组列表的全部音型（组序 × 排列序，确定性枚举序 = 题池序）。 */
export function enumerateFigures(groupIds: readonly GroupId[]): GroupFigure[] {
  if (groupIds.length === 0) throw new Error("functional-groups: pool 音组列表不得为空");
  const figures: GroupFigure[] = [];
  for (const groupId of groupIds) {
    const group = FUNCTIONAL_GROUPS[groupId];
    for (const order of FIGURE_ORDERS) {
      const syllables = order.map((i) => {
        const syllable = group.syllables[i];
        if (!syllable) throw new Error(`functional-groups: 排列下标越界 ${String(order)}`);
        return syllable;
      }) as [SolfegeSyllable, SolfegeSyllable, SolfegeSyllable];
      const pitches = syllables.map((s) => {
        const midi = group.pitchOf[s];
        if (midi === undefined) {
          throw new Error(`functional-groups: 音组 ${groupId} 缺少唱名 ${s} 的音高`);
        }
        return midi;
      }) as [number, number, number];
      figures.push({ groupId, syllables, pitches });
    }
  }
  return figures;
}

/* ---------- 文案辅助 ---------- */

/** 唱名串：["do","mi","so"] → "do-mi-so"。 */
export function syllableName(syllables: readonly SolfegeSyllable[]): string {
  return syllables.join("-");
}

/** 简谱数字串：["do","mi","so"] → "1-3-5"。 */
export function jianpuOf(syllables: readonly SolfegeSyllable[]): string {
  return syllables.map((s) => SYLLABLE_DIGIT[s]).join("-");
}

/** 音型教学标签（选项与反馈同源）："1-3-5（do-mi-so）"。 */
export function figureLabel(syllables: readonly SolfegeSyllable[]): string {
  return `${jianpuOf(syllables)}（${syllableName(syllables)}）`;
}

/** 音名串（反馈文案），如 [60,64,67] → "C4-E4-G4"（与五指插件同口径）。 */
export function noteNames(midis: readonly number[]): string {
  return midis.map(midiToNoteName).join("-");
}

/* ---------- 题型 ---------- */

/** 题目：看谱选唱名。options 为「简谱数字串（唱名串）」文本（含正确项）。 */
export type GroupNotationQuizQuestion = Question & {
  type: "group-notation-quiz";
  /** 所属音组（错题特征聚合的 JSONB 特征，#45 消费）。 */
  groupId: GroupId;
  syllables: readonly SolfegeSyllable[];
  pitches: readonly number[];
  options: readonly string[];
  correctIndex: number;
};

/** 题目：听音选谱面。options 为四个候选音型的音高序列（含正确项）。 */
export type GroupEarQuizQuestion = Question & {
  type: "group-ear-quiz";
  groupId: GroupId;
  syllables: readonly SolfegeSyllable[];
  pitches: readonly number[];
  options: readonly (readonly number[])[];
  correctIndex: number;
};

/** 题目：音组弹奏（看谱按序弹三音），严格有序判定。 */
export type GroupPlayQuestion = Question & {
  type: "group-play";
  groupId: GroupId;
  syllables: readonly SolfegeSyllable[];
  pitches: readonly number[];
  /** 教学标签（反馈文案），如 "1-3-5（do-mi-so）"。 */
  label: string;
};

/** level.pool 的技巧自定义形状：识别关（两题型各半）或弹奏关，音组子集。 */
export type FunctionalGroupsPoolSpec =
  | { kind: "recognition"; groups: readonly GroupId[] }
  | { kind: "play"; groups: readonly GroupId[] };

/* ---------- manifest 与插件 ---------- */

/**
 * 快答关卡统一参数（ADR 0001）：12 题 / ≥90% / 中位 ≤3s；本技巧无限时模式（限时仅节奏关卡）。
 * answerMode: "choice"——识别关为选择·匹配作答（快答 × 选择题组合，#44 契约附加字段，
 * PracticeStage 文案与 MIDI 状态行消费）；L5 弹奏关省略 = 键盘作答。
 */
const QUICK_ANSWER = {
  questionCount: 12,
  pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
  answerMode: "choice",
} as const;

/** 弹奏关卡统一参数（ADR 0001）：8 题 / ≥85%。 */
const PLAY_LEVEL = {
  questionCount: 8,
  pass: { minAccuracy: 0.85 },
} as const;

export const functionalGroupsManifest: TechniqueManifest = {
  id: "functional-groups",
  title: "首调功能音组",
  track: "side",
  /** 首版唯一支线：地标音系统毕业后开放（#4 决议学习路径、CONTEXT.md「支线」）。 */
  prerequisites: ["landmark-notes"],
  levels: [
    {
      id: "L1",
      title: "do-mi-so（1-3-5）",
      ...QUICK_ANSWER,
      pool: { kind: "recognition", groups: ["do-mi-so"] } satisfies FunctionalGroupsPoolSpec,
    },
    {
      id: "L2",
      title: "la-so-mi（6-5-3）",
      ...QUICK_ANSWER,
      pool: { kind: "recognition", groups: ["la-so-mi"] } satisfies FunctionalGroupsPoolSpec,
    },
    {
      id: "L3",
      title: "la-do-mi（6-1-3 · a 小调）",
      ...QUICK_ANSWER,
      pool: { kind: "recognition", groups: ["la-do-mi"] } satisfies FunctionalGroupsPoolSpec,
    },
    {
      id: "L4",
      title: "三音组混合识别",
      ...QUICK_ANSWER,
      pool: { kind: "recognition", groups: ALL_GROUP_IDS } satisfies FunctionalGroupsPoolSpec,
    },
    {
      id: "L5",
      title: "三音组键盘弹奏",
      ...PLAY_LEVEL,
      pool: { kind: "play", groups: ALL_GROUP_IDS } satisfies FunctionalGroupsPoolSpec,
    },
  ],
};

/**
 * 确定性选项装配（与节奏插件同款算法）：干扰项 = 枚举序中正确项之后的三个
 * 音型（循环取），正确项位置 = 枚举序下标 mod 4。无随机——同一题跨轮次重出时
 * 对象完全一致（错题池按 questionKey 匹配的前提）。识别关每组 6 个音型、
 * 混合关 18 个，均 ≥4，干扰项恒合法；不足 4 视为 manifest 配置错误直接抛。
 */
function buildOptions<T>(
  space: readonly GroupFigure[],
  correctAt: number,
  toOption: (figure: GroupFigure) => T,
): { options: T[]; correctIndex: number } {
  if (space.length < 4) {
    throw new Error("functional-groups: 音型空间不足 4 个，无法装配选项");
  }
  const correct = space[correctAt] as GroupFigure;
  const correctIndex = correctAt % 4;
  const options: T[] = [];
  let offset = 1;
  for (let slot = 0; slot < 4; slot++) {
    if (slot === correctIndex) {
      options.push(toOption(correct));
    } else {
      options.push(toOption(space[(correctAt + offset) % space.length] as GroupFigure));
      offset++;
    }
  }
  return { options, correctIndex };
}

export const functionalGroupsPlugin: TechniquePlugin = {
  manifest: functionalGroupsManifest,

  samplePool(level: LevelDef): Question[] {
    const spec = level.pool as FunctionalGroupsPoolSpec;
    const figures = enumerateFigures(spec.groups);
    if (spec.kind === "play") {
      return figures.map(
        (figure) =>
          ({
            type: "group-play",
            groupId: figure.groupId,
            syllables: figure.syllables,
            pitches: figure.pitches,
            label: figureLabel(figure.syllables),
          }) satisfies GroupPlayQuestion,
      );
    }
    const questions: Question[] = [];
    figures.forEach((figure, i) => {
      const notation = buildOptions<string>(figures, i, (f) => figureLabel(f.syllables));
      questions.push({
        type: "group-notation-quiz",
        groupId: figure.groupId,
        syllables: figure.syllables,
        pitches: figure.pitches,
        options: notation.options,
        correctIndex: notation.correctIndex,
      } satisfies GroupNotationQuizQuestion);
      const ear = buildOptions<readonly number[]>(figures, i, (f) => f.pitches);
      questions.push({
        type: "group-ear-quiz",
        groupId: figure.groupId,
        syllables: figure.syllables,
        pitches: figure.pitches,
        options: ear.options,
        correctIndex: ear.correctIndex,
      } satisfies GroupEarQuizQuestion);
    });
    return questions;
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (q.type === "group-notation-quiz" || q.type === "group-ear-quiz") {
      const question = q as GroupNotationQuizQuestion | GroupEarQuizQuestion;
      if (a.kind !== "choice") return { ok: false, feedback: "✗ 非选项作答" };
      const correctLetter = OPTION_LETTERS[question.correctIndex];
      const correctText = figureLabel(question.syllables);
      if (a.choiceId === correctLetter) {
        return { ok: true, feedback: `✓ ${correctLetter}（${correctText}）` };
      }
      if (q.type === "group-notation-quiz") {
        const chosen = OPTION_LETTERS.findIndex((letter) => letter === a.choiceId);
        const chosenText = chosen >= 0 ? question.options[chosen] : undefined;
        return {
          ok: false,
          feedback: chosenText
            ? `✗ 你选「${chosenText}」，正确是「${correctText}」`
            : `✗ 正确是「${correctText}」`,
        };
      }
      return {
        ok: false,
        feedback: `✗ 你选了 ${a.choiceId}，正确是 ${correctLetter}（${correctText}）`,
      };
    }
    if (q.type === "group-play") {
      const question = q as GroupPlayQuestion;
      if (a.kind !== "keys") return { ok: false, feedback: "✗ 非多键作答" };
      if (sameOrder(a.midis, question.pitches)) {
        return {
          ok: true,
          feedback: `✓ ${noteNames(question.pitches)}（${question.label}）`,
        };
      }
      return {
        ok: false,
        feedback: `✗ 你弹了 ${noteNames(a.midis)}，正确是 ${noteNames(question.pitches)}（${question.label}）`,
      };
    }
    throw new Error(`functional-groups: unexpected question type "${q.type}"`);
  },
};

/** 序列相等（长度 + 逐位）：音组弹奏为严格有序判定（乐句有先后语义）。 */
function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((midi, i) => midi === b[i]);
}

export default functionalGroupsPlugin;
