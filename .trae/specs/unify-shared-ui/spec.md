# 双端可统一项归一 Spec（unify-shared-ui）

## Why
`index.html` 已把 CDN、CSS 内核（layer-base）与 JS 公共件（luci/toastPush/ptrBind/createNav）共享完毕。但审计发现两端仍存在**可统一但未统一**的重复：颜色 token 用得不一致（硬编码 hex vs CSS 变量）、金额 locale 不一致（id-ID vs en-US）、以及大量同形态 UI 件（Modal/Sheet/Switch/Chip/Stepper）样式虽共享、标记仍各写一份。
本变更按可统一清单，把「样式/规范」先归一，再逐步把「共享 UI 件」抽成可复用的 Vue 组件，降低双端维护成本。

## What Changes
- **颜色 token 归一**：在合并产物 CSS 三层（base/user/merchant）中，把与 `--accent`(`#2B3F5F`)、`--link`(`#2F6FEB`)、`--success`(`#17A34A`)、`--danger`(`#DC2626`)、`--warn`(`#FF6A00`) 等价的裸 hex 替换为对应 CSS 变量。
- **金额 formatter 统一**：抽共享 `fmtRp(n, dec?)` 于 SHARED CORE，统一用 `id-ID` 千分位；替换两端各自的 fmtRp（A 原 id-ID、B 原 en-US）。（注意：B 端显示数字分隔符会从 en-US 变为 id-ID，属预期统一化。）
- **共享 Vue 组件**：在 SHARED CORE 增加 `registerSharedComponents(app)`（仿已有 directives 的注入方式），注册两端确有重复的控件；双端 `createApp` 各调用一次注册，随 install 复用。
  - 先期：`YdSwitch`（对应 `.od-switch`）、`YdChip`（`.od-chip`/`.demo-ops-chip`）、`YdStepper`（`.conf-stepper`）。
  - 后续：`YdModal`（确认框/动作弹层）、`YdSheet`（底部选择器：区号/日期/门店/车型）。
- **命名/懒初始化规范**：把散落的 `*PtrInit` 懒初始化标志、`demo*` 调试函数归一到统一约定（低优先级，随组件迁移顺带整理）。

## Impact
- Affected specs：用户端 UI、商户端 UI、SHARED CORE。
- Affected code：`scripts/build-merge.mjs`（含 CSS token 归一变换 + 新增 SHARED CORE 共享 formatter / registerSharedComponents）；重建产物 `index.html`；源快照 `user.html`/`merchant.html` 只读不动。
- 兼容：颜色 token 归一与 locale 统一会轻微改变两端视觉（值不变，仅表达方式变 token；商户金额分隔符变化）。组件抽取为逐组件迁移，迁移一个验收一个，不一次性全改。

## ADDED Requirements

### Requirement: 颜色 token 归一
系统 SHALL 在合并产物 CSS 中，将与设计 token 等价的裸 hex 替换为 CSS 变量，无一次性变化的离散色值残留于 base/user/merchant 三层。

#### Scenario: 同值改 token
- **WHEN** CSS 中出现 `#2B3F5F`、`#2F6FEB`、`#17A34A`、`#DC2626`、`#FF6A00`
- **THEN** 分别替换为 `var(--accent)`、`var(--link)`、`var(--success)`、`var(--danger)`、`var(--accent-2)`，且渲染结果不变。

#### Scenario: 值不变验证
- **WHEN** token 归一完成后按原逻辑渲染两端关键屏（手机壳/表单/按钮/toast/chip）
- **THEN** 视觉采样与归一前一致（色值解析后相同）。

### Requirement: 共享金额 formatter
系统 SHALL 提供单一共享 `fmtRp(n, dec?)`，两端统一以 `id-ID` 千分位渲染金额。

#### Scenario: 双端金额一致
- **WHEN** 商户端与用户端渲染同一金额
- **THEN** 使用同一 `fmtRp` 与 `id-ID`，分隔符与舍入一致。

### Requirement: 共享 Vue 组件注册
系统 SHALL 在 SHARED CORE 提供 `registerSharedComponents(app)`，把两端可复用的 UI 件注册为 Vue 组件，双实例各自调用来复用同一套组件定义。

#### Scenario: 控件复用
- **WHEN** 某端模板使用 `<YdSwitch>`/`<YdChip>`/`<YdStepper>`（后续含 `<YdModal>`/`<YdSheet>`）
- **THEN** 组件样式来自共享层、行为由组件自身管理，不再在该端重复内联实现。

## MODIFIED Requirements
（无既有 spec 修改；本变更为新增。）

## REMOVED Requirements
（无。源只读，仅收敛产物 index.html 的内部表达。