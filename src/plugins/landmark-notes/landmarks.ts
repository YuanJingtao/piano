import { midiToNoteName } from "@/lib/music/midi";

/**
 * 地标音系统领域数据（CONTEXT.md「地标音」）：五个锚点音——
 * 中央 C、高音 G、低音 F、高音 C、低音 C；高音 G 与低音 F 围绕中央 C 镜像对称。
 *
 * 单一真源：manifest 题池、judge 反馈、MDX 教程页、训练渲染（#38）全部从这里取数。
 * 五色沿用 #36 playground 已定口径（键盘图与谱例共用）。
 *
 * 纯 TypeScript，无 DOM / 浏览器 API 依赖（服务端渲染与 vitest 均可直接 import）。
 */

export type Clef = "treble" | "bass";

export type LandmarkId = "middle-c" | "treble-g" | "bass-f" | "treble-c" | "bass-c";

export type Landmark = {
  id: LandmarkId;
  /** 中文教学名（教程与行内反馈用）。 */
  name: string;
  /** 科学音高记名（C4 等），由 midi 派生。 */
  noteName: string;
  /** MIDI note number——音高唯一真源。 */
  midi: number;
  /** 可出现的谱表；中央 C 双谱表各成一题（高音谱下加一线 / 低音谱上加一线），其余固定。 */
  clefs: readonly Clef[];
  /** 教学高亮色（谱例着色 + 键盘图高亮共用）。 */
  color: string;
  /** 谱上位置描述（教程页地标音总表用）。 */
  staffPosition: string;
};

function landmark(
  id: LandmarkId,
  name: string,
  midi: number,
  clefs: readonly Clef[],
  color: string,
  staffPosition: string,
): Landmark {
  return { id, name, midi, clefs, color, staffPosition, noteName: midiToNoteName(midi) };
}

/** 五个地标音，按教学顺序：中央 C → 高音 G / 低音 F（镜像）→ 高音 C / 低音 C（外扩）。 */
export const LANDMARKS: readonly Landmark[] = [
  landmark("middle-c", "中央 C", 60, ["treble", "bass"], "#2563eb", "高音谱下加一线 / 低音谱上加一线"),
  landmark("treble-g", "高音 G", 67, ["treble"], "#d97706", "高音谱第二线（G 谱号卷曲环绕）"),
  landmark("bass-f", "低音 F", 53, ["bass"], "#059669", "低音谱第四线（F 谱号两点夹住）"),
  landmark("treble-c", "高音 C", 72, ["treble"], "#7c3aed", "高音谱第三间（中央 C 上方八度）"),
  landmark("bass-c", "低音 C", 48, ["bass"], "#dc2626", "低音谱第二间（中央 C 下方八度）"),
];

export const LANDMARK_BY_ID: ReadonlyMap<LandmarkId, Landmark> = new Map(
  LANDMARKS.map((l) => [l.id, l]),
);

/** 地标音五色表（id → color）；键盘图与谱例共用。 */
export const LANDMARK_COLORS: Readonly<Record<LandmarkId, string>> = Object.fromEntries(
  LANDMARKS.map((l) => [l.id, l.color]),
) as Record<LandmarkId, string>;

/** 按 MIDI 反查地标音（judge 反馈报名字用）；非地标音返回 undefined。 */
export function landmarkByMidi(midi: number): Landmark | undefined {
  return LANDMARKS.find((l) => l.midi === midi);
}
