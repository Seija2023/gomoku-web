# 五子棋 Gomoku Web

一个无需后端即可运行的 15×15 五子棋网页小游戏。支持本地 AI、复盘、局势分析、分支推演和训练，核心功能无需 API。

在线版：

```text
https://seija2023.github.io/gomoku-web/
```

当前工程版本：**v2.3.3（控制器解耦与自动回归版）**。

## v2.3.3 重点

这一版继续保持 **主要界面和功能不变**，重点完成 Controller 解耦、AI Client 抽象和短浏览器回归自动化。

- `main.js` 从约 970 行缩减到约 590 行，游戏、复盘、分支、训练和分享逻辑拆入独立 Controller
- 新增 `MainThreadAIClient`，Controller 不再直接依赖具体 AI 实现，为 Web Worker 切换预留稳定接口
- CI 新增依赖零第三方包的短 Chrome Smoke Test，自动验证棋盘、AI回应和复盘不滚屏
- 保留按区域 Dirty Refresh：棋盘、状态、分析、复盘、覆盖层和设置可独立刷新
- 自动复盘不再每一步重建完整棋谱、关键点和分析 DOM
- 历史棋局派生数据加入缓存，训练进度变化只刷新训练统计
- 新增 RequestGate，旧 AI 请求会自动失效，为未来 Worker/异步 AI 做准备
- 棋盘继续保持“一次初始化 + 增量更新”
- 225 个格子的独立事件监听改为棋盘级事件委托
- 新增统一 `Position` 局面模型与合法棋谱校验
- 新增 `AnalysisService`，统一缓存候选手、Ghost Line、热力图和优势曲线
- AI 落子可直接复用已经计算过的候选排名
- 智能分析面板跳过内容未变化时的重复 DOM 重建
- 新增 localStorage schema migration，为后续数据格式升级保留迁移入口
- 分享棋谱增加轮次、重复落点、终局后继续落子和胜者一致性校验
- 暴露轻量性能诊断：`Gomoku.App.getPerformanceStats()`
- 保持单文件离线构建、GitHub Pages 和现有本地存档兼容

## 现有功能

- 双人本地对战与人机对战
- 简单 / 普通 / 困难 AI
- 均衡 / 进攻 / 防守 / 冒险 AI 棋风
- Ghost Line：PC 悬停、手机长按拖动
- 候选 A/B/C、热力图、可解释 AI
- 优势曲线、关键手、What-if 分支复盘
- 分享棋局 / 挑战局面
- 残局训练、间隔复习、玩家画像、个人开局库
- 最近 20 局历史、终局悔棋和未完成棋局自动恢复
- 自动复盘不会主动滚动页面

## 开发检查

```bash
npm test
npm run build
npm run smoke
```

所有核心 AI、分析、训练和分享逻辑仍在浏览器本地运行。

## 规则说明

当前采用基础自由五子棋规则，不实现 Renju 的三三、四四、长连等禁手。
