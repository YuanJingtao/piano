"use client";

/**
 * 简谱数字对照组件（插件局部，工单 #44 AC2）：简谱 ↔ 五线谱 ↔ 唱名 三向对照表。
 * 每行一个功能音组——真实五线谱谱例（VexFlow）+ 唱名 + 简谱数字 + 音名 + 试听按钮，
 * 把中文学习者的简谱先验接到五线谱上（pedagogy D5「显性对照组件」落点）。
 * 仅教程页使用（训练题面的选项文本在插件 samplePool 内装配，不经此组件）。
 *
 * browser-only：与共享件同定式，模块 SSR 安全（VexFlow / Tone 仅在
 * effect / 事件处理器内触达）。
 */

import PlayMelodyButton from "@/plugins/direction-intervals/PlayMelodyButton";

import ScoreExample from "../../components/shared/ScoreExample";
import {
  ALL_GROUP_IDS,
  FUNCTIONAL_GROUPS,
  enumerateFigures,
  jianpuOf,
  noteNames,
  syllableName,
  type GroupId,
} from "./index";

export type JianpuMappingProps = {
  /** 展示的音组（默认三组全量，行序 = 教学序）。 */
  groups?: readonly GroupId[];
};

export default function JianpuMapping({ groups = ALL_GROUP_IDS }: JianpuMappingProps) {
  // 每组取「组名序」音型作对照行（do-mi-so 组即 do-mi-so 本型）。
  const rows = groups.map((groupId) => {
    const group = FUNCTIONAL_GROUPS[groupId];
    const figure = enumerateFigures([groupId])[0]!;
    return { group, figure };
  });

  return (
    <div className="not-prose my-6 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-300 text-left text-xs font-semibold text-neutral-500">
            <th className="px-2 py-2">五线谱</th>
            <th className="px-2 py-2">唱名</th>
            <th className="px-2 py-2">简谱</th>
            <th className="px-2 py-2">音名</th>
            <th className="px-2 py-2">听一听</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, figure }) => (
            <tr key={group.id} className="border-b border-neutral-200 align-middle">
              <td className="px-2 py-1">
                <ScoreExample
                  notes={figure.pitches.map((midi) => ({ midi, duration: "q" as const }))}
                  clef="treble"
                  timeSignature={null}
                  width={190}
                />
              </td>
              <td className="whitespace-nowrap px-2 py-1 font-medium text-neutral-800">
                {syllableName(figure.syllables)}
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {group.keyContext} · {group.label}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-1 text-lg font-semibold tabular-nums text-neutral-900">
                {jianpuOf(figure.syllables)}
              </td>
              <td className="whitespace-nowrap px-2 py-1 tabular-nums text-neutral-600">
                {noteNames(figure.pitches)}
              </td>
              <td className="px-2 py-1">
                <PlayMelodyButton midis={figure.pitches} label="▶" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
