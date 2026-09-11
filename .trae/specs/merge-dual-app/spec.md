# 单文件双 App 合并（雅迪租车用户端+商户端）Spec

## Why
当前 `user.html`（3823 行）与 `merchant.html`（6287 行）是两套同源单文件 Vue3 demo，各自独立运行。目标合并为**单个 `index.html`**：一份共享样式内核 + 两个常驻 Vue 实例，默认并排展示、可切单端全屏，便于后续在同一文件内分区同步开发。

## What Changes
- 新增合并产物 `E:\test\yadea-rental-merge\index.html`（目标 ~1.05MB），`user.html`/`merchant.html` 保留为只读源快照。
- head：CDN（vue3 / @unocss/runtime / lucide 0.344）去重为一份；`<style>` 按三语义分层 `layer-base` / `layer-user` / `layer-merchant`。
- body：宿主 `#host-bar`（双端标题+模式切换）+ `#host-main`（并排滚动）+ 两个 `section#root-user` / `#root-merchant`，原两端 `#app` 内模板逐字搬入；`od-stage`/`393×852` 手机壳等舞台样式从 body 下沉到各 section。
- `<script>`：抽出共享内核（`luci` / 共享 directives / 根作用域 `initPullToRefresh`）后，两个 IIFE 分别封闭两端 setup 全套并常驻 `mount`，模式切换只切 CSS。
- 冲突处置：双侧顶层同名符号各自 IIFE 封闭；`pushState/popstate` 降级为纯内存栈（`useHistory=false`）；重复 id + 全局 `getElementById` 改 root 作用域 `querySelector`；`app.directive`(swipe-close/long-pan) 共享一份；疑问 CSS 同名不同值由私有层 `#root-xxx` 前缀覆盖并出报告人工抽查。
- 语言：纯中文硬编码，**不接入 i18n**；不产出 `locales` / `translation-reference.html`。
- 资源：仅 `images/logo.png`（两端口径一致，共用），归并后唯一。

## Impact
- Affected specs：`user` 端功能、`merchant` 端功能、共享 UI 内核（手机壳/操作台/toast/下拉刷新范式）。
- Affected code：`scripts/merge-extract.mjs`（P1 已用，保留供同步 diff）；新增 `scripts/merge-css.mjs`、`scripts/build-merge.mjs`；产物 `index.html`；源快照 `user.html`/`merchant.html` 只读。
- 行为副作用：仅「双端并排模式下物理返回键禁用」一项（UI 返回键不受影响）。

## ADDED Requirements

### Requirement: 单文件双 Vue 实例常驻
系统 SHALL 在单个 `index.html` 内同时挂载用户端与商户端两个 Vue 实例，二者常驻运行，模式切换只切换 CSS 显示而不卸载实例（保留各自内存状态）。

#### Scenario: 并排/单端切换不丢状态
- **WHEN** 用户把某端子流程做到一半（如订单表格结账页）
- **THEN** 切换到另一端再切回时，该子流程页面与中间状态原样保留，不重置。

### Requirement: 三语义 CSS 分层
系统 SHALL 将两端样式按规则块切块并做选择器级 diff，分为 `layer-base`（两端同名同值，仅一份）/ `layer-user` / `layer-merchant`（单边独有或同名不同值，用 `#root-xxx` 前缀隔离）。

#### Scenario: 同名不同值裁决
- **WHEN** 某选择器两端值不同（如 `.is-on-warn` 色值）
- **THEN** 合并结果以 BASE 规范值为准，分歧端用 `#root-xxx` 私有层前缀覆盖，并在差异报告中罗列供抽查。

### Requirement: 共享内核 + 双端隔离
系统 SHALL 抽取共享件（`luci`、共享 directives、根作用域 `initPullToRefresh`）为一份，其余两端业务符号各自封闭在独立 IIFE 内，杜绝顶层符号互相覆盖。

#### Scenario: 全局函数不互相覆盖
- **WHEN** 两端历史上都有顶层同名函数（如 `luci`/`initPullToRefresh`）
- **THEN** 合并后仅共享层一份定义，两端各自调用不受对方干扰。

#### Scenario: 重复 id 不错位
- **WHEN** 两端存在同名 `id`（如 `sc-home`/`ptr-*`）
- **THEN** 涉及全局取 DOM 的代码改用各自 `root.querySelector`，互不误取。

### Requirement: 双端冒烟回归
系统 SHALL 在合并后于真实浏览器跑通两端核心链路，console 无报错。

#### Scenario: 用户端全链路
- **WHEN** 依次执行登录、首页车与电池、租车下单、扫码绑车、钱包充值/续租、订单/个人中心、地图/轨迹、下拉刷新、返回手势、demo-ops 全项
- **THEN** 全部可用且无 console 错误（纯中文，无语言切换）。

#### Scenario: 商户端全链路
- **WHEN** 依次执行登录首页仪表四 tab、告警处理/忽略/关闭、订单详情/退款/续租子单、充值/退款、车辆/电池/绑定、个人中心、demo-ops 全项
- **THEN** 全部可用且无 console 错误。

### Requirement: 布局与资源正确
系统 SHALL 在并排/单端/窄屏三种视图下正确渲染，logo 与 loading 正常，资源引用（`images/logo.png`）解析成功。

## MODIFIED Requirements
（无既有 spec 被修改；本变更全部为新增。）

## REMOVED Requirements
### Requirement: 两套独立源文件直接运行
**Reason**: 目标由「两个独立 demo 文件」演进为「单文件双 App」。
**Migration**: `user.html`/`merchant.html` 保留为只读源快照，作为单一 `index.html` 的参照源；已用 `scripts/merge-extract.mjs` 支持对任一源重抽分段做同步 diff。