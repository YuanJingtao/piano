# 五线谱渲染 / 音频 / Web MIDI 技术选型调研报告

- **对应工单**：GitHub issue #3「五线谱渲染/音频/MIDI 技术选型调研」（属于地图 #1）
- **服务对象**：「教学页+训练流程粗原型」#5、「后端领域模型与技巧插件化架构」#6
- **调研日期**：2026-09-16
- **数据来源**：GitHub REST API（仓库元数据/release）、npm registry & api.npmjs.org（版本/下载量/license/types 字段）、各库官方文档（vexflow.com、opensheetmusicdisplay.org、alphatab.net、tonejs.github.io、webmidijs.org）、MDN、Apple Safari 26 Release Notes。所有数字为调研当日抓取。

## TL;DR 推荐摘要

| 类别 | 首选 | 备选 | 一句话理由 |
|---|---|---|---|
| 五线谱渲染 | **VexFlow 5** | OpenSheetMusicDisplay（OSMD） | MIT、TS 原生、可完全程序化生成谱面、SVG 输出便于逐音符高亮/着色，最贴合「动态出题+技巧标注」 |
| 音频发声 | **Tone.js 15（Sampler）** | 原生 Web Audio API | MIT、TS 原生、极活跃（17.4 万周下载）；Sampler 只需少量钢琴采样即可覆盖全键盘，自动处理 AudioContext 手势解锁 |
| Web MIDI | **自写轻量 hook（原生 `navigator.requestMIDIAccess`）** | WEBMIDI.js（npm `webmidi`） | 原生 API 表面极小、零依赖；Safari/iOS 完全不支持且无可靠 polyfill，必须内建「屏幕虚拟钢琴」降级，MIDI 只是桌面 Chrome/Edge/Firefox 的增强路径 |

三者全部是 browser-only 库：Next.js App Router 下必须放进 `'use client'` 组件，并用 `next/dynamic`（`ssr: false`）或 `useEffect` 内初始化，避免 SSR/hydration 报错（见 §4）。

---

## 1. 五线谱渲染

### 1.1 候选对比

| 维度 | VexFlow 5 | OpenSheetMusicDisplay 2.x | alphaTab 1.8.x |
|---|---|---|---|
| 定位 | 低层记谱渲染 API，输出 Canvas/SVG | MusicXML → 谱面 的高层封装，**底层就是 VexFlow** | 谱面/吉他谱渲染 + **内置播放**（SVG + WASM + AudioWorklet） |
| 仓库 | `vexflow/vexflow`（2024/25 年由 `0xfe/vexflow` 迁移而来；旧仓库 ~4,378 star 停在 4.x，新组织仓库 235 star 为迁移所致） | `opensheetmusicdisplay/opensheetmusicdisplay`，1,962 star | `CoderLine/alphaTab`，1,835 star |
| License | **MIT**（GitHub API 显示 NOASSERTION，LICENSE 文件为 MIT 原文；npm 页面标注 MIT） | **BSD-3-Clause** | **MPL-2.0**（文件级 copyleft：可闭源商用，但修改其源文件需开源该文件） |
| 最新版 / 发布节奏 | 5.0.0（npm 2025-03-05，GitHub Release 同日）；仓库最后 push 2026-08-06。节奏偏慢（~1.5 年一个 major），但仍活跃 | 2.1.2（2026-08-06），2.1.1（2026-07-29）、2.1.0（2026-07-22），push 2026-09-11。**非常活跃** | 1.8.4（2026-07-05），1.8.3（2026-05）、1.8.2（2026-04），1.9.0-alpha 持续滚动，push 2026-09-10。**非常活跃** |
| npm 包 / 周下载 | `vexflow` 5.0.0，**36,872/周**（npm 页面显示 29,062） | `opensheetmusicdisplay` 2.1.2，**21,798/周** | `@coderline/alphatab` 1.8.4，**5,326/周**，解包体积 **13.7 MB**（含 WASM 渲染器与默认 SoundFont） |
| TypeScript | **TS 编写**，自带类型（`build/types/entry/vexflow.d.ts`）；5.0 主要变化为全面 camelCase 化 + 移除废弃 API | TS 编写，自带类型（`build/dist/src/index.d.ts`） | TS 编写，自带类型（`dist/alphaTab.d.ts`） |
| 程序化生成谱面（动态出题） | **最直接**：EasyScore/Factory 高层 API + 原生 StaveNote/Formatter 低层 API，从音符数据一步构建；支持 Canvas 与 SVG 双输出 | 需先生成 **MusicXML**（字符串模板或拼 XML）再 `osmd.load(xml)`；单音符/单小节练习题的 XML 模板完全可控 | 输入 MusicXML / MIDI / Guitar Pro / alphaTex（自有文本格式），程序化生成也可行 |
| 谱面标注（高亮/着色/标记） | `Annotation` 类（文字标注，可定位对齐）、`StaveLine`（连线，官方文档明确"可为教学目的加箭头/颜色"）、note 的 `setStyle`/颜色属性；SVG 输出可给音符加 class 做 CSS 高亮（有 VexFlow 5 + React 的公开实践文章） | **数据模型可改音符颜色**（官方 README 明确列出）；`Cursor` 支持 4 种高亮类型 + 自定义颜色/透明度；`GNotesUnderCursor()` 可拿到 GraphicalNote 的 SVGNode 直接操作；支持 `SelectionStart/End` 只显示指定小节 | 有播放光标/高亮 API（配合内置 player）；着色能力存在但更偏向"跟随播放"而非"逐音符教学标注" |
| 播放能力 | 无 | 开发中（官方 README：早期版本仅对 GitHub sponsor 开放） | **内置 AlphaSynth**（SoundFont2/3，AudioWorklet 合成） |
| Next.js 集成 | `'use client'`；依赖 DOM（Canvas/SVG），用 `next/dynamic ssr:false` 或 `useEffect` 内初始化。也支持 Node.js headless 渲染（可用于服务端生成谱面图片，若日后需要） | 同 VexFlow（其依赖 VexFlow 渲染），社区通用做法为 useEffect 内 `new OpenSheetMusicDisplay(container)` + `load` + `render` | **风险最大**：库会派生 WebWorker + AudioWorklet，对 bundler 敏感，官方提供 `@coderline/alphatab-webpack` / `-vite` 插件；**无官方 React 控件**，需自己用 ref 做 DOM 挂载。维护者在 discussion #2420（2025-12）明确：**Next.js 16 默认 Turbopack 会导致 alphaTab 崩溃，必须强制使用 webpack + 官方插件**（Turbopack 无插件系统、不支持 AudioWorklet 打包） |

### 1.2 结论：首选 + 备选 + 切换触发条件

- **首选：VexFlow 5**。理由：MIT 无传染；TS 原生；是唯一能"从音符数据结构直接程序化绘制"的选项（EasyScore 几行代码出一小节，动态出题零中间格式）；SVG 输出 + Annotation/StaveLine/样式 API 完整覆盖「高亮音符、着色、标记」需求；生态验证充分（周下载最高，OSMD 也构建在其上，说明其渲染核心被下游长期依赖）。
- **备选：OpenSheetMusicDisplay**。定位差异：OSMD 解决的是"整曲 MusicXML 展示 + 播放光标"，维护极活跃（2026 年 7/8 月连发三版）。因为底层同为 VexFlow，两者知识可迁移、甚至可共存（教学页用 VexFlow 精细控制，曲库页用 OSMD）。
- **alphaTab 暂不推荐**用于本项目：MPL-2.0 文件级 copyleft + 13.7MB 体积 + 无官方 React 集成 + **与 Next.js 16 默认 Turbopack 冲突**（需锁 webpack），而其最大卖点（内置 Score 播放、吉他谱）与「钢琴识谱训练」需求错位。
- **切换触发条件**：
  1. 需求转向「导入完整曲库（MusicXML 文件）、多行谱自动排版、跟谱光标」→ 引入 OSMD（可增量引入，不必放弃 VexFlow）；
  2. 「听谱/跟弹播放」成为核心功能且不想自己拼 Tone.js 播放 → 重估 alphaTab，前提接受强制 webpack（放弃 Turbopack）与 MPL-2.0；
  3. VexFlow 维护停滞（如 >18 个月无 release 且 issue 无响应）→ 迁移 OSMD（渲染底层仍是 VexFlow 4.x 分支，迁移成本主要是构建谱面的代码层）；
  4. VexFlow 多行/多系统自动排版不够用（VexFlow 需要手动管理 system/换行，长谱面排版要自己写或用 EasyScore 的有限自动排版）且不想引 OSMD → 评估 `vexflow` 之上的排版辅助库或自写 formatter。

---

## 2. 音频发声

### 2.1 候选对比

| 维度 | Tone.js 15 | 原生 Web Audio API |
|---|---|---|
| 仓库/热度 | `Tonejs/Tone.js`，14,721 star，MIT，push **2026-09-16（当天）** | 浏览器内建，无依赖 |
| 版本/下载 | 15.1.22（2026-07-12），**174,069/周**（三个候选库中最高） | — |
| TypeScript | TS 原生编写，类型完善 | 自带 DOM lib 类型 |
| 钢琴音色 | `Tone.Sampler`：加载钢琴采样并**自动变调补齐缺失音高**（官方示例：只需采几个音即可覆盖全键盘，"节省加载时间"）；官方还有 `@tonejs/piano`（MIT，Salamander Grand Piano 采样封装，0.2.1/2020，久未更新——建议只用其采样思路，自己配 Sampler） | 需自己实现：`AudioBufferSourceNode` + 采样加载 + ADSR 包络 + 多音复音管理 |
| 采样体积 | 取决于采样包：Salamander 全量多力度层数十 MB；**训练场景单力度层 + 8 个左右采样音 + mp3/ogg**，实测常见做法约几 MB，可懒加载 | 同左（采样是内容问题，不是库问题） |
| 低延迟 | 与原生同为 AudioContext 采样级调度；提供 `Tone.now()`/Transport 精确调度；触发即时发音走 `triggerAttack`，延迟主要来自采样解码（可预加载） | 理论最优、控制最细，但正确性全靠自己（必须基于 `currentTime` 调度，勿用 `setTimeout`） |
| 手势解锁 | `Tone.start()` 一行封装"用户手势中 resume AudioContext"（MDN 最佳实践：非手势中创建的 AudioContext 处于 suspended，必须在 click 等手势中 `resume()`；Tone.js issue #341 即此问题的典型报错） | 需自己写 `ctx.state === 'suspended' && ctx.resume()` 并保证在首次用户交互里调用 |
| Next.js 集成 | `'use client'` + 动态导入/`useEffect` 内初始化（库在 import 时可能触碰 window/AudioContext） | 同样需客户端 only，但 API 是浏览器内建，SSR 只需避免在模块顶层 new AudioContext |

### 2.2 结论：首选 + 备选 + 切换触发条件

- **首选：Tone.js（Sampler + 自备钢琴采样子集）**。理由：MIT、TS 原生、维护极活跃、下载量碾压级；Sampler 的"少量采样自动变调"特性把钢琴音色成本压到几 MB；`Tone.start()` 顺手解决 AudioContext 手势解锁这一最常见坑；后续若加节拍器、示范演奏（Transport 调度）都是现成能力。
- **备选：原生 Web Audio API**。本项目音频需求其实很薄（点击/弹键即发一个钢琴音），用 `AudioBufferSourceNode` 播预解码采样 ~100 行内可完成，零依赖、包体最小。
- **切换触发条件**：
  1. 包体积审计中 Tone.js（min+gzip 约 40–60KB 量级）成为训练页首屏瓶颈，且实际只用到 Sampler 单一能力 → 换原生实现（建议先写好 `PianoAudio` 接口抽象，两种实现可互换）；
  2. 需要采样级精确的示范演奏/合奏编排、节拍器、录音回放 → 坚定用 Tone.js（Transport 就是为此设计）；
  3. Tone.js 出现与 React 19/Next 新版本不兼容的 breaking change 且长期无修复 → 退原生（依赖面小，迁移成本低）。
- **集成注意**：① 首次发声必须在用户手势后（教学页"开始练习"按钮里调 `Tone.start()`）；② 采样放 `/public/samples/piano/` 由 Docker 静态服务，预加载 88 键所需子集；③ Safari 的 AudioContext 对手势判定更严格（社区多方反馈），务必在 pointerdown/click 处理器内同步 resume。

---

## 3. Web MIDI

### 3.1 兼容性现状（2026-09，一手来源汇总）

| 浏览器 | 支持情况 | 备注 |
|---|---|---|
| Chrome（桌面/Android）43+ | ✅ | USB 与蓝牙 MIDI；首次弹权限提示 |
| Edge 79+ / Opera 30+ | ✅ | Chromium 同源 |
| Firefox 108+（桌面/Android） | ⚠️ | 支持，但首次调用 `requestMIDIAccess` 会提示安装一个"Site Permission Add-On"，批准后才可用 |
| **Safari（macOS，任意版本）** | ❌ | MDN 标注 Web MIDI 为 "Limited availability / 非 Baseline"；Apple 于 2020 年明确因**指纹追踪（fingerprinting）顾虑**拒绝实现（WEBMIDI.js 官方文档记载）；WebKit bug 107250 无活跃实现；**Safari 26 官方 Release Notes（2025-09）通篇无 Web MIDI 条目**（新增的是 WebGPU、MediaRecorder ALAC/PCM 等） |
| **iOS 全部浏览器** | ❌ | iOS 上 Chrome/Edge 均为 WebKit 内核，继承 Safari 的缺失 |
| 安全上下文 | — | 仅 HTTPS/localhost 可用（本项目 Docker 本地部署走 localhost，满足） |

**降级方案盘点**：
- Jazz-Plugin / jazz-midi（NPAPI 插件 + WebMIDIAPIShim）：NPAPI 已被所有现代浏览器移除，**该路线已死**，仅是 WEBMIDI.js v2 时代的历史产物。
- 无任何可信的 Safari polyfill 存在（2026 现状）。
- iOS 侧仅有第三方"自带 MIDI 栈"的浏览器 App（如 Web MIDI Browser / MIDIWeb），不可能要求普通用户安装，不构成产品方案。
- **结论：唯一现实的降级 = 特性检测 + 屏幕虚拟钢琴作答**（点击/触摸产生与 MIDI noteon 相同的事件），真琴 MIDI 作为桌面 Chromium/Firefox 用户的增强体验。这也正好与本项目"屏幕虚拟钢琴"的既定交互重合——虚拟钢琴不是备胎，而是一等公民，MIDI 是叠加层。

### 3.2 React 集成方式

- 无显著活跃维护的 React 专用封装库（搜索仅见 React Native 的 polyfill `@motiz88/react-native-midi`，与 Web 无关）。社区通用做法是**自写 hook**：

```ts
// useMidiInput.ts —— 仅在 'use client' 组件中使用
useEffect(() => {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return; // SSR + Safari 降级
  let access: MIDIAccess | undefined;
  const onMessage = (e: MIDIMessageEvent) => {
    const [status, note, velocity] = e.data;
    if ((status & 0xf0) === 0x90 && velocity > 0) onNoteOn(note, velocity);
    if ((status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0)) onNoteOff(note);
  };
  navigator.requestMIDIAccess().then((a) => {
    access = a;
    a.inputs.forEach((i) => (i.onmidimessage = onMessage));
    a.onstatechange = () => a.inputs.forEach((i) => (i.onmidimessage = onMessage)); // 热插拔
  });
  return () => access?.inputs.forEach((i) => (i.onmidimessage = null));
}, []);
```

- **备选库：WEBMIDI.js**（npm `webmidi`）：3.3.1，**Apache-2.0**，v3 起官方 TypeScript 支持，周下载 21,628，**3.3.1 发布于 2026-09-15（调研前一天），维护极活跃**。提供 `WebMidi.enable()`、`input.addListener("noteon", ...)`、设备热插拔事件等更符合人体工学的 API；官方支持环境列表与上表一致（浏览器侧只做原生 Web MIDI 的封装，**不会**给 Safari 带来能力）。
- SSR 注意：`navigator` 服务端不存在——所有 MIDI 代码必须在 `useEffect`/事件处理器中执行，或组件整体 `next/dynamic ssr:false`。

### 3.3 结论：首选 + 备选 + 切换触发条件

- **首选：原生 Web MIDI API + 自写 `useMidiInput` hook**（约 30 行，如上）。理由：本项目只需"任意输入口的 noteon/noteoff"，API 表面极小且是 W3C 稳定标准；零依赖、SSR/降级逻辑完全自控。
- **备选：WEBMIDI.js 3.x**。
- **切换触发条件**：
  1. 需要 sysex、多端口路由管理、按名字选设备、更完善的热插拔与错误处理 → 换 WEBMIDI.js；
  2. 需要在 Node.js 端（如 Docker 容器内做自动陪练演示）访问 MIDI → WEBMIDI.js v3 有官方 Node 支持（经 JZZ），原生 API 没有；
  3. Apple 某天在 WebKit 实装 Web MIDI（关注 bug 107250）→ 无需改代码，特性检测自动生效；iOS 需求迫切且等不到 → 超出本工单范围，另立调研（原生 App 壳或麦克风音高检测）。

---

## 4. 整合建议：三者在一个训练页如何协同

**数据流**（对应 #5 原型的骨架、#6 的领域接口）：

```
出题引擎（领域层，纯 TS，无 DOM 依赖）
   │  产出 ExerciseNote[] = { midi: 60, duration: 'q', ... }   ←— 建议以 MIDI note number 为唯一音高真源
   ▼
VexFlow 渲染层（'use client'）
   │  adapter: midi 60 → 'c/4'；EasyScore/StaveNote 画一小节 SVG；Annotation 标指法/技巧记号
   ▼
作答输入（两个入口，产出同一种事件）
   ├─ 屏幕虚拟钢琴：pointerdown → { midi, velocity }
   └─ useMidiInput hook：真琴 noteon → { midi, velocity }   （Safari/iOS 自动只有入口①）
   ▼
发声层：Tone.js Sampler.triggerAttackRelease(midi→音名)   （首次使用前 Tone.start() 解锁）
   ▼
判定层（领域层）：期望 midi vs 实际 midi → 对/错
   ▼
反馈层：VexFlow 音符着色（对=绿/错=红，SVG class 或 setStyle）+ 可选 Annotation 提示
```

**关键工程决定**：
1. **统一事件抽象**：虚拟钢琴与 MIDI 真琴归一为 `{ midi, velocity, timestamp }` 事件；渲染、发声、判定、统计（入 PostgreSQL）都只消费该抽象。这正是 #6「技巧插件化」的天然接口——技巧插件 = 出题器 + 判定器，均不触碰 DOM。
2. **客户端边界**：三者全部 browser-only。建议一个 `<PracticeStage>` 客户端组件（`'use client'`），内部用 `next/dynamic(..., { ssr: false })` 包裹谱面与钢琴子组件（Next.js 官方 Lazy Loading 文档即推荐此法处理依赖 `window` 的库）；出题逻辑可留在服务端（RSC 渲染题目元数据，客户端只拿 JSON）。
3. **音频解锁**：进入训练的"开始"按钮同时做 `Tone.start()` + `requestMIDIAccess()`（后者也需要用户手势触发权限弹窗，两件事绑在同一按钮最稳）。
4. **降级矩阵**：Safari/iOS → 无 MIDI，仅虚拟钢琴（功能完整可训练）；Firefox → MIDI 可用但首连多一步插件授权（UI 里给引导文案）；Chrome/Edge → 全功能。
5. **采样策略**：钢琴采样放 `public/samples/`，单力度层 8 音子集（C3–C6 每隔 3–5 半音一个），Tone.Sampler 自动变调补齐，控制在几 MB；Docker 本地部署无 CDN 也可秒开。

---

## 5. 参考来源

**渲染库（一手）**
- VexFlow 仓库/npm：https://github.com/vexflow/vexflow （迁移自 https://github.com/0xfe/vexflow ）；https://www.npmjs.com/package/vexflow （5.0.0，MIT，内置 TS 类型，周下载 29,062）；v5 changelog：仓库 `changelog/5.0.md`（camelCase 化、移除废弃 API）；官网 https://www.vexflow.com （MIT 声明、Annotation/StaveLine"教学用途"描述）
- VexFlow 5 + React 实践（高亮 class 示例）：https://michael-fares.medium.com/rendering-music-with-vexflow-5-and-react-8de44830d09f
- OSMD：https://github.com/opensheetmusicdisplay/opensheetmusicdisplay ；https://www.npmjs.com/package/opensheetmusicdisplay （2.1.2，BSD-3-Clause，README：基于 VexFlow、数据模型可改音符颜色、headless Node 渲染、播放功能 sponsor 早期访问）；Cursor 类文档：https://opensheetmusicdisplay.github.io/classdoc/classes/Cursor.html （高亮类型/颜色/GNotesUnderCursor）；1.3.0 博客（GNotesUnderCursor→SVGNode）：https://opensheetmusicdisplay.org/blog/osmd-version-1-3-0
- alphaTab：https://github.com/CoderLine/alphaTab ；https://npmjs.com/package/@coderline/alphatab （1.8.4，MPL-2.0，周下载 5,326，解包 13.7MB，含 webpack/vite 插件包）；安装文档（无官方 React 控件、bundler 敏感）：https://alphatab.net/docs/getting-started/installation-web ；播放器/AlphaSynth+SoundFont：https://alphatab.net/docs/tutorial-web/player ；**Next.js 16 Turbopack 崩溃与强制 webpack 结论（维护者 Danielku15，2025-12）**：https://github.com/CoderLine/alphaTab/discussions/2420

**音频（一手）**
- Tone.js：https://github.com/Tonejs/Tone.js （MIT，push 2026-09-16）；https://www.npmjs.com/package/tone （15.1.22，周下载 174,069）；Sampler 变调/示例：https://tonejs.github.io 与 https://tonejs.github.io/examples/sampler ；@tonejs/piano：https://www.jsdelivr.com/package/npm/@tonejs/piano （MIT，Salamander 采样封装，0.2.1/2020）
- AudioContext 手势要求（MDN 最佳实践）：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices ；Tone.js 对应 issue：https://github.com/Tonejs/Tone.js/issues/341
- Salamander 采样 + Sampler 用法示例：https://dev.to/sebseb/playing-sound-on-the-web-using-tonejs-and-alpinejs-17ad

**Web MIDI（一手为主）**
- MDN Web MIDI API（"Limited availability"、非 Baseline、需安全上下文、权限模型）：https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
- WEBMIDI.js 官方支持环境（Edge 79+/Chrome 43+/Opera 30+/Firefox 108+、v3 TS 支持、Apple 2020 拒绝声明、Node 支持经 JZZ）：https://webmidijs.org/docs/getting-started ；https://www.npmjs.com/package/webmidi （3.3.1，Apache-2.0，发布 2026-09-15，周下载 21,628）
- Safari 26 Release Notes（无 Web MIDI 条目）：https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes ；WebKit Safari 26 beta 综述：https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta
- 2026 兼容性横评（iOS 全 WebKit 继承缺失、Apple fingerprinting 立场、麦克风替代思路）：https://www.testmuai.com/learning-hub/web-midi-api-browser-support ；https://www.supersimplepiano.com/blog/web-midi-browser-compatibility-2026
- Jazz-Plugin shim（历史产物，NPAPI 已死）：https://github.com/cwilso/WebMIDIAPIShim
- WebKit 追踪 bug：https://bugs.webkit.org/show_bug.cgi?id=107250

**Next.js 集成（一手）**
- Lazy Loading / `next/dynamic` `ssr:false` 官方指南：https://nextjs.org/docs/pages/guides/lazy-loading
