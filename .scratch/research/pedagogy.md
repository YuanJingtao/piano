# 初学者识谱教学法调研（含种子技巧考证）

- **对应工单**：GitHub issue #2「初学者识谱教学法调研（含种子技巧考证）」
- **调研日期**：2026-09-16
- **方法**：中英文网络检索（tavily），覆盖视奏认知研究（一手论文/综述）、主流钢琴教材官方页面（Faber / Piano Safari / Alfred / Suzuki Association / GIML）、唱名法一手资料（Wikipedia Solfège、Takadimi 官方指南、Kodály 课程文档）、中文语境资料（简谱/首调固定调、视唱练耳）。关键论断均在第六节给出来源。
- **下游**：结论供「首版内容子集与学习路径 #4」决策使用。

---

## 一、总览：识谱教学法的两大坐标轴

调研发现，所有成熟的初学者识谱教学法都可以在两个坐标轴上定位：

**坐标轴 1 —— 音高命名系统（"这个音叫什么"）**
| 系统 | 逻辑 | 典型使用区 |
|---|---|---|
| 音名（C D E） | 绝对音高，与钢琴键一一对应 | 英语世界钢琴教材主流 |
| 固定调唱名（fixed do） | do 永远 = C，唱名即音名 | 法国/意大利/俄系音乐学院；**中国专业视唱练耳主流** |
| 首调唱名（movable do） | do = 当前调主音，唱名表示**音级功能** | Kodály、Gordon MLT、英美中小学、合唱；**中国大众音乐教育（简谱）** |
| 简谱（数字 1-7） | 本质是首调唱名的数字书写 | 中国大众/民乐/声乐的"母语记谱法"，源自法国 Galin-Paris-Chevé 数字记谱，经日本于清末传入 |

**坐标轴 2 —— 阅读单位（"一次读多大一块"）**
逐音命名（mnemonics）→ 地标音锚定（landmark notes）→ 方向/音程阅读（intervallic reading）→ 模式组块（和弦/音阶/琶音 chunking）→ 和声预判。认知科学研究一边倒地支持"往组块端走"：

- Sloboda（1974, 1977）开创的眼手跨度（eye-hand span）研究：熟练视奏者眼睛领先手 1 个短语以上，以**短语/组块**为视觉加工单位，而非单音。
- Wristen（2005）综述：专家视奏者注视时间更短、眼手跨度更大，认知分组的单位是**旋律轮廓、乐句、节拍组**；视奏水平与整体音乐技能相关（Lehmann & Ericsson）。
- Perra 等（2021, JEMR）眼手跨度综述：最佳视奏者的特征是眼手跨度**随谱面复杂度灵活伸缩**——即模式识别 + 预判能力。
- ISME 2026 眼动实验（成人初学者）：仅 6 次 ×10 分钟的"音高分组块"或"节奏分组块"训练，即显著优于对照组的视奏成绩，眼动表现为注视点更少、组块识别更多、眼手跨度更大。**→ 直接证据：模式组块训练对初学者短期见效，这正是本产品"教程+练习"形态该做的事。**
- Yamaha 教学文章直言"Note-naming ≠ Music-reading"； Bean（1938）早已指出视奏本质是模式识别，一眼抓 3 个音以上才可能流畅。

**横切原则 —— "先声音后符号"（sound before symbol）**：Kodály、Gordon MLT、Suzuki、Orff、Dalcroze 五大体系共享此原则——先会唱/会听/会弹（耳朵领先），再挂上记号；读谱被定义为"把已内化的声音模式映射到符号"，而不是"解码未知符号"。对产品的启示：每个技巧页应配套听觉先行练习（先听/唱，再看谱作答）。

---

## 二、技巧体系地图（分类清单）

每类给出：**原理 → 适用阶段 → 代表教学法/教材**。

### A. 键盘地理类（不看谱，先会找键）
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **A1 黑键分组锚点** | 黑键以 2 个、3 个为一组循环排列；2 键组左侧白键是 C、3 键组左侧白键是 F；2 键组"夹着"D、3 键组"夹着"G-A。用触觉+视觉图案即可定位全键盘 | 第 0-1 课，任何年龄 | 几乎所有 Primer 教材（Faber Primer、Alfred Primer）；Piano Safari 也以此入门 |
| **A2 天然半音地标** | 键盘上**只有两对相邻白键之间没有黑键：E-F 和 B-C**，它们就是大调音阶中仅有的两个半音（mi-fa、ti-do）。音阶结构 W-W-H-W-W-W-H 由此可视化 | 第 1-4 周（音阶/调号前置知识） | Open Music Theory 等标准乐理教材；各方法讲大调音阶时都会用 |

### B. 五线谱符号类（"这个符在哪"）
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **B1 地标音系统（landmark notes）** | 不背全部音位，只记少数"锚点"：中央 C（两谱表之间的加线）、高音 G（高音谱号卷曲环绕的那条线）、低音 F（低音谱号两点夹住的那条线）；再以锚点向外步进推算。锚点天然成对**围绕中央 C 镜像对称**（详见考证 3.2） | 第 1-8 周，识谱主骨架 | Faber Piano Adventures（C/G/F 地标优先，MTNA 2018 教学法奖）、Piano Safari（高音 G + 低音 C 起步）、Williamsburg 等地标系统教程 |
| **B2 口诀记忆（mnemonics）** | "Every Good Boy Does Fine"（EGBDF）、"FACE" 等英文口诀硬背线间音名 | 传统入门；现被主流教材**降级为辅助** | John Thompson 传统路线；批评见 musicandtheory.com（逐音命名慢、无法预听音响） |
| **B3 生长谱表（growing staff）** | 谱表从 2 线→3 线→5 线逐步展开，音域随认读能力生长，避免一开始面对 11 个音位 | 前 1-3 个月 | Frances Clark《The Music Tree》/《Time to Begin》（1955） |
| **B4 大谱表结构** | 高音谱表=右手、低音谱表=左手、中央 C 是两谱表的"缝合点"（高音谱下加一线 = 低音谱上加一线） | 与 B1 同步 | 所有钢琴教材 |

### C. 关系阅读类（"音和音之间什么关系"）——现代主流
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **C1 方向阅读** | 相邻音（二度）= 谱上"挪一格"（线→间或间→线），只需判断上/下，无需知道音名；同音重复=不动 | 第 1-2 周即可开始 | Faber Primer（地标后立刻教 2nds 按方向读）；各方法通用 |
| **C2 音程/形状阅读（intervallic reading）** | 把音程当作**视觉形状**识别：三度=线到线/间到间（隔一格）、五度=线-间-线-间、八度=同位置跨谱；一旦掌握，任何调、任何位置都能"平移手型"直接弹 | 第 2-8 周起步，长期核心 | 1955 年 Frances Clark《Time to Begin》开创；Piano Safari 全面采用；Alfred《Intervallic Reading Series》（Goldston/Costley，从 blocking 到转位/七和弦） |
| **C3 轮廓阅读** | 读旋律的整体走向（上行/下行/波浪/跳进后回填），配合听觉预判 | 与 C1/C2 并行 | Piano Safari 论述；Sloboda 1977（短语为视觉单位） |
| **C4 位置/五指模式** | 手放在某个五指位置（C 位置、G 位置、F 位置），谱上音符映射为固定的指法图案 | 第 1-6 个月 | Middle-C 法（John Thompson）、位置法（Bastien）；多调性位置法（Faber multi-key） |

> 注意：Middle-C 法与 intervallic 法的对照实验（渥太华大学硕士论文；ACT-R 认知建模 2012）结果**并非一边倒**：Middle-C 学生在单音命名/音程弹奏测试上并不差，intervallic 学生在键盘定位与模式识别上占优。结论：两条路线各有优劣，现代教材（Faber 等）实际是**地标 + 音程的混合路线**，本产品应取混合方案而非单押一家。

### D. 唱名/音级功能类（"这个音在调里是什么角色"）
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **D1 首调唱名（movable do）** | do 永远=主音；唱名编码**音级功能**而非绝对音高。同一首歌移到任何调，唱名不变→天然支持移调、内心听觉、模式复用。小调多用 **la-based minor**（小调主音唱 la，自然小调无需变化音节：la ti do re mi fa so la） | 可贯穿全程；对中文用户尤其低门槛（=简谱 1234567） | Curwen tonic sol-fa（Sarah Ann Glover 19 世纪发明、John Curwen 推广）、**Kodály 法**、Gordon MLT（明确推荐 movable do + la-based minor）；Wikipedia：movable do 通行于中、日、英、美、澳、爱尔兰等地 |
| **D2 固定调唱名（fixed do）** | do=C 恒定；与五线谱音位、钢琴键一一对应，无需判调；升降号多时难唱准 | 专业路线（中国音乐学院视唱练耳主流）；首版**不建议**做主线 | 法/意/俄保守传统；中国视唱练耳教材 |
| **D3 调内功能模式（do-mi-so / la-so-mi 等）** | 用三度叠置的功能音组（主和弦 do-mi-so、Kodály 基础音集 so-mi→la-so-mi→so-mi-do…）作为"阅读词汇量"单元：先唱熟音组，再在谱上认出它们 | 与 D1 绑定；Kodály 有严格呈现顺序 | Kodály（so-mi 小三度=儿童最易唱准的首个音程，儿歌《Rain Rain Go Away》几乎全由 so-mi 构成）；fa、ti 因半音难唱而**刻意后置** |
| **D4 柯尔文手势（Curwen hand signs）** | 每个唱名一个手势，手势高低映射音高，身体化强化音级感 | 儿童/合唱场景为主；网页产品可作视频辅助 | Kodály 课堂标配 |
| **D5 简谱↔五线谱对照** | 简谱=首调唱名的数字形式；中文初学者多先会简谱，可用"1=do"做迁移桥 | 中文产品特色机会点 | 中国大众音乐教育传统；Galin-Paris-Chevé 数字记谱是其源头 |

### E. 模式组块类（"这一坨是什么"）——从初级通往中级的关键
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **E1 和弦形状（blocking）** | 三和弦原位=谱上"三格叠罗汉"（线-线-线 或 间-间-间）；转位形状不同。一眼识别和弦块，比逐音快一个数量级 | 第 2-6 个月 | Alfred Intervallic Reading Series；Faber Sight Reading 3A 起（Alberti 低音、转位、八度） |
| **E2 音阶/琶音跑动** | 连续级进=音阶片段，直接调用手型；分解和弦=琶音图案 | 第 3 个月起 | 各方法的技术配套；encoreacademy 等成人教学指南 |
| **E3 重复与序列** | 动机重复（原样再来一次）与模进（同形状平移）在谱面上高度可见，识别后可跳过逐音解码 | 第 3 个月起 | Alfred 系列；Kember《Piano Sight-Reading》（模式识别+自学式） |
| **E4 伴奏音型** | Alberti 低音、柱式和弦、分解八度等惯用型的整体识别 | 第 4 个月起 | Faber Sight Reading 系列明确按音型组织 |

### F. 节奏阅读类（"什么时候弹、弹多长"）
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **F1 Kodály 节奏音节** | 按时值命名：四分=ta、两个八分=ti-ti、十六分=ti-ri-ti-ri（tika-tika）、三连音=tri-o-la、切分=syn-co-pa。简单直观，适合入门 | 第 1 个月起 | Kodály 课堂（美国小学最普及的节奏系统） |
| **F2 Takadimi** | 按**拍位功能**命名：拍永远是 ta，拍内二分=ta-di，四分=ta-ka-di-mi；任何时值当拍都念 ta，内部一致性更好，可无缝升到复杂节奏/复合拍 | 入门即用，上限更高 | Hoffman/Tacka 体系；官方指南 takadimi.net |
| **F3 数拍系统** | 1-e-&-a（美式传统）、1-ti-te-ta（Eastman）、du-de（Gordon）| 青少年/成人自学常见 | Eastman 音乐学院体系 |
| **F4 律动/宏观拍感** | 用身体行走、拍腿感受 meter 与 macrobeat，节奏先于符号内化 | 第 0-1 个月 | Dalcroze 体态律动（eurhythmics）、Gordon MLT 节奏模式 |

### G. 听想/声音先行类（"符号背后是声音"）
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **G1 Audiation（听想）与模式回声** | 先听/模仿大量调性模式（主、属）与节奏模式，建立"音乐词汇量"，读谱时大脑才有东西可匹配。Gordon 技能序列：听→模仿→命名→符号关联→阅读 | 贯穿前 3 个月 | Gordon MLT（GIML）、《Jump Right In》 |
| **G2 延迟读谱（先弹后读）** | 先靠耳朵和模仿把曲子弹会，再把已会的声音挂到谱上——"母语式"习得 | 幼儿路线；成人产品可借鉴"先听后看"练习序 | Suzuki（延迟识谱至 Book 1 曲目基本会弹之后） |
| **G3 耳奏（ear playing）迁移** | 先会凭耳在键盘上弹熟悉旋律，再对照谱面发现"原来长这样"，建立声音-符号回路 | 第 1-2 个月 | Faber（含 ear playing 环节）、Orff（即兴优先） |

### H. 视奏元策略类（"拿到新谱怎么办"）
| 技巧 | 原理 | 适用阶段 | 代表 |
|---|---|---|---|
| **H1 弹前扫描** | 开弹前先看调号、拍号、找重复段/难点/手位变化，形成预期 | 从第一天就可教 | Paul Harris《Improve Your Sight-reading》（Faber，含 preparation questions）；McPherson 研究 |
| **H2 眼手跨度/前瞻训练** | 刻意练习眼睛提前看下一拍/下一小节；最佳跨度随难度自适应 | 第 2 个月起 | Sloboda 系研究；Harris 系列 |
| **H3 保节奏弃音原则** | 节奏骨架优先，宁可错音不停拍（视奏评分中 continuity 权重高） | 从第一天就可教 | Harris、Kember；ISME 2026 实验也以 continuity 为主要指标 |

---

## 三、种子技巧考证结论

### 3.1 种子一："mi la do" 式唱名模式读法

**判定：所指教学法真实且成熟 = 首调唱名法（movable-do solfège）的"调内音级功能模式阅读"，即 Kodály / Curwen tonic sol-fa / Gordon MLT 一脉；但 "mi la do" 这个三音组本身不是任何体系的标准名称，应属用户误记。**

考证细节：

1. **"模式读法"本体成立。** 首调唱名法中，唱名编码音级功能而非绝对音高（Wikipedia：movable do 每个音节对应 scale degree，同一旋律在任何调唱名不变）。用少量三音组/音型作为"阅读词汇"来读谱，是 Kodály 与 Gordon MLT 的标准做法——这正是用户凭印象记住的"唱名模式读法"。
2. **"mi la do" 最接近的三个标准音组**（按可能性排序）：
   - **la-do-mi（6-1-3）**：la-based minor 中小调**主三和弦**（A 小调 = A-C-E = la-do-mi；Gordon 明确推荐 la-based minor）。用户说的 E-A-C 恰好就是 A 小调主和弦的三个音（mi-la-do 是它的乱序）。
   - **do-mi-so（1-3-5）**：大调**主三和弦**，首调教学里"家"的和弦，最常见的入门功能音组（简谱写作 1 3 5）。
   - **la-so-mi（6-5-3）**：Kodály 最早期的基础音集。Kodály 体系从 **so-mi（小三度）**起步——这是儿童最自然、最易唱准的音程（操场童谣 "Rain, Rain, Go Away" 几乎全由 so-mi 构成），随后按 SM→SML→SMD→LSMD→SMRD→LSMRD→MRDL（转入小调）的固定顺序扩展；fa 与 ti 因含半音而刻意后置。
3. **初学者怎么用**（可直接落成教程页的流程）：
   - ① 确定调、找到 do（主音）→ ② 用唱名唱出旋律的功能轮廓（do-mi-so = "家"，so 倾向回落 do 等）→ ③ 配柯尔文手势/听觉回声强化 → ④ 迁移到键盘：任何调里 1-3-5 手型相同 → ⑤ 最后在谱上直接识别这些音组形状。
   - 对中文用户的加成：**简谱就是首调唱名的数字形式**（1=do），大量中国用户有简谱先验，"3 6 1 / 6 1 3 / 1 3 5"可直接与 do-mi-so、la-do-mi 对照迁移，是天然的认知桥梁。
4. **边界与注意**：首调在转调频繁/无调性音乐中失效（此时固定调或音名更合适，见 nicechord 论述）；中国专业视唱练耳以固定调为主流，但**业余大众与简谱传统是首调**——本产品面向初学者，首调是正确选择；钢琴上首调需"每个调重新定位 do"，教学时必须把唱名与键盘手型绑定练，否则易停留在"会唱不会弹"。

**给 #4 的落点建议**：教程中该技巧的规范名称建议叫 **"调内功能音组（首调唱名）"**，首批音组取 do-mi-so（大调主和弦）、la-so-mi（Kodály 基础音集）、la-do-mi（小调主和弦），并提供简谱数字对照。

### 3.2 种子二："so fa 对称"

**判定："so fa 对称" 在全部检索到的教学法文献中无标准对应术语，说法本身不成立（属误记/ hearsay）；但它极可能指向一个真实且对初学者非常有用的对称——"高音谱 G（so）与低音谱 F（fa）围绕中央 C 的地标镜像对称"。该正确表述成立，且正是 landmark 教学法的第一课内容。另有三个真实存在的"近亲对称"，一并列出供甄别。**

候选解读与裁定（按与初学者识谱的相关度排序）：

1. **【最可能的正身，成立】谱号锚定地标音的镜像对称**：高音谱号（G 谱号）的卷曲环绕第二线 = 高音 G（so）；低音谱号（F 谱号）的两点夹住第四线 = 低音 F（fa）。在大谱表上，高音 G 位于中央 C 上方纯五度、低音 F 位于中央 C 下方纯五度，**两者围绕中央 C 精确镜像**：G 是高音谱"自下而上第二条线"，F 是低音谱"自上而下第二条线"。地标教学法明确以此为公理——Good Music Academy 教材原文："所有地标音都对称，中心点是中央 C……G on the G clef = F on the F clef（学一个立刻免费得到另一个）"。Faber、Piano Safari、pianovideolessons 等的地标第一课都是 middle C → treble G → bass F。**正确表述应为："so（G）与 fa（F）是两个谱号各自锚定的地标音，围绕中央 C 成镜像对称；记住其一即得其二。"**
2. **【成立，但唱名记错】天然半音对称 mi-fa / ti-do**：键盘上仅有的两对"中间无黑键的相邻白键"是 E-F 与 B-C；大调音阶中仅有的两个半音恰是 mi-fa（3-4）与 ti-do（7-1）。这是一个真实且重要的对称（音阶结构、调号推导的根基）。若用户想表达的是这个，则正确音节是 **mi-fa 与 ti-do**，不是 so-fa。
3. **【成立，但超出首版】五度圈/和声功能对称**：so（属音，5 级）与 fa（下属音，4 级）在五度圈上分别位于 do 的顺时针、逆时针一步，围绕主音对称（上纯五度 vs 下纯五度）；其远端延伸是 F♯=G♭ 恰在 C 的五度圈正对面（对称轴）。属和声功能理论（T-S-D 的对称性），真实但对初学者过深。
4. **【成立，但与 so/fa 无关】黑键组对称**：黑键 2 组、3 组循环排列，2 组夹着 D、3 组夹着 G-A，据此定位 C、F。这是键盘地理对称，涉及的音是 C/D/F/A，不是 so/fa。

**给 #4 的落点建议**：首版采纳解读 ①，把技巧命名为 **"地标音对称：高音 G 与低音 F"**（教程页顺便讲清两个谱号本身就是 G 谱号/F 谱号，一举三得）；解读 ② 作为"天然半音"知识点并入键盘地理课；解读 ③④ 不入首版。

---

## 四、首版技巧候选清单（含优先级与理由）

优先级依据：① 科学证据强度（组块/音程阅读 > 逐音命名；短期组块训练即见效）；② 与产品形态契合度（每个技巧都能拆成"教程页 + 五线谱出题 + 虚拟钢琴/MIDI 判题"的独立练习）；③ 中文初学者先验（简谱/首调亲和）。

### P0 —— 首版必做（构成最小可用学习路径）
| # | 技巧 | 类别 | 理由 |
|---|---|---|---|
| 1 | **键盘地理锚点**：黑键 2/3 组定位 C/F/D/A + 天然半音 E-F/B-C | A1/A2 | 第 0 课，零乐理门槛；出题容易（"按下低音 F"）；是一切后续技巧的物理基础 |
| 2 | **地标音系统**：中央 C → 高音 G/低音 F（含"so-fa 镜像对称"正名）→ 高低两个 C | B1 + 考证② | 现代主流方法（Faber/Piano Safari）的识谱骨架；用户种子技巧 2 的正确落点；锚点对称大幅减少记忆量 |
| 3 | **方向与音程阅读**：二度（步进/重复）→ 三度/五度/八度形状 → 简单轮廓 | C1/C2/C3 | 认知科学最有力的结论（读关系不读名）；组块训练有 RCT 级证据支持短期见效；出题形式天然适配五线谱判题 |

### P1 —— 首版尽量做 / 第二迭代
| # | 技巧 | 类别 | 理由 |
|---|---|---|---|
| 4 | **节奏阅读基础**：Kodály ta/ti-ti（或 Takadimi ta/ta-di）+ 全/二/四分音符时值 | F1/F2 | 视奏的另一半；ISME 实验证明节奏组块训练独立见效；中文可配"哒"类音节 |
| 5 | **五指位置与三和弦形状**：C/G 位置、原位三和弦"叠罗汉"形状、分解和弦 | C4/E1 | 从"读单音"升级到"读块"的第一级台阶；与虚拟钢琴判题（多键同按）契合 |
| 6 | **首调功能音组入门**：do-mi-so、la-so-mi、la-do-mi + 简谱数字对照 | D1/D3/D5 + 考证① | 用户种子技巧 1 的正确落点；对中文用户有简谱迁移红利；先听唱后认谱，符合 sound-before-symbol |

### P2 —— 后续迭代
| # | 技巧 | 类别 | 理由 |
|---|---|---|---|
| 7 | **视奏元策略**：弹前扫描（调号/拍号/找重复）、保节奏弃音、前瞻一小节 | H1-H3 | 重要但难做成客观判题，适合作为教程页+主观练习；可在用户有基础后引入 |
| 8 | **音名口诀（FACE/EGBDF）与固定调对照** | B2/D2 | 作为可选辅助与进阶分支（照顾走专业路线用户），不做主线 |
| 9 | **扩展组块**：音阶跑动、模进/重复识别、Alberti 低音、转位形状 | E2-E4 | 通往中级；依赖 P0/P1 完成 |

**建议的首版学习路径骨架**（供 #4 参考）：键盘地理（1）→ 地标音+对称（2）→ 方向/二度（3a）→ 三度/五度形状（3b）→ 节奏基础（4）→ 五指位置+和弦块（5）→ 首调功能音组（6），其中 6 可与 3 并行穿插；每步都遵循"先听/唱 → 再看谱认 → 最后在键盘答"的练习序。

---

## 五、对产品设计的直接启示（摘要）

1. **练习判题粒度**：地标音快答、音程/形状识别、和弦块识别、节奏音节匹配——四类题型全部可在"真实五线谱出题 + 虚拟钢琴/MIDI 作答"上客观判分，与 P0/P1 清单一一对应。
2. **听觉先行**：每技巧页配"先听后看"环节（G1/G2），符合五大体系共识与 Gordon 学习序列。
3. **调性策略**：首版内容锁定 C 大调/a 小调起步（landmark+intervallic 混合路线），首调唱名作为移调能力的伏笔。
4. **中文本地化红利**：简谱↔五线谱↔首调唱名三者同源（Galin-Paris-Chevé → 简谱），可做成显性对照组件。

---

## 六、参考来源

**视奏认知科学**
- Wristen, B. (2005). *Cognition and Motor Execution in Piano Sight-Reading: A Review of Literature*. https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1005&context=musicfacpub （综述 Sloboda 1974/1977、Lehmann & Ericsson 1993、McPherson 1994、眼动与分组研究）
- Perra et al. (2021). *Review on Eye-Hand Span in Sight-Reading of Music*. J. Eye Movement Research 14(4). https://doi.org/10.16910/jemr.14.4.4
- ISME 2026 Session 937: *Assessing visual chunking training in sight-playing through eye tracking*（成人初学者组块训练 RCT 式眼动实验）https://www.ismeworldconference.org/isme26/session/4317717/
- *Cognitive modelling of early music reading skill acquisition: Middle-C vs Intervallic methods*（ACT-R 建模）https://www.sciencedirect.com/science/article/abs/pii/S1389041712000605
- 渥太华大学硕士论文：*Middle C vs mixed intervallic reading 对比实验* https://ruor.uottawa.ca/bitstreams/25768a1f-d424-4947-8a2b-a377d85982c1/download
- *Strategies of sight-reading ability improvement: a review of literature*（含 Bean 1938 模式识别、Pike 2012 组块训练）https://hrmars.com/papers_submitted/22605/
- Yamaha Music Educators: *Note-Naming ≠ Music-Reading* https://hub.yamaha.com/music-educators/prof-dev/teaching-tips/note-naming-music-reading

**读谱方法/教材**
- Piano Safari Field Notes: *Foundations of Music Literacy: Intervallic Reading*（Part 1/2，intervallic 方法史溯 Frances Clark 1955《Time to Begin》；Level 1 以 treble G/bass C 为地标）https://www.pianosafari.com/field-notes/foundations-of-music-literacy-intervallic-reading （及 …/part-2）
- Toronto Arts Academy: *The Ultimate Guide to the Best Piano Methods*（Middle-C 法/地标法/多调法对比，Faber 获 MTNA 2018 奖）https://torontoartsacademy.com/the-ultimate-guide-to-the-best-piano-learning-methods
- Williamsburg Music Lessons: *Guide to Middle C, Landmark, Intervallic Methods* https://www.williamsburgmusiclessons.com/middle-c-intervallic-other-piano-methods
- Good Music Academy: *How to Read Music Step-by-Step（Landmark 系统及其对称性，含 "G on the G clef = F on the F clef"）* https://goodmusicacademy.com/learn-to-read-music-fast
- Piano Video Lessons: *Lesson 1 – Landmark Notes: Treble G, Bass F, Middle C* https://courses.pianovideolessons.com/free-online-piano-lessons/note-reading-course/online-piano-lessons/lesson-1-3-landmark-notes-treble-g-bass-f-and-middle-c
- Piano with Sarah: *More landmark notes: high C and low C（镜像关系）* https://www.pianowithsarah.ca/blog/landmark-notes-high-and-low-c
- Alfred: *Intervallic Reading Series*（blocking→转位→七和弦）https://www.alfred.com/collections/intervallic-reading-series-sheet-music
- Music & Theory: *How to Read Music Using Intervals and Landmark Notes vs. Mnemonics* https://www.musicandtheory.com/how-to-read-music-using-intervals-and-landmark-notes-vs-mnemonics
- Schmitt Music: *Faber Piano Adventures Sight-Reading 系列介绍*（按音型组织：Alberti、转位、节奏组块）https://www.schmittmusic.com/products/piano-adventures-by-faber-sight-reading
- Colourful Keys: *Best Sight-Reading Resources*（Paul Harris《Improve Your Sight-reading》结构：节奏练习+准备问题）https://colourfulkeys.ie/best-sight-reading-resources-piano-teachers
- Encore Academy: *How to Improve Sight Reading*（和弦块/音阶/琶音形状识别）https://www.encoreacademyut.com/blogs/how-to-improve-sight-reading-piano
- Pianoecademy: *Master Sight-Reading: Guide for Adult Pianists*（成人：地标→音程→组块路径）https://www.pianoecademy.com/guide-to-piano-sight-reading

**唱名法 / Kodály / Gordon / Suzuki / Orff-Dalcroze**
- Wikipedia: *Solfège — Movable do*（Glover 19 世纪发明 tonic sol-fa；movable do 通行于中国、日本（5=so、7=si）、英美等；la-based vs do-based minor）https://en.wikipedia.org/wiki/Movable_do_solf%C3%A8ge
- nicechord（好和弦）: *「首調」和「固定調」是什麼？*（Sarah Glover 1812、Curwen 手势、la-based minor、固定/首调适用边界）https://nicechord.com/post/fixed-do-vs-movable-do
- MyEarTraining: *Movable do and fixed do*（la-based minor 音级对照表：A 小调 A=La、C=Do、E=Mi）https://www.myeartraining.net/article_solfege
- Musical U: *What is the Kodály Method*（movable do+手势+节奏音节）https://www.musical-u.com/learn/what-is-kodaly-and-how-does-it-relate-to-ear-training
- Discover Singing: *What is Kodály method*（so-mi 小三度=首个教学音程；sound before symbol）https://www.discoversinging.co.uk/2014-04-24/what-is-kodaly-method
- Teaching Children Music: *Kodály method*（音集发展序列 SM→SML→SMD→LSMD→SMRD→LSMRD→MRDL；fa/ti 后置原因）https://www.teaching-children-music.com/2011/01/kodaly-method
- van Eersel: *Perspectives on Kodály Cello Teaching*（solmisation 练习音组顺序：la-so-mi、so-mi-do…）https://www.researchcatalogue.net/view/222456/278848
- UNT Digital Library: *Kodály and Music in Elementary Schools*（la-so-mi 音集课程大纲）https://digital.library.unt.edu/ark:/67531/metadc146441/m2/1/high_res_d/1995-23_Navarro.pdf
- Victoria Boler: *Teaching Sol and Mi*（so-mi 准备-呈现-练习流程）https://www.victoriaboler.com/blog/howtoteachsolandmi
- GIML: *About Music Learning Theory / MLT Approach*（audiation、whole-part-whole、先听后读）https://giml.org/mlt/about 、https://giml.org/mlt/methodology
- Wikipedia: *Gordon music learning theory*（技能学习序列：模仿→verbal association→partial synthesis→symbolic association→阅读）https://en.wikipedia.org/wiki/Gordon_music_learning_theory
- Alliance A.M.M.: *The Gordon Approach*（movable do + la-based minor + 各调式基准音；节奏音节按拍功能）https://www.allianceamm.org/resources/gordon
- Color In My Piano: *My First Encounter with Dr. Edwin Gordon*（echo 模式练习、即兴先于记谱）https://colorinmypiano.com/2024-07-23/my-first-encounter-with-dr-edwin-e-gordon-and-his-music-learning-theory-mlt
- Suzuki Association of the Americas: *About the Suzuki Method*（mother-tongue、先听后读）https://suzukiassociation.org/about/about-the-suzuki-method
- UTA 硕士论文: *An Analysis of the Suzuki Method*（delayed note reading 依据）https://mavmatrix.uta.edu/cgi/viewcontent.cgi?article=1022&context=music_theses
- NAfME: *Kodály, Orff, and Dalcroze: Who's Who and What's What* https://nafme.org/blog/kodaly-orff-and-dalcroze-a-whos-who-and-whats-what
- DomiSol: *Curwen Hand Signs teaching guide* https://domisol.app/learn/curwen-hand-signs

**节奏音节系统**
- Takadimi 官方短指南（PDF）：拍永远是 ta；ta-di/ta-ka-di-mi http://www.takadimi.net/documents/Takadimi%20short%20guide%20for%20Web.pdf
- Eastman uTheory: *Rhythm Counting Systems*（Kodály/Takadimi/Eastman/Gordon/1-e-&-a 对比）https://info.utheory.com/rhythm-counting-systems
- LibreTexts: *Counting Systems*（各系统适用范围）https://human.libretexts.org/Bookshelves/Music/Music_Education_and_Training/Do_You_Want_to_Major_in_Music_(Wilson_and_Royston)/05%3A_Aural_Skills/5.03%3A_Counting_Systems
- Palkki (2010). *Rhythm Syllable Pedagogy*. JMTP https://digitalcollections.lipscomb.edu/cgi/viewcontent.cgi?article=1306&context=jmtp
- 《Easy as 1,2,3: An Analysis of Rhythm-Counting Systems》（Gordon/Kodály/Eastman/Takadimi 系统分析）http://www.ibew.org.uk/dvarch/DV05625.pdf

**键盘地理 / 乐理基础**
- Open Music Theory: *Half Steps, Whole Steps, and Accidentals*（E-F、B-C 为仅有的无黑键白键对）https://viva.pressbooks.pub/openmusictheory/chapter/half-and-whole-steps
- Musiciangoods: *Whole Steps and Half Steps* https://musiciangoods.com/en-us/blogs/music-theory/whole-steps-and-half-steps
- PlayPiano: *The Layout of the Piano Keyboard for Beginners* https://playpiano.com/pianos/the-layout-of-the-piano-keyboard-for-beginners
- Wikipedia: *Circle of fifths*（C 顶点、F/G 两侧对称、F♯/G♭ 对径）https://en.wikipedia.org/wiki/Circle_of_fifths

**中文语境（简谱/首调固定调）**
- Grokipedia: *Numbered musical notation*（简谱源自 Galin-Paris-Chevé，经日本清末传入，替代工尺谱，首调体系）https://grokipedia.com/page/Numbered_musical_notation
- Jianpu Space（简谱=首调 movable-do 传统的明确陈述 + 唱名对照表）https://jianpu.space/en/jianpu
- EarMaster 中文站: *视唱练耳五线谱是唱首调还是固定调*（中国语境：西洋乐器/五线谱多用固定调，民乐/简谱用首调）https://www.earmasterchina.cn/faq/ear-mhdhs.html
- 知乎: *固定唱名法和首调唱名法有什么不同* https://zhuanlan.zhihu.com/p/136079594
- 非凡吉他: *固定调唱名法和首调唱名法哪种好*（简谱=首调、五线谱位置=固定调的实务对应）https://www.feifanjita.net/public/a/gu-ding-diao-chang-ming-fa-he-shou-diao-chang-ming-fa-na-yi-zhong-chang-fa-geng-hao.html

> **来源可信度说明**：认知科学部分以同行评审论文/综述为准（Sloboda、Wristen、JEMR 综述、ISME 实验）；教材方法部分以方法官方页面（Piano Safari、Alfred、Faber 经销页、GIML、Suzuki Association）与从业者综述为准；两个种子技巧的考证综合了多个独立来源交叉验证（如 landmark G/F 对称同时见于 Good Music Academy、Piano Video Lessons、Piano with Sarah、YouTube landmark 教程；la-based minor 音级表同时见于 MyEarTraining、Musical U、Living Pianos、Gordon MLT 官方）。未找到任何来源使用 "mi la do" 或 "so fa 对称" 作为术语——这一"查无此词"本身即考证结论的一部分。
