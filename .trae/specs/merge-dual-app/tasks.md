# Tasks

> 基线：`.merge-tmp/A.{css,html,js}`、`.merge-tmp/B.{css,html,js}` 已由 `scripts/merge-extract.mjs`（P1）产出并通过校验。

- [x] Task 1: CSS 分层（P2）—— `scripts/merge-css.mjs` 产出 base 88 / user 60 / merchant 72 规则 + `css-conflicts.md`（同名不同值 7 条，无损双前缀）。
  - [x] 1.1 写 `scripts/merge-css.mjs`：对 A/B 两段 css 按顶层大括号健壮切块（处理多选择器、`@keyframes`/注释/引号）。
  - [x] 1.2 做选择器级 diff，三分类：同名同值→base（只留一份）、单边独有→各自私有层、同名不同值→差异报告。
  - [x] 1.3 同名不同值收 BASE 为规范值 + 分歧方 `#root-xxx` 前缀覆盖（落地为无损双前缀，避免改任一端视觉）。
  - [x] 1.4 输出 `.merge-tmp/layers.{base,user,merchant}.css` + 差异报告，抽样核对关键屏样式。

- [x] Task 2: 宿主骨架 + 模板搬移（P3）—— 并入 `scripts/build-merge.mjs`，产物 `index.html`。
  - [x] 2.1 生成 `index.html` head：CDN 去重一份 + 四层 `<style>`（layer-base/user/merchant/host）+ title/lang。
  - [x] 2.2 生成 body：`#host-bar`（双端标题+模式切换）+ `#host-main`（横向滚动并排）+ `#root-user`/`#root-merchant` 两 section，舞台下沉到 section 内 `.od-stage`。
  - [x] 2.3 将 A/B 模板逐字搬入对应 `.od-stage`，业务内容不改。
  - [x] 2.4 资源核查：扫描全文件 `src=`/`url(`，仅 `images/logo.png`（存在）+ 内部 SVG `url(#bdBody)`。

- [x] Task 3: 共享内核 + JS 隔离（P4，核心难点）—— 实测验证通过。
  - [x] 3.1 跑 A/B 顶层符号清单驱动冲突表（顶部 `const app` 冲突；sc-home/ptr-home、sc-veh 等重复 id）。
  - [x] 3.2 共享件：不需强抽（B 的 luci/ptr 在 setup 内天然隔离；directive 为 per-app 注册无害）→ 只做 root 作用域 ptr。
  - [x] 3.3 将 A/B 各自封进 `mountUser(root)` / `mountMerchant(root)` IIFE，消除 `const app` 顶部冲突。
  - [x] 3.4 history：仅 A 使用 history/popstate，无双端争抢，无需降级（保持原样）。
  - [x] 3.5 双实例常驻 `mount`，模式切换只切 CSS（hostSetMode）。

- [x] Task 4: 冲突修整与双端冒烟回归（P5）—— 浏览器实测通过。
  - [x] 4.1 逐项验证 §5 冲突清单：`const app`（隔离）、重复 id（root 作用域 ptr）、getElementById（ptr 已 root）、directive（per-app 无害）、document click（各自独立）、window error（仅 A）、body（host 接管）。
  - [x] 4.2 真实浏览器回归用户端：渲染正常，切「我的爱车」等交互正常，console 无 app 级错误。
  - [x] 4.3 真实浏览器回归商户端：渲染正常，切「车辆」等交互正常，console 无 app 级错误。
  - [x] 4.4 布局回归：双端并排/单端/切换均正常，logo/loading 正常（下拉刷新无法模拟触摸，已确认无相关报错）。

- [x] Task 5: 收尾（P6）
  - [x] 5.1 头部注释写入区块开发约定（layer-base/user/merchant/host + mountUser/mountMerchant）。
  - [x] 5.2 中间件保留策略：`.merge-tmp/` 与 `merge-extract/merge-css/build-merge.mjs` 保留（可重建 + 可对任一源重抽做同步 diff，符合 PLAN §6）；源快照 `user.html`/`merchant.html` 只读不动。

# Task Dependencies
- [Task 2]（模板/骨架）依赖 [Task 1]（CSS 分层结果注入 head）。
- [Task 3]（JS 隔离）依赖 [Task 2]（HTML/CSS 骨架就绪，可独立验收半成品）。
- [Task 4]（回归）依赖 [Task 3] 完成后双挂可跑。
- [Task 1] 与 [Task 2]、部分 [Task 3] 早期可并行（CSS 分层与模板搬移互不阻塞）。