# 工程架构说明

## 目标

v2.0.0 将原先集中在 `script.js` 和 `style.css` 的代码拆分为职责清晰的模块，降低后续版本继续扩展 AI、规则、存档、PWA 和在线功能时的耦合度。

## JavaScript 模块

### `js/config.js`

集中维护棋盘尺寸、黑白棋常量、游戏模式、四个胜负方向、星位以及 AI/结果提示延时。

### `js/core/rules.js`

纯规则层，只负责边界判断、连续棋子统计、五连判断和棋盘是否已满。这里不操作 DOM，不播放音效，也不了解 AI。

### `js/ai/evaluator.js`

AI 决策层。输入棋盘和历史手数，输出一个候选落点。当前算法包括立即取胜、立即防守、棋形评分和中心位置加权。

### `js/game/game.js`

对局状态层。维护棋盘、当前行动方、历史手数、模式和 gameOver 状态，提供 `play()`、`undo()`、`reset()`、`setMode()`。

### `js/audio/audio.js`

封装 Web Audio API 和音效开关持久化。其他模块不直接操作 AudioContext。

### `js/ui/board.js`

只负责棋盘 DOM 渲染、星位、棋子、最后一步标记和透明点击区域。

### `js/ui/panel.js`

负责模式按钮、统计、当前回合、思考提示、音效状态和结果弹窗。

### `js/main.js`

应用控制器。连接 Game、AI、Audio 和 UI，管理 AI 定时器、结果弹窗定时器及用户事件。这里是浏览器入口。

## CSS 模块

- `base.css`：全局变量、字体、按钮重置、基础文本
- `layout.css`：页面、标题区、状态卡和主布局
- `board.css`：棋盘、交互点、棋子和动画
- `components.css`：侧边面板、按钮、统计、弹窗
- `responsive.css`：平板和手机断点

## 数据流

```text
用户点击
   ↓
main.js
   ↓
Game.play()
   ↓
Rules.hasWon()
   ↓
更新 Game 状态
   ↓
BoardView / PanelView 刷新
   ↓
如为 AI 回合 → AI.chooseMove() → Game.play()
```

音效由 `main.js` 在成功落子、胜利或平局后调用 `AudioManager`，不会影响规则计算。

## 构建与测试

`npm test` 使用 Node 内置测试框架测试纯逻辑模块和关键工程约束。

`npm run build` 按 `index.html` 中的 CSS/JS 顺序，将模块化源码合并成 `dist/gomoku.html`。因此 `dist` 是构建产物，不应手工维护。
