# 五子棋 Gomoku Web

一个无需后端即可运行的 15×15 五子棋网页小游戏。支持本地 AI、复盘、局势分析和训练，GitHub Pages 可直接部署，核心功能无需 API。

在线版：

```text
https://seija2023.github.io/gomoku-web/
```

当前工程版本：**v2.2.0（智能分析与训练版）**。

## 主要功能

- 双人本地对战与人机对战
- AI 难度：简单 / 普通 / 困难
- 困难 AI 使用候选点筛选和一层回应推演
- 可解释 AI：显示主要落子原因、进攻/防守价值和候选点
- 黑棋 / 白棋 / 综合局势威胁热力图
- 关键手与明显失误检测
- 复盘时间轴与“只看关键手”
- What-if 分支复盘：从任意未结束复盘节点尝试新走法，再与本地 AI 继续推演
- 自动从历史棋局生成残局训练题
- 玩家棋风统计：人机胜负、平均手数、中心落子率、关键进攻/防守和明显失误
- 终局后保留最终棋盘，支持悔棋、复盘、再来一局
- 获胜五连高亮、棋谱、坐标、历史记录和未完成棋局自动恢复
- 自动复盘不会主动滚动页面，棋盘可始终留在视野中
- 响应式手机布局和透明棋盘交互层
- 无第三方运行时依赖

## 工程结构

```text
js/
├── ai/
│   ├── evaluator.js
│   └── search.js
├── analysis/
│   ├── analyzer.js
│   └── heatmap.js
├── training/
│   ├── puzzles.js
│   └── profile.js
├── game/
├── storage/
├── audio/
├── ui/
│   ├── board.js
│   ├── panel.js
│   ├── review.js
│   └── insights.js
└── main.js
```

## 开发检查

```bash
npm test
npm run build
```

测试覆盖胜负规则、AI 必杀/必防、三档难度、AI 解释、热力图、关键手分析、复盘、训练题、玩家画像、存储以及移动端棋盘透明交互层。

## GitHub Pages

GitHub Pages 从 `main` 分支根目录发布。核心 AI 和分析均在浏览器本地运行，不需要 OpenAI、DeepSeek 或其他云端 API。

## 规则说明

当前采用基础自由五子棋规则，不实现 Renju 的三三、四四、长连等禁手。
