# 工程架构说明

## 版本路线

- v2.0.0：模块化重构
- v2.1.0：终局、复盘、历史和持久化
- v2.2.0：本地智能分析、分支和训练
- v2.3.0：跨设备智能对弈实验室
- v2.3.1：性能与扩展基础优化
- v2.3.2：调度与扩展优化
- v2.3.3：Controller 解耦与自动浏览器回归

## v2.3.1 新基础层

### Position

`js/game/position.js` 统一表示和验证棋局：

- 稳定 position key
- 下一手计算
- 棋谱克隆
- 重复落点 / 错误轮次 / 越界 / 终局后继续落子校验

以后自由摆局、AI vs AI、反事实分析和残局导入可以复用同一局面接口。

### AnalysisService

`js/services/analysis-service.js` 位于 UI 与具体 AI 算法之间：

```text
UI / Controller
      ↓
AnalysisService
      ↓
LRU Cache
      ↓
Evaluator / Search / Heatmap / Advantage
```

候选 A/B/C、Ghost Line、热力图、优势曲线和 AI 落子共享缓存。以后替换更深搜索或 Worker 时，上层 UI 不需要直接依赖具体算法。

### BoardView

棋盘静态网格、坐标、星位和 225 个交互格只初始化一次。

之后每次刷新：

- 只修改发生变化的棋子
- 只更新 last / winner 状态
- 热力图标记做增删更新
- Ghost 使用独立持久图层
- 点击 / pointer 事件使用棋盘容器事件委托

这为以后 AnnotationLayer、自由摆局和更多棋盘覆盖层保留扩展空间。

### Storage migration

`js/storage/migrations.js` 维护 schema version。旧 v2.2/v2.3 设置可以继续读取，未来改变数据格式时可以逐版本迁移，而不是直接破坏用户历史数据。

## 性能诊断

开发时可在浏览器控制台调用：

```js
Gomoku.App.getPerformanceStats()
```

返回分析缓存命中/未命中以及棋盘 render、实际 cell 值更新次数等轻量指标。

## Web Worker

v2.3.1 暂不强制引入 Worker。原因是当前更高收益的重复计算和 DOM 重建已经先被消除，同时保留 `AnalysisService` 作为异步 Worker 客户端的未来接入点。这样避免一次性能版本同时改动算法线程模型和单 HTML 构建链路。

## 状态与扩展方向

主对局、复盘、What-if、分享挑战和训练继续隔离。新功能应优先依赖 `Position` 与 `AnalysisService`，避免直接从 UI 调用底层评分函数。

## 测试与构建

`npm test` 使用 Node 内置测试框架。

`npm run build` 根据 `index.html` 的 CSS/JS 顺序生成单文件 `dist/gomoku.html`。

## v2.3.2 调度层

### Dirty Refresh

`js/app/render-flags.js` 将 UI 刷新拆成 BOARD / STATUS / ANALYSIS / REVIEW / OVERLAYS / SETTINGS 六类。

高频操作不再默认触发整个界面刷新。例如音效开关只刷新状态区，自动复盘只刷新棋盘、分析和复盘区域。

### DerivedService

`js/services/derived-service.js` 缓存历史棋局派生结果：

- 训练题
- 玩家画像
- 个人开局库
- 间隔复习统计

训练答题只使训练统计失效，不会重复计算和重绘历史列表、画像与开局库。

### ReviewView

复盘棋谱、关键点标记和分析说明在进入一局复盘时建立一次。自动播放每一步只更新当前手、按钮状态和时间轴，不再重建整套静态 DOM。

### RequestGate

`js/services/request-gate.js` 为 AI 请求提供版本号。切换模式、悔棋或离开分支后，旧请求即使稍后返回也不能再写入当前状态。当前同步 AI 已接入该机制，未来迁移 Web Worker 时可直接沿用。


## v2.3.3 Controller 与 AI Client

主要业务逻辑从 `main.js` 拆到：

```text
js/controllers/
├── game-controller.js
├── review-controller.js
├── branch-controller.js
├── training-controller.js
└── share-controller.js
```

`main.js` 只保留依赖组装、跨 Controller 协调、统一渲染和公开 App API。新模式应优先新增独立 Controller，而不是继续向入口文件堆状态。

`js/services/ai-client.js` 提供稳定 AI 调用层。当前实现仍在主线程执行，但 Controller 只依赖 Client 接口，并通过 RequestGate 处理过期结果。未来切换 Worker 时不需要重写游戏、分支或复盘 Controller。

### 短浏览器 Smoke CI

`scripts/smoke-browser.mjs` 使用 GitHub Runner 自带 Chrome 和 DevTools Protocol，不引入 Playwright/Puppeteer 依赖。CI 自动检查：

- 225 个棋盘格正常加载
- 落子后棋盘没有被重建
- 人机模式 AI 能回应
- 自动复盘棋子会推进
- 自动复盘不会改变页面 scrollY
- 复盘静态棋谱 DOM 不在每一步重复重建
