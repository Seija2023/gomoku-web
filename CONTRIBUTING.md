# Contributing

感谢你参与 Gomoku Web。

## 开发原则

本项目保持纯前端、本地优先和零运行时后端依赖。提交改动时请遵守以下边界：

- `js/core/` 与 `js/game/` 不依赖 UI。
- `js/ai/` 只负责 AI 算法与 Worker runtime。
- UI / Controller 不直接调用底层搜索算法；通过 `js/services/` 的稳定接口访问。
- Controller 不直接操作 DOM。
- `localStorage` 仅由 `js/storage/` 管理。
- 新的特殊模式通过 Workspace / Workflow 接入，不在 `main.js` 堆叠模式布尔判断。
- 不提交 `dist/`；Standalone 由构建和 CI 生成。

## 本地检查

需要 Node.js 22 或兼容版本。

```bash
npm test
npm run lint
npm run build
npm run smoke
```

也可以一次执行：

```bash
npm run check
```

## 修改流程

1. 从最新 `main` 创建功能或修复分支。
2. 尽量让每次改动保持单一目的。
3. 为新逻辑补充针对性单元测试。
4. 涉及 UI / 状态流时更新真实浏览器 Smoke。
5. 提交 PR 前执行 `npm run check`。
6. PR 通过 CI 后再合并。

## Commit / PR

推荐使用简洁的 Conventional Commit 风格：

- `feat:` 新功能
- `fix:` 修复
- `refactor:` 重构
- `test:` 测试
- `docs:` 文档
- `chore:` 工程治理

PR 应说明：改动目标、关键设计、测试范围以及是否影响存储兼容性、Worker、Standalone 或移动端。

## 生成物

`dist/gomoku.html` 是构建产物，不纳入源码版本控制。CI 会执行 `npm run build` 并上传 Standalone artifact。
