import type {
  AnswerEvent,
  Judgement,
  LevelDef,
  Question,
  TechniqueManifest,
  TechniquePlugin,
} from "@/domain/types";

/**
 * 内存示例插件（#34 验收用）：看谱回声——出示一个音，用琴键弹回同一音。
 *
 * 存在的意义是示范插件契约与注册表加载链路：
 * - 纯逻辑两件（samplePool / judge）为真实实现，可被单测；
 * - 浏览器两件（render / interact）不属于 seam 1，调用即抛，防止误用。
 *
 * 真实技巧插件（#37 起）按同样形状落在 src/plugins/<id>/ 并在注册表加一行。
 */

type NoteQuestion = Question & { type: "note"; midi: number };

function note(midi: number): NoteQuestion {
  return { type: "note", midi };
}

/** level.pool 的技巧自定义形状：本插件 = 候选 MIDI 音高列表。 */
type NotePoolSpec = { midis: number[] };

export const exampleManifest: TechniqueManifest = {
  id: "example",
  title: "示例技巧：看谱回声",
  track: "main",
  prerequisites: [],
  levels: [
    {
      id: "L1",
      title: "三音快答",
      questionCount: 12,
      pass: { minAccuracy: 0.9, maxMedianResponseMs: 3000 },
      // 小题池示范：仅 do-mi-so 三音，验证不连出在小题池下的行为
      pool: { midis: [60, 64, 67] } satisfies NotePoolSpec,
    },
    {
      id: "L2",
      title: "五音弹奏",
      questionCount: 8,
      pass: { minAccuracy: 0.85 },
      pool: { midis: [60, 62, 64, 65, 67] } satisfies NotePoolSpec,
    },
  ],
};

export const examplePlugin: TechniquePlugin = {
  manifest: exampleManifest,

  samplePool(level: LevelDef): Question[] {
    const spec = level.pool as NotePoolSpec;
    return spec.midis.map(note);
  },

  render(): void {
    throw new Error("example plugin: render 属浏览器层，纯 TS seam 不覆盖");
  },

  interact(): Promise<AnswerEvent> {
    return Promise.reject(
      new Error("example plugin: interact 属浏览器层，纯 TS seam 不覆盖"),
    );
  },

  judge(q: Question, a: AnswerEvent): Judgement {
    if (q.type !== "note") throw new Error(`example plugin: unexpected question type "${q.type}"`);
    if (a.kind !== "midi") return { ok: false, feedback: "✗ 非琴键作答" };
    const ok = a.midi === (q as NoteQuestion).midi;
    return { ok, feedback: ok ? `✓ ${a.midi}` : `✗ 你弹了 ${a.midi}，正确是 ${q.midi}` };
  },
};

export default examplePlugin;
