# Development Guide

## 环境

- Node.js 22
- 任意现代 Chromium 浏览器
- 不需要后端服务、API Key 或外部数据库

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm test` | Node 单元、结构与语法测试 |
| `npm run lint` | 架构边界与仓库结构检查 |
| `npm run build` | 生成 `dist/gomoku.html` |
| `npm run smoke` | 真实 Chrome 用户链回归 |
| `npm run check` | 完整质量门禁 |

## 目录职责

```text
js/
├─ app/          应用状态、会话流程、渲染协调
├─ core/         最底层规则
├─ game/         棋局与局面模型
├─ ai/           搜索、估值、Worker runtime
├─ analysis/     棋局分析算法
├─ services/     稳定服务边界与 AI Client
├─ controllers/  用户动作与业务状态
├─ training/     自适应训练领域
├─ lab/          变化树实验室领域
├─ storage/      localStorage 与 schema migration
├─ platform/     浏览器平台能力适配
├─ share/        分享数据编码
├─ audio/        Web Audio 行为
└─ ui/           DOM View
```

## 依赖方向

推荐方向：

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

应用级协调由 `WorkspaceManager`、`SessionWorkflow` 与 `RenderCoordinator` 负责。新功能不要绕过这些边界直接在 `main.js` 建立新的平行状态系统。

## 存储兼容

所有持久化格式变更必须：

1. 更新 `js/storage/migrations.js` 的 schema version。
2. 为旧数据提供向前迁移。
3. 增加或更新 `tests/storage.test.js`。
4. 不假设 localStorage 一定可用。

## Worker 与 Standalone

普通网页默认使用外部 Web Worker。Standalone 构建会把 Worker 依赖拼接为 Blob Worker 源码，因此修改 Worker 依赖时同时检查：

- `scripts/build-standalone.mjs`
- `tests/worker-ai-client.test.js`
- `scripts/smoke-browser.mjs`

## UI 回归

核心 UI 不依赖 hover。涉及界面时至少验证桌面和 390px 手机视口，并确保棋盘初始化、滚动位置、触控目标和横向溢出没有回归。
