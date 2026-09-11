# 合并规划：雅迪租车「用户端 + 商户端」单文件双 App

> 目标：在 `E:\test\yadea-rental-merge\` 下将两个同源单页 demo 合并为一个 HTML（单文件、双 Vue 实例、共享样式内核），后续功能开发在同一文件内分区同步进行。
> 规划编写时间：2026-09-07。状态：**已建立工程目录与源码快照，合并尚未开始**。

---

## 0. 当前进度与目录状态

```
E:\test\yadea-rental-merge\
├─ user.html      ← 用户端源码（441,597 B ≈ 3823 行）
├─ merchant.html  ← 商户端源码（593,599 B ≈ 6287 行）
├─ images\logo.png  ← 两端共用 logo（11,112 B，0x2000 归属）
└─ PLAN.md       ← 本文件
```

- 现状说明（2026-09-11 对齐）：两端源码因迭代后平铺放回根目录，`locales` 已确认不需要。无任何子目录、无 `.git`（嵌套仓库残留不存在）。
- logo：仅一份 `images\logo.png`，两端 HTML 均 `src="images/logo.png"` 引用同一文件，「共用 logo」成立，无需再做字节 diff。

## 1. 基线事实（已核实）

| 项 | 用户端 A（user.html） | 商户端 B（merchant.html） |
|---|---|---|
| 行数/大小 | ~3823 行 / 441,597 B | ~6287 行 / 593,599 B |
| 结构 | `head` 内单 `<style>` → `body` 单 `#app`（内联整段模板）→ 单 `<script>` → `app.mount('#app')` |
| 技术栈 | Vue3 full CDN + UnoCSS runtime + lucide 0.344（两文件 CDN 逐字节一致） |
| 样式 | `:root` 设计变量完全一致；共享 `od-stage` / 393×852 手机壳 / `demo-ops` 操作台 / toast / push / 转场 / 下拉刷新范式 |
| 文本 | 全中文硬编码 demo 数据，无 fetch / localStorage；**语言未接入 i18n，无语言切换逻辑** |
| 工具函数 | 双侧均定义 `luci()`、`initPullToRefresh()`、`toast()`、页面栈导航 `navOpen/navBack` |
| ⚠ 行号注意 | 文本检索与行读取的行号存在偏移（疑混合换行），文本变换一律用内容锚点 + 脚本定位，不依赖人工行号 |

## 2. 已确认决策

1. **路线**：真合并方案 B（单文件双 App + 共享内核），一次到位。
2. **展示**：默认**同屏并排**，两端各自独立操作；保留单端全屏切换能力。
3. **品牌**：两端共用 logo / 品牌元素（先做字节 diff 再落实）。
4. 源目录只读参照；合并产物落在 `E:\test\yadea-rental-merge\`（两个源快照子目录不改）。

## 3. 目标产物形态

```
index.html（合并后唯一工作文件，目标 ~1.05 MB）
├─ <head>
│  ├─ CDN ×1（Vue3 / UnoCSS / lucide，去重）
│  ├─ <style id="layer-base">      ← P2：两端同名同值规则合一份（样式规范本体）
│  ├─ <style id="layer-user">      ← 用户端私有 / 同名不同值（加 #root-user 前缀）
│  └─ <style id="layer-merchant">  ← 商户端私有 / 同名不同值（加 #root-merchant 前缀）
├─ <body>
│  ├─ <header id="host-bar">   双端标题 + 模式切换（并排 / 单端）
│  ├─ <main id="host-main">
│  │   ├─ <section id="root-user">     原 A #app 整段模板平移（保留 .od-stage）
│  │   └─ <section id="root-merchant"> 原 B #app 整段模板平移（保留 .od-stage）
│  └─ …
└─ <script>
   ├─ /* ══ SHARED CORE ══ */  luci / registerDirectives / initPullToRefresh(root 作用域)
   ├─ (function(){ function mountUser(root){ /* 原 A setup 全套，符号封闭 */ } })();
   ├─ (function(){ function mountMerchant(root){ /* 原 B setup 全套，符号封闭 */ } })();
   └─ mountUser(#root-user); mountMerchant(#root-merchant);   // 双实例常驻，切换只动 CSS
```

每一层以锚点注释分隔，作为后续开发与自动同步的物理边界。

## 4. 阶段分解

### P0 基线备份与假设校验
- 已完成：两份源码（`user.html` / `merchant.html`）落根目录、`images/logo.png` 就位；字节规模核对通过；无 `locales`。
- 决策：合并产物写至 `E:\test\yadea-rental-merge\index.html`，`user.html` / `merchant.html` 保留为只读源快照。

### P1 结构切分（脚本化，产出中间件）
- 写 `scripts/merge-extract.mjs`（Node，内容锚点 + 括号配对，不依赖行号），对 A、B 各提取：
  1. `<head>` 内 CSS 段；
  2. `#app` 配对 innerHTML（整段模板）；
  3. `<script>` 段主体。
- 输出 `.merge-tmp/{A,B}.{css,html,js}`。
- 自检：三段行数之和 ≈ 源行数；`<div>/<template>/<style>` 配对计数归零；输出锚点行号记录表。

### P2 CSS 分层
- 写 `scripts/merge-css.mjs`：按顶层大括号健壮切块（处理多选择器、`@media`/`@keyframes`/注释/引号），做选择器级 diff，三分类：
  1. 同名同值 → `layer-base`（只留一份）；
  2. 单边独有 → 各自私有层；
  3. 同名不同值 → 输出差异报告（预计个位数~几十条，如 `.is-on-warn` 色值 A=橙 B=蓝）。默认策略：收 BASE 统一为规范值 + 分歧方用 `#root-xxx` 前缀覆盖；报告人工抽查。
- 校验：合并后 css 抽样肉眼/截图核对关键屏（手机壳 / 操作台 / 表单 / toast）。

### P3 宿主外壳 + 模板搬移
- 新 body：`header` + `main`（横向滚动容器）+ 两个 `section`；原属于 body 的 flex 居中样式下沉到各 section，host body 样式极小化。
- 两段模板整体平移，业务内容一个字符不改。
- head 合并：CDN 一份；`<title>` 更新；`lang` 保留 `zh-CN`。
- 资源核查：扫描全部 `src=`/`url(` 引用（预期仅 `images/logo.png`），核对文件存在。
- 阶段性产物：CSS 层可单独验收的半成品。

### P4 JS：共享内核抽取 + 双 App 隔离（核心难点）
- 先跑顶层符号清单（`const/let/var/function` 冲突表）驱动隔离。
- A 改造（已验证证据）：`setup()` 自含状态；setup 外仅 ①顶层 `function luci` ②`window error` 监听 ③`function initPullToRefresh`（全局 `getElementById`）④两个 `app.directive`(swipe-close/long-pan) ⑤`app.mount('#app')` → 全部收进 `mountUser(root)`。
- B 改造（已验证证据）：setup 外另有大量顶层函数（`p2/now/initPillDrag/initPullToRefresh/refreshXxx/paint/initI18nData` 等）与 directive/mount → 整体收进 `mountMerchant(root)`。
- **作用域化检索**：`initPullToRefresh(root, containerId, indicatorId, onRefresh)`，内部 `root.querySelector`，消除双侧重复 id（`sc-home`/`ptr-*` 等）错位。
- **history 降级**：两端 `navOpen/navBack/navStack/popstate`（A 尾部 / B ~6140-6209 一带）默认 `useHistory=false`：`history.*` 走 if 跳过、popstate 空转，导航纯内存栈；单端全屏模式再启用。
- 业务级公共工具（`fmtRp`/校验/`fmtISO` 等）首轮**不强抽**，只抽三样公共件（luci、directives、ptr），降低误伤。
- 双实例常驻 mount，模式切换只切 CSS，保状态。

### P5 冲突修整与双端冒烟回归
- 逐项验证冲突清单（§5）。
- 双端回归（浏览器实测，console 无错）：
  - 用户端：登录、首页车与电池、租车下单全链路、扫码绑车、钱包充值/续租、我的订单/个人中心、地图找车/轨迹、下拉刷新、返回手势、demo-ops 全项（注：无语言切换，纯中文）。
  - 商户端：登录首页仪表四 tab、告警处理/忽略/关闭、订单详情/退款/续租子单、充值/退款、车辆/电池/绑定、个人中心、demo-ops 全项。
  - 布局：并排滚动、窄屏表现、logo/loading 正常。

### P6 目录资源归并与收尾
- 终态文件清单：`index.html`（合并版）、`user.html` / `merchant.html`（源快照）、`images/logo.png`。`locales` / `translation-reference.html` 因迭代不再有（不产出）。
- 删除 `.merge-tmp/` 与中间脚本（或保留至验收）。
- 把区块开发约定写入合并文件头部注释。

## 5. 已知冲突 → 处理策略（已核实）

| # | 冲突 | 证据 | 处理 |
|---|---|---|---|
| 1 | 顶层同名符号互相覆盖 | 两文件均顶层定义 `function luci` / `initPullToRefresh` 等 | 各自 IIFE 封闭 + 共享层一份 |
| 2 | 双侧 `pushState/popstate` 争抢浏览器返回 | A:3817-3826 一带；B:6140-6209 一带 | `useHistory=false` 降级纯内存栈 |
| 3 | 双侧重复 id + 全局 `getElementById` 取错 | 双侧均有 `sc-home`/`ptr-*` | ptr 等改 root 作用域 `querySelector` |
| 4 | `app.directive`（swipe-close/long-pan）双注册 | A:3841-3853 一带 | 抽 `registerShared(app)`，共享一份 |
| 5 | CSS 同名不同值（`.is-on-warn` 等色差） | 已抽查 B 偏蓝 | P2 差异报告裁决，私有层前缀覆盖 |
| 6 | `document` 级 click/mouse 监听并存 | A:3840 一带；B:4957/6132 一带 | 保留（语义无害），回归观察 |
| 7 | body 居中舞台冲突 | 双侧 body 均 flex-center | host body 接管，舞台下沉到 section |
| 8 | `window error` 监听 / 图片 / title | A:3013 一带 | 去重 / 合并 / 引用核查 |

## 6. 后续「同步开发」工作流约定

- 日常开发只改合并 `index.html`，按锚点注释分区：**通用改 `layer-base` / `SHARED CORE`；单端改对应区段**。`setup()` 闭包天然隔离，新增功能照旧写法。
- **源端再更新的兜底同步**：`merge-extract.mjs` 保留，可随时对任一端重抽 css/html/js 三块与合并文件同锚点区段做文本 diff——两端同源，差异基本可自动迁移。

## 7. 风险与工作量

- 风险：P4 符号隔离是唯一高险区（漏一行全局函数 / 封闭范围不全）；对策 = 冲突符号表驱动 + 每完成一端即用「单端半成品页」回归一次（A 独立能跑 → B 独立能跑 → 再双挂）。
- 副作用预期：仅「双端模式下物理返回键禁用」一个行为变化（UI 返回键不受影响）。
- 工作量分布：P1+P2+P3 ≈ 1/3；P4 ≈ 1/3；P5+P6 ≈ 1/3。全程脚本化、机械搬移、不改业务逻辑。

## 8. 待用户拍板事项

以下已按 2026-09-11 现场对齐（原项 1/2/4 已消解）：

1. 合并产物文件名与放置位置：确认 `index.html` 于根目录（用户已默认）。✅
2. logo：共用单一 `images\logo.png`，无需 diff。✅（原项 2 已消解）
3. `merchant\.git` 残留：实际不存在。✅（原项 1 已消解）
4. `locales/` / `translation-reference.html`：已确认不再需要，不产出。✅（原项 4 已消解）
5. 双端是否常驻 mount：**确认常驻挂载**（默认是）。✅
