---
name: bottom-sheet-unification
overview: 全项目（index.html 租赁用户端+商户端共 32 个）底部弹窗抽公共组件统一规范：Sheet 基础壳（遮罩/圆角/头部/把手下滑关闭/安全区/z-index 刻度）+ OptionSheet/WheelDateSheet/ActionSheet/FormSheet 等子组件，max-height 默认 60%（4 个长表单例外），输出规范不一致清单与统一规范并分批改造回归。
todos:
  - id: sheet-kit-shared
    content: 在 SHARED CORE 新增 registerSheetKit(app)：BottomSheet 壳（把手下滑关闭 + 头部 A/B 型 + 安全区）、OptionSheet、v-sheet-drag 指令、.sheet-* 样式 token（含 max-height sm=60%/lg、z-index 刻度、合并三套滚动类），两端 mount 前各调用一次
    status: in_progress
  - id: sheet-spec-doc
    content: 将 32 个弹窗的 7 维度规范不一致清单与统一规范写入 AGENTS.md「底部弹窗规范」章节
    status: pending
  - id: user-batch1
    content: 用户端样板迁移：租赁类型/租赁方案 → OptionSheet，联系门店 → BottomSheet 号码列表，csSheet 居中弹窗改 OptionSheet（同数据同呈现），保留 closeXxx 单一出口
    status: pending
    dependencies:
      - sheet-kit-shared
  - id: user-batch2
    content: 用户端其余迁移：showDocSheet/showRenewPlan/showPayment(lg)/showIdPicker/showIdAction/walletStoreSheet/trackTimePicker，逐个核对内部结构后替换模板
    status: pending
    dependencies:
      - sheet-kit-shared
      - user-batch1
  - id: merchant-batch1
    content: 商户端迁移：userPick/orderPick/veh 与 batt 的 ModelSheet+FS/roShowFS/pkgPicker/uBindMod/钱包操作/showManualInput/roRefundMod
    status: pending
    dependencies:
      - sheet-kit-shared
  - id: merchant-wheel
    content: 商户端 roDatePicker 与 ordersDatePicker 合并为 WheelDateSheet（消除约 55 行重复），并让用户端/商户端 trackTimePicker 复用滚轮组件
    status: pending
    dependencies:
      - sheet-kit-shared
  - id: regression
    content: "[mcp:Playwright MCP Server] 双端全量回归：各弹窗打开/选中/关闭/下滑关闭/长列表滚动实测，console 0 错误，样式与规范逐项比对"
    status: pending
    dependencies:
      - user-batch2
      - merchant-batch1
      - merchant-wheel
---

## 需求

对 `index.html`（租赁项目：用户端 + 商户端，共 32 个底部弹窗）执行全项目底部弹窗治理：

1. **产出规范不一致清单**（7 维度：触发方式、弹窗结构、样式规范、动画、交互逻辑、文案格式、组件复用），并给出统一规范（已与用户对齐取值）。
2. **按已确认决策实施组件化改造**：

- 抽公共组件：新增 `BottomSheet` 壳组件与 `OptionSheet` / `WheelDateSheet` 等业务组件，32 个弹窗收敛为约 8 个模板实例；
- `max-height` 默认 **60%**，超出内部滚动；长表单例外（续租方案、支付、退款、支付拆分）可配置更高档位；
- 把手**保留**并实现**下滑关闭**（复用项目已有 swipe-close 手势思路）。

3. 范围：仅 `index.html`；`swap.html` 经检索不含底部弹窗，不在范围。
4. 规范与不一致清单落盘到 `AGENTS.md`「底部弹窗规范」章节，防止后续新增弹窗再次漂移。

## 已确认的统一规范取值

- 遮罩：`rgba(0,0,0,.4)`，`@click.self` 关闭，z = 面板 − 1
- 面板：`absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] flex flex-col`，`max-height:60%`（默认）/ `lg` 档（长表单），`padding-bottom:max(24px,env(safe-area-inset-bottom))`
- 头部：A 型 = 居中 `17px semibold`（`pt-6 pb-5`）+ 右上角 X；B 型 = `取消 | 居中标题 | 确定`（草稿确认类）
- 列表：`px-4 pb-1 flex flex-col gap-[10px]`；行 `w-full py-3.5 rounded-xl text-center text-[15px]`，未选中 `#F6F7F9`/`#111`，选中 `var(--accent)` 底 + 白字加粗
- 关闭：每个弹窗单一 `closeXxx()` 出口，上下文复位只在出口内做
- z-index 刻度：600（页面浮层）/ 900（业务表单）/ 2000（流程型）/ 2500（全局），面板 = 遮罩 + 1
- 动画：仅 `.fd`（遮罩）+ `.sh`（面板）

## 技术方案

### 架构约束（项目为无构建单文件双 Vue App）

- `index.html` = Vue3 CDN 全局构建 + 模板内联，无构建步骤 → 组件用**全局组件 + template 字符串**实现，不能用 SFC/`<script setup>`。
- 双实例：`mountUser(#mount-user)` / `mountMerchant(#mount-merchant)` 各自 `Vue.createApp` → 在 SHARED CORE 增加 `registerSheetKit(app)`，两端 mount 前调用一次，实现一套组件两端可用。
- **状态 ref 全部保留不变**（`showDocSheet/showRenewPlan/...`），只替换模板为组件调用；`paint()` 的 watch 列表与 `createNav` 的 `_navR` 快照因此不受影响，回归风险最小。

### 新增共享件（SHARED CORE）

| 件 | 职责 |
| --- | --- |
| `registerSheetKit(app)` | 注册组件与指令的统一入口，两端各调用一次 |
| `<BottomSheet>` 壳组件 | 遮罩（fd）+ 面板（sh）+ 把手（下滑关闭）+ 头部 A/B 两型 + 安全区 + 具名插槽 `default/footer`；props：`open`、`title`、`type(A/B)`、`size(sm=60%/lg)`、`maskZ`；emit `close`、`confirm` |
| `<OptionSheet>` | 基于 BottomSheet 的单选列表：`:options`（统一 `{value,label}[]`）、`v-model` 选中、`@select`；承载租赁类型/方案、联系门店、各筛选弹窗 |
| `<WheelDateSheet>` | 合并商户端两个逐字重复的滚轮日期弹窗（消除约 55 行重复）；复用既有 `.track-wheel-*` 样式 |
| `v-sheet-drag` 指令 | 把手/面板向下拖拽超过阈值（约 80px）触发 `close` 回调；参考既有 `v-swipe-close` 的手势实现，两端共用 |
| `.sheet-*` 样式 token | `.sheet-mask/.sheet-panel/.sheet-handle/.sheet-scroll`；合并 `.hide-scroll`/`.hid`/`.conf-scroll-hide` 三套同义类 |


### 迁移策略（分批，每批迁移后立即回归）

- 批次顺序：共享件 → 用户端样板 3 个 → 用户端其余 7 个 → 商户端 11 个 → 商户端滚轮日期合并 → 文档化 → 全量回归。
- 迁移每个弹窗前用 code-explorer 核对该弹窗内部 DOM 结构与绑定（插槽/头部型别/滚动容器/关闭路径），避免漏迁内容。
- 长表单例外（`size="lg"` ≈ 92%）：续租方案(2010)、支付(2090)、退款(5131)、支付拆分(5190)。
- `csSheet`（785 行，`fixed z-[9999]` 居中弹窗，与联系门店同源 `csList` 数据）一并改为 `OptionSheet` 底部弹窗，消除"同数据两种呈现"。

### 性能与风险

- 组件化后模板实例 32 → 约 8，重复 DOM/样式减少；无运行时新增依赖。
- 高风险点：滚轮组件的 `@scroll` 逻辑迁移（需保留 ref 与滚动吸附）、`paint()` 原型面板标注依赖 `data-page-node-id`（组件需透传 attrs）。
- 兜底：组件迁移只动模板与新增共享件，不触碰业务 ref 与 nav 体系；任一批回归失败可单独回滚该批模板。

```mermaid
graph TD
  A[registerSheetKit app] --> B[BottomSheet 壳]
  A --> C[v-sheet-drag 指令]
  A --> D[.sheet-* 样式 token]
  B --> E[OptionSheet 单选列表]
  B --> F[WheelDateSheet 滚轮日期]
  E --> G[用户端 10 个]
  F --> H[商户端 22 个]
  G & H --> I[32 → 约 8 个模板实例]
```

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 逐个核对 32 个底部弹窗的内部 DOM 结构、绑定、关闭路径与滚动容器，输出迁移清单，避免迁移时漏内容
- Expected outcome: 每个弹窗一张"头部型别/插槽内容/滚动容器/关闭出口"核对表，作为迁移依据

### MCP

- **Playwright MCP Server**
- Purpose: 每批迁移后用 file:// 打开页面做双端回归（注意原型操作面板的 登录状态/押金状态 开关会改变页面形态）
- Expected outcome: 每批 console 0 错误、关键弹窗样式（圆角/遮罩/间距/选中态/60% 封顶与内部滚动）实测通过