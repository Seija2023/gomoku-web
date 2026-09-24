# 五子棋 Gomoku Web

一个无需后端即可运行的 15×15 五子棋网页小游戏。支持本地 AI、复盘、局势分析、分支推演和训练，核心功能无需 API。

在线版：

```text
https://seija2023.github.io/gomoku-web/
```

当前工程版本：**v2.7.0（Adaptive Training）**。

## v2.7.0 重点

这一版把历史棋局、Local AI 2.0、Counterfactual 和 Variation Tree 串成真正的个人自适应训练系统，仍然完全本地运行。

- 新增 Mistake Miner：扫描最近人机历史，自动识别高可信个人错误
- 建立统一错误分类：错过直接胜、漏防强制威胁、战术机会漏算、防守优先级不足、棋形效率损失
- 强制防守题只在存在单一可处理直接威胁时生成，避免把已形成双重必胜威胁的局面伪装成“唯一答案”
- 自动错题带来源棋局、原实战落子、推荐手、严重度、评分损失和本地题目可信度
- 训练答案从“对 / 错”升级为“最佳 / 可接受次优 / 错误”，合理候选不会被武断判错
- 新增 Adaptive Planner：综合到期时间、近期错误频率、答错次数、严重度、可信度和掌握状态安排每日训练
- 新增个人错题本，可从最近高可信错误直接单题重练
- 新增近期弱点面板，按错误类型展示出现次数和掌握度
- 一轮训练默认最多 8 题，不再无限循环
- 间隔复习根据最佳、次优、错误采用不同晋级节奏
- 训练题答完后可直接进入 Variation Tree 深挖原局面，退出后返回同一道训练题
- Player Profile 加入自动识别错误、高优先级错误、平均评分损失和首要弱点
- 派生层缓存错误挖掘结果，历史没有变化时不会重复扫描
- Chrome Smoke 覆盖自动错题生成、错题本答题、训练→变化树→训练往返、有限训练会话和 390×844 手机布局

## v2.6.0 Variation Lab

这一版把 v2.4 的棋局实验室和 v2.5 的深度搜索连接成可持续探索的多分支分析工作台。

- 新增持久化 Variation Tree：同一局面可保存多个手动或 AI 分支，不再覆盖原来的假设线
- 复盘中的“从此变招”升级为“变化树分析”，退出后可回到原复盘位置
- 当前对局也可直接进入变化树实验室，原对局不会被修改
- 变化节点支持命名、收藏、父节点 / 根节点导航和删除子树
- AI 可一次扩展 A/B/C 多个候选，并把最佳 Principal Variation 继续写入树中
- 变化树自动保存到 localStorage，可退出后继续上次分析
- Ghost Line 2.0：候选卡可以锁定变化线，PC / 手机都不依赖 hover 才能保留预览
- Ghost Line / 候选变化线最多延伸到 7 ply
- 新增 AI Search Inspector：记录每一层 Iterative Deepening 的推荐手、评分、节点数和耗时
- 新增“推荐稳定度”，观察最佳手是否在多个搜索深度中保持一致
- Search Inspector 同时展示缓存命中、战术节点和 Alpha-Beta 剪枝统计
- 变化树存档加入结构校验，损坏或循环树会被拒绝恢复
- Chrome Smoke 覆盖 Ghost Line 锁定、手动建树、AI 扩展、命名收藏、退出恢复和 Search Inspector

## v2.5.0 Local AI 2.0

这一版把 v2.4 的棋局实验室建立在更强的纯本地搜索引擎上，核心 AI 仍然不依赖任何外部 API。

- 默认启用 `WorkerAIClient`，重搜索从 UI 主线程迁移到 Web Worker
- Worker 初始化失败、浏览器限制或运行异常时自动回退 `MainThreadAIClient`
- 取消 AI 请求会实际终止旧 Worker，避免旧搜索继续占用 CPU
- 搜索加入 Iterative Deepening、Alpha-Beta 剪枝和按时间预算停止
- 加入战术候选优先：直接成五、强制封堵、四类强威胁优先展开
- 加入搜索级 Transposition Table，完整搜索结果可在重复局面复用
- 简单 / 普通 / 困难使用不同时间预算、最大深度和候选宽度
- 手机或低核心设备自动收紧计算预算，桌面设备保留更高搜索上限
- Ghost Line 和候选变化线支持多手连续变化（v2.6 已扩展到 7 ply）
- Counterfactual Analysis 使用更深搜索比较“你的尝试”和 AI 推荐手
- AI 面板显示实际搜索深度、节点数、耗时、缓存命中、战术节点和当前推荐
- GitHub Pages 使用独立 Worker；Standalone 单文件构建内嵌 Blob Worker
- Chrome Smoke 同时验证普通网页 Worker 与 Standalone Blob Worker

## v2.4.0 棋局实验室

这一版正式进入棋局实验室阶段，在 v2.3.3 的 Controller / Position / AIClient 基础上加入自由摆局，并保持普通对局、复盘、训练和分享逻辑相互隔离。

- 新增 Position Editor：自由摆放黑棋、白棋和擦除棋子
- 新增本地反事实分析：选择“我的尝试”，与 AI 推荐手比较即时棋形、对手最佳回应和后续建议
- 反事实结果会在棋盘同时标出两手，并给出规则生成的关键差异说明
- 可指定任意局面的下一手为黑棋或白棋
- 可清空棋盘或恢复进入编辑器时的原局面
- 可从自定义局面直接开始双人对局或本地 AI 对战
- 可在编辑状态直接打开本地 AI 候选分析
- 自定义局面使用 board + currentPlayer 表达，不伪造普通棋谱历史
- AI 候选点改为依据实际棋盘占位生成，支持没有 moves 历史的局面
- AnalysisService 缓存键改为实际棋盘状态，避免自由摆局缓存碰撞
- 自定义对局支持未完成局面自动保存与刷新恢复
- Chrome Smoke Test 新增真实 Position Editor 操作链

## v2.3.3 架构基础

- `main.js` 从约 970 行缩减到约 590 行，游戏、复盘、分支、训练和分享逻辑拆入独立 Controller
- 新增 `MainThreadAIClient`，Controller 不再直接依赖具体 AI 实现，为 Web Worker 切换预留稳定接口
- CI 新增依赖零第三方包的短 Chrome Smoke Test，自动验证棋盘、AI回应和复盘不滚屏
- 保留按区域 Dirty Refresh：棋盘、状态、分析、复盘、覆盖层和设置可独立刷新
- 自动复盘不再每一步重建完整棋谱、关键点和分析 DOM
- 历史棋局派生数据加入缓存，训练进度变化只刷新训练统计
- 新增 RequestGate，旧 AI 请求会自动失效，为未来 Worker/异步 AI 做准备
- 棋盘继续保持“一次初始化 + 增量更新”
- 225 个格子的独立事件监听改为棋盘级事件委托
- 新增统一 `Position` 局面模型与合法棋谱校验
- 新增 `AnalysisService`，统一缓存候选手、Ghost Line、热力图和优势曲线
- AI 落子可直接复用已经计算过的候选排名
- 智能分析面板跳过内容未变化时的重复 DOM 重建
- 新增 localStorage schema migration，为后续数据格式升级保留迁移入口
- 分享棋谱增加轮次、重复落点、终局后继续落子和胜者一致性校验
- 暴露轻量性能诊断：`Gomoku.App.getPerformanceStats()`
- 保持单文件离线构建、GitHub Pages 和现有本地存档兼容

## 现有功能

- 双人本地对战与人机对战
- 自由摆局 Position Editor，可指定下一手并从局面继续对弈 / AI 分析
- “为什么这一步不如推荐手？”本地反事实比较，不依赖外部 API
- 简单 / 普通 / 困难 Local AI 2.0（Worker + 时间预算 + 迭代加深）
- 均衡 / 进攻 / 防守 / 冒险 AI 棋风
- Ghost Line 2.0：PC 悬停、手机长按拖动，并可从候选卡锁定变化线
- 候选 A/B/C、热力图、可解释 AI、Search Inspector 与推荐稳定度
- 持久化 Variation Tree：多分支、AI 扩展、命名、收藏、恢复
- 优势曲线、关键手与变化树复盘
- 分享棋局 / 挑战局面
- Adaptive Training：个人错误挖掘、错题本、弱点排序、分级答案、间隔复习
- 玩家画像、个人开局库
- 最近 20 局历史、终局悔棋和未完成棋局自动恢复
- 自动复盘不会主动滚动页面

## 开发检查

```bash
npm test
npm run build
npm run smoke
```

所有核心 AI、搜索、反事实分析、训练和分享逻辑仍在浏览器本地运行，不需要 API Key 或后端服务器。

## 规则说明

当前采用基础自由五子棋规则，不实现 Renju 的三三、四四、长连等禁手。
