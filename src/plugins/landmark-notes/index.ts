import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  TechniqueManifest,
  TechniquePlugin,
} from "@/domain/types";
import { midiToNoteName } from "@/lib/music/midi";

import { LANDMARK_BY_ID, landmarkByMidi, type Clef, type LandmarkId } from "./landmarks";

/**
 * 地标音系统技巧插件（P2 首个真实技巧，工单 #37）。
 *
 * 题型「看谱认音」：题目 = 五线谱上的一个地标音（含谱表），作答 = 在键盘上弹出该音。
 * 四个关卡全部为快答关卡（12 题 / 正确率 ≥90% / 中位响应 ≤3s，ADR 0001）；
 * 关卡按教学子步骤递进：中央 C → G/F 镜像 → 高低 C 外扩 → 五地标混合。
 *
 * 纯逻辑两件（samplePool / judge）为真实实现（seam 2 单测覆盖）；
 * 浏览器两件（render / interact）在 #38 训练闭环接入 PracticeStage 前调用即抛。
 */

/** 题目：谱面上的地标音。midi 为音高唯一真源，clef 决定呈现谱表。 */
export type LandmarkNoteQuestion = Question & {
  type: "landmark-note";
  midi: number;
  clef: Clef;
};

/** level.pool 的技巧自定义形状：地标音 id 列表（中央 C 按双谱表展开为两题）。 */
export type LandmarkPoolSpec = { landmarkIds: readonly LandmarkId[] };

/** 快答关卡统一参数（ADR 0001）：12 题 / ≥90% / 中位 ≤3s；地标音无限时模式（限时仅节奏关卡）。 */
const QUICK_ANSWER = {
  questionCount: 12,
  pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
} as const;

export const landmarkNotesManifest: TechniqueManifest = {
  id: "landmark-notes",
  title: "地标音系统",
  track: "main",
  /**
   * 主线首个落地技巧：暂以无前置起步（P2 端到端可用的前提）。
   * 键盘地理（#39）落地后按主线教学顺序（键盘地理 → 地标音）改回
   * prerequisites: ["keyboard-geography"]——进度派生已兼容该调整
   * （已通过关卡永远可复习，deriveCourseTree）。
   */
  prerequisites: [],
  levels: [
    {
      id: "L1",
      title: "中央 C",
      ...QUICK_ANSWER,
      pool: { landmarkIds: ["middle-c"] } satisfies LandmarkPoolSpec,
    },
    {
      id: "L2",
      title: "高音 G / 低音 F 镜像",
      ...QUICK_ANSWER,
      pool: { landmarkIds: ["middle-c", "treble-g", "bass-f"] } satisfies LandmarkPoolSpec,
    },
    {
      id: "L3",
      title: "高音 C / 低音 C 外扩",
      ...QUICK_ANSWER,
      pool: { landmarkIds: ["middle-c", "treble-c", "bass-c"] } satisfies LandmarkPoolSpec,
    },
    {
      id: "L4",
      title: "五地标混合快答",
      ...QUICK_ANSWER,
      pool: {
        landmarkIds: ["middle-c", "treble-g", "bass-f", "treble-c", "bass-c"],
      } satisfies LandmarkPoolSpec,
    },
  ],
};

/** 行内反馈的音名口径：地标音报教学名 + 音名（中央 C（C4）），其余仅音名。 */
function describePitch(midi: number): string {
  const landmark = landmarkByMidi(midi);
  return landmark ? `${landmark.name}（${landmark.noteName}）` : midiToNoteName(midi);
}

export const landmarkNotesPlugin: TechniquePlugin = {
  manifest: landmarkNotesManifest,

  samplePool(level: LevelDef): Question[] {
    const spec = level.pool as LandmarkPoolSpec;
    const questions: LandmarkNoteQuestion[] = [];
    for (const id of spec.landmarkIds) {
      const landmark = LANDMARK_BY_ID.get(id);
      if (!landmark) throw new Error(`landmark-notes: pool 引用未知地标音 "${id}"`);
      for (const clef of landmark.clefs) {
        questions.push({ type: "landmark-note", midi: landmark.midi, clef });
      }
    }
    return questions;
  },

  render(): void {
    throw new Error("landmark-notes: render 属浏览器层，#38 训练闭环接入 PracticeStage");
  },

  interact(): Promise<AnswerEvent> {
    return Promise.reject(
      new Error("landmark-notes: interact 属浏览器层，#38 训练闭环接入 PracticeStage"),
    );
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (q.type !== "landmark-note") {
      throw new Error(`landmark-notes: unexpected question type "${q.type}"`);
    }
    const question = q as LandmarkNoteQuestion;
    if (a.kind !== "midi") return { ok: false, feedback: "✗ 非琴键作答" };
    if (a.midi === question.midi) {
      return { ok: true, feedback: `✓ ${describePitch(question.midi)}` };
    }
    return {
      ok: false,
      feedback: `✗ 你弹了 ${describePitch(a.midi)}，正确是 ${describePitch(question.midi)}`,
    };
  },
};

export default landmarkNotesPlugin;
