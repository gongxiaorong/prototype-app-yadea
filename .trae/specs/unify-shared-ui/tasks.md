# Tasks

> 基线：`index.html` 已在 HEAD（共享内核已完成）。本变更在 `scripts/build-merge.mjs` 装配层实现，重建 `index.html`；源快照只读。`.merge-tmp` 为可重建中间层（Workflow：merge-extract → merge-css → build-merge）。

- [x] Task 1: 颜色 token 归一（样式规范，低风险）—— 完成并浏览器验证。
  - [x] 1.1 在 build-merge 的 CSS 组装后加 token 归一变换：`#2B3F5F→var(--accent)`、`#2F6FEB→var(--link)`、`#17A34A→var(--success)`、`#DC2626→var(--danger)`、`#FF6A00→var(--accent-2)`（对 base/user/merchant 三层统一处理；保护 `:root` 定义处避免自我引用）。
  - [x] 1.2 自检：`.demo-ops-chip.is-on-warn`/ptr-spinner/品牌 mark 等已变 `var()`，渲染值不变。
  - [x] 1.3 7 条同名不同值核查：部分（login-submit.is-on/ptr-spinner/login-brand-mark）因 token 收敛变值等价，仅在输出中保留双前缀属冗余但无害；`.is-on-warn` 仍真分歧（accent-2 vs link）维持 `#root-xxx`。

- [x] Task 2: 金额 formatter 统一（locale）—— 完成并浏览器验证。
  - [x] 2.1 SHARED CORE 注入共享 `function fmtRp(n, dec?){ ... id-ID 千分位 ... }`。
  - [x] 2.2 替换 A/B 端各自 `function fmtRp(...)`（删除重复定义），两端经共享 fmtRp 渲染。
  - [x] 2.3 商户端金额现走 id-ID（与用户端一致）；浏览器实测两侧一致。
  - [ ] 2.4 （备注）商户首页 `今日收款 Rp 3,240` 为硬编码静态演示串，未走 fmtRp，属可后续顺手归一（非回归）。

- [ ] Task 3: 共享 Vue 组件注册 —— **回退未落地**（拦阻：DOM 模板限制）。
  - [ ] 3.1 SHARED CORE 注入 `registerSharedComponents(app)` 注册 YdSwitch/YdChip/YdStepper —— 已实现但**运行不可用**，已回退。
  - [ ] 3.2 双端 `createApp` 后各调用一次 —— 已回退。
  - [ ] 3.3 实测：`<YdSwitch/>`（自闭合）、`<YdSwitch>`（大写）、`<yd-switch>`（kebab）在 DOM 单文件模板中均无法被运行时解析为全局组件，落成空自定义元素 `<ydswitch>`（浏览器小写化 + 名称解析失败），并处现 `SyntaxError`。结论：**该单文件架构（挂载元素 innerHTML 作 DOM 模板）不适用全局注册组件**，需改用 JS 字符串模板/构建期编译才能可靠复用。

- [ ] Task 4: 组件迁移 —— **随 Task 3 回退，整体未落地**（受同一 DOM 模板限制）。
  - [ ] 4.1 商户 `.od-switch` → `<yd-switch>` —— 回退。
  - [ ] 4.2 `.od-chip`/`.demo-ops-chip` 迁移 —— 未做（.od-chip 无模板用法；demo-ops-chip 变体多）。
  - [ ] 4.3 用户 `.conf-stepper` → `<yd-stepper>` —— 回退。
  - [ ] 4.4 `<YdModal>`/`<YdSheet>` —— 未做。
- 注：组件抽取已回退还原为原生 `.od-switch`/`.conf-stepper` 直写（浏览器验证可用），不影响功能。若后续要把两端 UI 件组件化，需先迁移模板为字符串模板/构建期编译再议。

# Task Dependencies
- [Task 2] 完成；[Task 3]/[Task 4] 受 DOM 模板限制整体回退，记拦阻结论。