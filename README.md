# 五子棋 Gomoku Web

一个无需后端即可运行的 15×15 五子棋网页小游戏，支持双人本地对战、人机对战、音效、悔棋和响应式布局。

在线版：

```text
https://seija2023.github.io/gomoku-web/
```

当前工程版本：**v2.0.0（结构重构版）**。

## 功能

- 15×15 棋盘
- 双人本地对战
- 人机对战：玩家执黑先手，电脑执白
- AI 会优先完成五连、拦截对手五连，并根据棋形与中心位置选择落点
- 自动检测横向、纵向和两种斜向五连
- 落子、胜利和平局提示音，可关闭并保存设置
- 最后一步落子标记
- 悔棋：人机模式尽量回退一整轮“玩家 + 电脑”
- 重新开始与对局手数统计
- 桌面和手机响应式布局
- 透明棋盘交互层，避免移动端按钮背景遮挡棋盘
- 无第三方运行时依赖

## 工程结构

```text
gomoku-web/
├── index.html
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── board.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── config.js
│   ├── core/
│   │   └── rules.js
│   ├── ai/
│   │   └── evaluator.js
│   ├── game/
│   │   └── game.js
│   ├── audio/
│   │   └── audio.js
│   ├── ui/
│   │   ├── board.js
│   │   └── panel.js
│   └── main.js
├── tests/
├── scripts/
│   └── build-standalone.mjs
├── docs/
│   ├── USAGE.md
│   ├── ARCHITECTURE.md
│   └── CHANGELOG.md
├── dist/
│   └── gomoku.html
├── package.json
└── .github/workflows/ci.yml
```

设计目标是让游戏规则、AI、界面、音效和应用控制彼此解耦，后续新增难度、禁手、棋谱、PWA 或在线对战时不必继续扩张一个巨大的 `script.js`。

## 本地运行

网页没有第三方前端依赖，可以直接打开 `index.html`。也可以使用任意静态服务器运行。

单文件离线版：

```text
dist/gomoku.html
```

## 开发检查

需要 Node.js 22 或近期版本：

```bash
npm test
npm run build
```

`npm test` 会检查胜负规则、AI 必杀/必防、悔棋逻辑以及棋盘透明交互层等关键功能。`npm run build` 会从模块化源码重新生成 `dist/gomoku.html`。

## GitHub Pages

GitHub Pages 从 `main` 分支根目录发布。更新 `main` 后，Pages 会自动重新构建，在线网址保持不变。

## 规则说明

当前采用基础自由五子棋规则，不实现 Renju 的三三、四四、长连等禁手。
