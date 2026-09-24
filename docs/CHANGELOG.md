# Changelog

记录 Gomoku Web 的重要用户功能、架构与工程变更。当前版本：**v2.8.1**。

## v2.8.1 — Engineering Governance

### Changed

- 建立仓库治理文件：`.gitignore`、`.editorconfig`、`.gitattributes`、贡献指南、开发指南与 PR / Issue 模板。
- 新增零第三方依赖的 Architecture Lint，并接入 CI。
- CI 增加并发取消、15 分钟超时和 artifact 保留期。
- `dist/` 改为纯生成目录，不再跟踪过期 Standalone 文件。
- ShareController 不再直接使用 DOM / Clipboard API，浏览器能力下沉到 `js/platform/share-adapter.js`。
- AudioManager 不再直接访问 localStorage，音效偏好统一进入 Settings。
- Storage schema 升级到 5，自动迁移旧 `gomoku-sound` 设置。
- 重写 Architecture / Usage 文档，使文档与 v2.8 架构一致。

### Quality

- Architecture lint 强制 Controller / Domain 不碰 DOM、非 Storage 模块不碰 localStorage、底层搜索不向上穿层。
- 文档版本与 package version 纳入自动检查。
- 生成目录是否被 Git 跟踪纳入自动检查。

## v2.8.0 — Workspace & UX 2.0

### Added

- 四工作区：对局 / 分析 / 训练 / 实验室。
- PC 顶部导航与移动端固定底部导航。
- WorkspaceManager、SessionWorkflow、RenderCoordinator 和 BootGuard。

### Changed

- Search Inspector、训练弱点、玩家画像、开局库、历史与规则采用渐进展开。
- `main.js` 从约 772 行缩减到约 444 行。
- `main.js` 的直接 `state.active` 判断从 31 次降到 0。
- 桌面候选卡改为更适合窄侧栏的纵向呈现。

### Quality

- Chrome Smoke 增加工作区切换、特殊模式锁定、刷新持久化和 390px 移动端导航检查。
- v2.8.0 发布时 116 个测试全部通过。

## v2.7.0 — Adaptive Training

### Added

- Mistake Miner：从历史人机对局识别高可信个人错误。
- 错误分类：错过直接胜、漏防强制威胁、战术漏算、防守优先级不足、棋形效率损失。
- 个人错题本、近期弱点和自适应训练计划。
- “最佳 / 可接受次优 / 错误”三级训练反馈。
- Training ↔ Variation Tree 工作流。

### Changed

- 间隔复习根据训练结果采用不同晋级节奏。
- Player Profile 增加错误分类、评分损失和首要弱点。
- 历史派生数据加入 Mistake Mining 缓存。

## v2.6.0 — Variation Lab

### Added

- 持久化 Variation Tree，多分支手动 / AI 探索。
- 节点命名、收藏、删除、父节点 / 根节点导航和恢复。
- AI 自动扩展 A/B/C 候选并写入 Principal Variation。
- Ghost Line 2.0：候选变化线可锁定，最多 7 ply。
- AI Search Inspector 和每层 Iterative Deepening trace。

### Stability

- Variation Tree 恢复加入结构、循环、可达性与合法局面校验。

## v2.5.0 — Local AI 2.0

### Added

- 默认 WorkerAIClient 与 MainThread fallback。
- Iterative Deepening、Alpha-Beta、时间预算、战术候选优先与 Transposition Table。
- 不同 AI 难度的时间 / 深度 / 宽度预算。
- 设备自适应搜索预算。
- 外部 Worker 与 Standalone Blob Worker。

### Changed

- Counterfactual 使用更深本地搜索。
- 搜索状态增加深度、节点、耗时、缓存、战术节点和推荐手。

## v2.4.0 — Position Lab

### Added

- Position Editor：自由摆放黑 / 白棋、擦除和指定下一手。
- 从任意合法非终局局面开始 PVP / AI。
- Counterfactual Analysis：实战尝试与 AI 推荐比较。
- 自定义局面的 AI 候选分析、保存与恢复。

### Changed

- AI 候选和 AnalysisService 缓存键改为真实棋盘状态，支持没有普通 moves 历史的局面。

## v2.3.3 — Controller Foundation

- Game / Review / Branch / Training / Share 拆为独立 Controller。
- 引入 AI Client 稳定边界和 RequestGate。
- `main.js` 从约 970 行缩减到约 590 行。
- 新增真实 Chrome Smoke CI。

## v2.3.2 — Scheduling & Derived Cache

- 引入 RenderFlags / Dirty Refresh。
- DerivedService 缓存训练、画像和开局派生数据。
- ReviewView 避免自动播放时重复重建静态 DOM。

## v2.3.1 — Performance Foundation

- BoardView 改为一次初始化和增量更新。
- 引入 Position、AnalysisService 和 Storage Migration。
- 候选、Ghost Line、Heatmap 与优势分析共享缓存。

## v2.3.0

- Ghost Line、AI Personas、候选 A/B/C、优势曲线。
- 分享挑战、间隔复习与个人开局库。

## v2.2.0

- 三档 AI、热力图、可解释 AI、关键手 / 失误分析。
- What-if 分支、训练和玩家棋风统计。

## v2.1.0

- 非阻塞终局卡、终局悔棋与胜利高亮。
- 完整复盘、历史记录和未完成棋局恢复。
