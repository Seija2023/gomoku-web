# Architecture

本文描述 **Gomoku Web v2.8.1** 的当前工程架构。历史版本变化见 [CHANGELOG.md](./CHANGELOG.md)。

## 设计目标

项目坚持以下约束：

- **Local-first**：核心对局、AI、分析、训练和历史均在浏览器本地完成。
- **零后端依赖**：运行不需要 API Key、服务器或数据库。
- **可离线构建**：支持生成单文件 Standalone。
- **明确分层**：UI、业务流程、服务、领域模型与算法相互隔离。
- **渐进扩展**：新模式通过 Workspace / Workflow 接入，不在入口文件堆叠平行状态。
- **兼容存储**：localStorage 格式变化通过 schema migration 向前迁移。

## 目录结构

```text
js/
├─ app/          应用状态、会话流程、渲染协调与启动保护
├─ core/         最底层规则
├─ game/         Game / Position / EditablePosition / History
├─ ai/           估值、搜索、Worker runtime
├─ analysis/     优势、热力图、棋局分析、开局统计
├─ services/     AI Client、分析服务、派生缓存、反事实服务
├─ controllers/  用户动作与业务状态
├─ training/     错误分类、Mistake Miner、自适应训练与调度
├─ lab/          Variation Tree 与实验室流程
├─ storage/      localStorage、schema migration
├─ platform/     浏览器平台能力适配
├─ share/        分享数据编码 / 解码
├─ audio/        Web Audio 行为
└─ ui/           DOM View
```

## 依赖方向

主要依赖方向：

```text
UI
 ↓
Controller / Workflow
 ↓
Service
 ↓
Domain / Analysis / AI
 ↓
Core
```

应用层允许协调多个下层对象，但下层模块不反向依赖 UI。

### 强制边界

CI 中的 `scripts/lint-architecture.mjs` 自动检查：

- Controller / Domain / Training / Lab 不直接操作 DOM。
- `localStorage` 只允许出现在 `js/storage/`。
- `G.AISearch` 只允许由 `js/ai/` 与 `js/services/` 直接访问。
- `main.js` 不允许重新引入 `state.active` 模式判断。
- `main.js` 保持在约定的 bootstrap 体量以内。
- 生成目录 `dist/` 不进入版本控制。
- README / Architecture / Changelog / Usage 必须与 package version 同步。

浏览器特有能力如系统分享和 Clipboard fallback 放在 `js/platform/`，避免 Controller 直接依赖 DOM。

## App 层

### WorkspaceManager

`js/app/workspace-manager.js` 是特殊模式的统一状态入口。

Activity：

- GAME
- REVIEW
- BRANCH
- TRAINING
- POSITION_EDITOR
- VARIATION

用户可选择的主工作区：

- 对局
- 分析
- 训练
- 实验室

特殊 Activity 激活时，WorkspaceManager 决定有效工作区并阻止冲突切换。

### SessionWorkflow

`js/app/session-workflow.js` 负责：

- 重开
- PVP / AI 模式切换
- 进入 / 退出复盘
- 分享挑战
- Position Editor 会话
- 从特殊模式恢复原对局

它避免这些跨 Controller 的状态切换重新堆回 `main.js`。

### RenderCoordinator

`js/app/render-coordinator.js` 集中决定：

- 当前显示哪个 Position
- 棋盘是否锁定
- 当前分析玩家
- Ghost Line 是否可用
- Heatmap / Candidate / Review / Overlay 的区域刷新
- Workspace UI 状态

区域刷新通过 `RenderFlags` 降低无关 DOM 更新。

### BootGuard

`js/app/boot-guard.js` 在 classic-script 架构下显式检查关键模块是否已经加载。脚本顺序损坏时，启动阶段会直接给出缺失依赖，而不是运行到任意路径才出现 `undefined`。

## Domain

### Position

`js/game/position.js` 是局面与棋谱合法性的统一基础，负责：

- board / move 表达
- stable position key
- 下一手计算
- 棋谱克隆
- 重复落点、越界、错误轮次和终局后落子校验

### Game

`js/game/game.js` 管理实际对局生命周期，包括普通棋局和自定义起始局面。

### EditablePosition

`js/game/editable-position.js` 支撑 Position Editor，不通过伪造正常棋谱表示任意摆局。

### VariationTree

`js/lab/variation-tree.js` 是独立 Domain Model，支持多分支节点、重建局面、序列化、恢复、循环与损坏结构校验。

## AI 与分析

### AnalysisService

`js/services/analysis-service.js` 隔离 UI / Controller 与底层评分算法，并为候选、Ghost Line、Heatmap 等提供缓存。

### AIClient

上层只依赖 AI Client 接口：

```text
Controller / Workflow
        ↓
     AIClient
      ├─ WorkerAIClient   默认
      └─ MainThreadAIClient fallback
```

`WorkerAIClient` 负责 Worker 生命周期、请求取消、fallback、设备预算和 Search Trace。旧请求通过 RequestGate 防止写回新状态。

### Search

`js/ai/search.js` 提供本地搜索核心：

- Iterative Deepening
- Alpha-Beta
- 时间预算
- 候选限制与 move ordering
- 战术优先
- Transposition Table
- Principal Variation
- Search telemetry

Search Inspector 展示搜索行为，但“推荐稳定度”不是胜率。

## Adaptive Training

训练链：

```text
History
  ↓
MistakeMiner
  ↓
Error Taxonomy
  ↓
Puzzles
  ↓
AdaptiveTraining Planner
  ↓
TrainingController / Workflow
  ↓
Spaced Repetition
```

DerivedService 缓存历史派生数据，避免历史未变化时重复计算 Mistake Mining、画像与开局统计。

## Storage

所有 localStorage 访问集中在：

- `js/storage/migrations.js`
- `js/storage/storage.js`

当前 schema：**5**。

schema 5 将旧的独立 `gomoku-sound` 设置迁移进统一 settings，并删除旧 key。

任何持久化结构变化都必须：

1. 提升 schema。
2. 编写向前迁移。
3. 更新 storage tests。
4. 保持 localStorage 不可用时的安全降级。

## UI

BoardView 采用：

- 225 格只初始化一次
- 容器级事件委托
- 增量棋子更新
- 独立 Ghost / Heatmap / Comparison layer

主界面使用四工作区降低信息密度。移动端核心操作不依赖 hover，Smoke 会检查 390px 视口无横向溢出与触控目标。

## Build

网页源码仍采用 classic scripts + `window.Gomoku` 命名空间。当前不强制全面 ESM 化，因为现有构建同时服务：

- GitHub Pages
- 外部 Web Worker
- 单文件 Standalone
- Blob Worker fallback

`npm run build` 读取 `index.html` 中的 CSS / JS 顺序，生成：

```text
dist/gomoku.html
```

`dist/` 是生成物，不进入 Git。CI 构建后以 artifact 形式发布。

## Quality Gates

本地完整检查：

```bash
npm run check
```

顺序为：

1. Architecture lint
2. Node test suite
3. Standalone build
4. Real Chrome Smoke

Smoke 同时覆盖正常网页 Worker 和 Standalone Blob Worker，并验证主要桌面 / 手机用户链。

## 扩展规则

增加新功能时优先判断它属于：

- Domain
- Service
- Controller
- Workflow
- View
- App coordination

不要直接把新状态、DOM 操作或底层 AI 调用塞进 `main.js`。

当 classic-script 依赖管理成为主要维护成本，或源码规模继续显著增长时，再评估 ESM + bundler 迁移；在此之前保持当前零依赖构建链稳定。
