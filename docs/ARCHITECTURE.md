# 工程架构说明

## 目标

v2.0.0 完成模块化重构；v2.1.0 在不破坏分层的前提下加入终局、复盘、分析和持久化能力。

## 主要模块

- `js/config.js`：棋盘尺寸、棋色、模式、方向和延时常量
- `js/core/rules.js`：边界、连续棋子、胜负判断、胜利线提取
- `js/ai/evaluator.js`：AI 候选点与棋形评分
- `js/game/game.js`：对局状态、落子、终局、悔棋、快照与恢复
- `js/game/history.js`：棋谱坐标、手数标签、指定手数棋盘重建
- `js/analysis/analyzer.js`：基础棋形节点和终局方向分析
- `js/storage/storage.js`：未完成棋局和最近 20 局历史记录
- `js/audio/audio.js`：Web Audio API
- `js/ui/board.js`：棋盘、坐标、棋子、最后一步和胜利线高亮
- `js/ui/panel.js`：模式、统计、非阻塞终局卡、历史列表
- `js/ui/review.js`：复盘控制、棋谱和分析显示
- `js/main.js`：应用控制器，协调 AI、保存、终局、复盘和 UI

## 对局数据流

```text
用户/AI落子
   ↓
Game.play()
   ↓
Rules.findWinningLine()
   ↓
更新 Game 状态
   ↓
BoardView + PanelView
   ↓
未结束 → Storage.saveCurrent()
已结束 → Storage.saveFinished()
```

## 复盘数据流

```text
moves[]
   ↓
History.boardAt(index)
   ↓
BoardView
   ↓
ReviewView（棋谱 / 控制）
   ↓
Analyzer（基础棋形分析）
```

复盘使用独立的展示状态，不修改真实对局数据，因此退出复盘后可以安全返回原棋局。

## 构建与测试

`npm test` 使用 Node 内置测试框架。

`npm run build` 按 `index.html` 中的 CSS/JS 顺序生成单文件 `dist/gomoku.html`。

GitHub Actions 会在提交和 Pull Request 时自动执行测试与构建。
