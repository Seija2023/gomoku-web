# 五子棋 Gomoku Web

一个无需后端即可运行的 15×15 五子棋网页小游戏。

在线版：

```text
https://seija2023.github.io/gomoku-web/
```

当前工程版本：**v2.1.0（终局与复盘版）**。

## 主要功能

- 双人本地对战与人机对战
- 启发式 AI：优先取胜、封堵直接五连并结合棋形评分落子
- 横、竖、两种斜向五连检测
- 终局后保留最终棋盘，不再使用无法关闭的遮挡式弹窗
- 终局后仍可悔棋继续
- 获胜五连高亮
- 完整复盘：开局 / 上一步 / 下一步 / 终局 / 自动播放
- 棋谱列表与 A-O / 1-15 棋盘坐标
- 基础棋形分析：活三、四连、活四、最终五连等关键节点
- 最近 20 局历史记录，可从历史记录直接复盘
- 未完成棋局自动保存，下次打开网页自动恢复
- 落子、胜利和平局音效，可关闭并保存设置
- 最后一步标记、悔棋、重新开始、手数统计
- 桌面和手机响应式布局
- 透明棋盘交互层，避免移动端默认按钮白块遮挡
- 无第三方运行时依赖

## 工程结构

```text
gomoku-web/
├── index.html
├── css/
├── js/
│   ├── config.js
│   ├── core/rules.js
│   ├── ai/evaluator.js
│   ├── game/
│   │   ├── game.js
│   │   └── history.js
│   ├── analysis/analyzer.js
│   ├── storage/storage.js
│   ├── audio/audio.js
│   ├── ui/
│   │   ├── board.js
│   │   ├── panel.js
│   │   └── review.js
│   └── main.js
├── tests/
├── scripts/build-standalone.mjs
├── docs/
├── dist/gomoku.html
├── package.json
└── .github/workflows/ci.yml
```

规则、AI、棋谱、存储、分析、UI 与应用控制分层维护，便于后续继续增加 AI 难度、PWA、专业规则和在线对战。

## 开发检查

需要近期 Node.js：

```bash
npm test
npm run build
```

自动测试覆盖胜负判定、胜利线提取、AI 必杀/必防、终局悔棋、恢复存档、复盘棋盘重建、棋谱坐标、基础分析、历史存储以及移动端棋盘透明交互层。

## GitHub Pages

GitHub Pages 从 `main` 分支根目录发布。提交到 `main` 后，Pages 会自动重新部署，在线网址保持不变。

## 规则说明

当前采用基础自由五子棋规则，不实现 Renju 的三三、四四、长连等禁手。
