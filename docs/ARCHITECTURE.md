# 工程架构说明

## 版本目标

- v2.0.0：模块化重构
- v2.1.0：终局、复盘、历史和持久化
- v2.2.0：本地智能分析、分支推演和训练

## 主要模块

- `js/core/rules.js`：胜负规则和胜利线
- `js/ai/evaluator.js`：候选点、棋形评分、难度选择、可解释 AI
- `js/ai/search.js`：困难模式的一层回应推演
- `js/game/game.js`：真实对局状态、悔棋、快照和恢复
- `js/game/history.js`：棋谱坐标与任意手数棋盘重建
- `js/analysis/analyzer.js`：活三/四连/活四/五连、关键防守和明显漏防
- `js/analysis/heatmap.js`：局势热力图
- `js/training/puzzles.js`：从历史关键节点生成训练题
- `js/training/profile.js`：玩家人机历史统计和棋风摘要
- `js/storage/storage.js`：当前对局、历史记录和智能分析设置
- `js/ui/board.js`：棋盘、坐标、热力图、胜利高亮
- `js/ui/review.js`：时间轴、关键手过滤、棋谱和分析
- `js/ui/insights.js`：AI 设置、解释、训练、画像和分支状态
- `js/main.js`：普通对局 / 复盘 / 分支 / 训练四种交互状态的协调器

## 状态隔离

真实 `game` 始终保存主对局。

复盘使用只读 `review.target`；What-if 使用独立 `branchState.game`；训练使用独立的题目棋盘。分支和训练不会改写主对局或原棋谱。

## 本地 AI

```text
候选点
  ↓
必杀 / 必防检查
  ↓
进攻评分 + 防守评分 + 中心加权
  ↓
简单：较优候选随机
普通：最高启发式评分
困难：估计对手最强回应 + 己方后续价值
```

所有推理均在浏览器本地完成。

## 测试与构建

`npm test` 使用 Node 内置测试框架。

`npm run build` 根据 `index.html` 的加载顺序生成 `dist/gomoku.html`。

GitHub Actions 在 PR 和 main 更新时执行测试和构建。
