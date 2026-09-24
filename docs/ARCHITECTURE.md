# 工程架构说明

## 版本路线

- v2.0.0：模块化重构
- v2.1.0：终局、复盘、历史和持久化
- v2.2.0：本地智能分析、分支和训练
- v2.3.0：跨设备智能对弈实验室

## v2.3 新模块

- `js/analysis/advantage.js`：逐手棋形优势指数
- `js/analysis/openings.js`：个人开局库
- `js/training/scheduler.js`：本地间隔复习调度
- `js/share/codec.js`：棋谱 URL 编解码
- `js/ui/advantage-chart.js`：响应式优势曲线
- `js/ui/board.js`：增加桌面 hover 和移动端长按/拖动 Ghost Line

## AI 数据流

```text
空交叉点
  ↓
evaluator.js
  ↓
人格权重（进攻 / 防守 / 中心）
  ↓
候选 A/B/C
  ↓
search.js
  ├─ 困难 AI 回应推演
  └─ Ghost Line 变化预览
```

必杀和必防优先级高于人格权重。

## PC / 手机交互

同一底层能力使用不同入口：

```text
Ghost Line
PC      → pointer hover
Mobile  → long press + drag

候选比较
PC      → 三栏
Mobile  → 横向滑动卡片

优势曲线
PC      → 鼠标定位
Mobile  → 手指拖动
```

## 分享

棋谱被压缩编码到 URL hash。打开 `#g=...` 进入整局复盘；打开 `#challenge=...` 进入指定局面的本地 AI 挑战。

## 状态隔离

主对局、复盘、What-if 分支、分享挑战、训练题仍使用独立状态，不相互修改原棋谱。

## 测试与构建

`npm test` 使用 Node 内置测试框架。

`npm run build` 根据 `index.html` 的 CSS/JS 顺序生成单文件 `dist/gomoku.html`。
