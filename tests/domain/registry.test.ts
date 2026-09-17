import { beforeEach, describe, expect, it } from "vitest";
import {
  __clearRegistryForTests,
  getTechnique,
  listTechniques,
  registerTechnique,
} from "@/domain/registry";
import type { TechniquePlugin } from "@/domain/types";

function fakePlugin(id: string): TechniquePlugin {
  return {
    manifest: { id, title: `fake-${id}`, track: "main", prerequisites: [], levels: [] },
    samplePool: () => [{ type: "fake" }],
    render: () => {},
    interact: () => Promise.reject(new Error("fake")),
    judge: () => ({ ok: true, feedback: "✓" }),
  };
}

describe("静态注册表", () => {
  beforeEach(() => {
    __clearRegistryForTests();
  });

  it("注册后按 manifest id 取回同一插件", () => {
    const plugin = fakePlugin("t1");
    registerTechnique(plugin);
    expect(getTechnique("t1")).toBe(plugin);
  });

  it("listTechniques 枚举全部已注册技巧", () => {
    registerTechnique(fakePlugin("t1"));
    registerTechnique(fakePlugin("t2"));
    expect(listTechniques().map((p) => p.manifest.id).sort()).toEqual(["t1", "t2"]);
  });

  it("重复 id 注册抛错", () => {
    registerTechnique(fakePlugin("dup"));
    expect(() => registerTechnique(fakePlugin("dup"))).toThrow(/duplicate technique id/);
  });

  it("未注册 id 取用抛错", () => {
    expect(() => getTechnique("nope")).toThrow(/unknown technique/);
  });

  it("listTechniques 返回只读视图：外部改动不影响注册表", () => {
    registerTechnique(fakePlugin("t1"));
    const list = listTechniques() as TechniquePlugin[];
    list.pop();
    expect(listTechniques()).toHaveLength(1);
  });
});
