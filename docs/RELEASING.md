# Release Process

适用于 Gomoku Web v2.8.1 及后续版本。

## 原则

发布以 `main` 为唯一稳定分支。功能、修复和工程治理均通过独立分支 + Pull Request 进入主线。

## 推荐流程

1. 从最新 `main` 创建分支。
2. 完成功能与针对性测试。
3. 更新相关文档和版本号。
4. 本地执行：
   ```bash
   npm run check
   ```
5. 创建 PR。
6. 等待 CI 完整通过：
   - Architecture lint
   - Node tests
   - Standalone build
   - Real Chrome Smoke
7. 审查 PR 相对 `main` 的变更范围。
8. 使用 squash merge。
9. 确认新的 `main` CI 成功。
10. 确认 GitHub Pages build / deploy 成功。

## 版本号

项目使用语义化版本号的基本约定：

- Major：架构或产品形态存在明显不兼容变化。
- Minor：新增大功能或大版本能力。
- Patch：修复、工程治理、文档与不改变主要产品能力的优化。

## 发布前检查

涉及以下区域时增加对应检查：

### Storage

- schema version 是否需要提升
- migration 是否覆盖旧数据
- storage tests 是否更新

### AI / Worker

- WorkerAIClient
- MainThread fallback
- stale request cancellation
- Standalone Blob Worker

### UI

- 桌面 Chrome Smoke
- 390px 手机视口
- 横向溢出
- 触控目标
- 不依赖 hover 的核心路径

### Build

- `dist/` 不进入 Git
- CI artifact 能正常生成

## 回滚

若 `main` 合并后发现真实回归：

1. 优先创建最小修复分支。
2. 不在 `main` 直接修改。
3. 修复 PR 继续经过完整 CI。
4. 只有在修复不可快速完成且影响严重时，才考虑 revert 对应 squash commit。
