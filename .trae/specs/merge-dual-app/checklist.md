# Checklist

- [x] CSS 三语义分层正确：`layer-base` 仅一份同名同值；私有层带 `#root-xxx` 前缀；差异报告含同名不同值项（7 条，无损双前缀保留原值）。
- [x] 模板搬移逐字：`index.html` 中 `#root-user`/`#root-merchant` 内 `.od-stage` 模板与源 `.merge-tmp/A.html`、`B.html` 完全一致（含 A 固有 div +1 的保留）。
- [x] CDN 去重：`vue@3` / `@unocss/runtime` / `lucide 0.344` 各一份。
- [x] 无顶层符号冲突：顶部 `const app` 以 `mountUser/mountMerchant` 闭包隔离；luci 各端作用域隔离；`initPullToRefresh` 统一为 root 作用域。
- [x] 双实例常驻 mount：`mountUser` 与 `mountMerchant` 同时挂载，模式切换仅切 CSS，状态不重置。
- [x] 重复 id 不错位：两端均含 `sc-home/ptr-home`，ptr 改 `root.querySelector` 后各自命中自家 DOM，浏览器实测正常。
- [x] history 行为：仅 A 端使用 history/popstate，B 端不用，无双端争抢 → 未做降级，保留各自导航原样；UI 返回键正常（浏览器实测无异常）。
- [x] 用户端冒烟回归：渲染 + 切「我的爱车」等交互正常，console 无 app 级错误（纯中文）。
- [x] 商户端冒烟回归：渲染 + 切「车辆」等交互正常，console 无 app 级错误。
- [x] 布局与资源：双端并排/单端/切换均正常，logo/loading 正常，`images/logo.png` 引用解析成功（HTTP 200）。
- [x] `user.html`/`merchant.html` 未被修改（只读源快照），`index.html` 为唯一合并产物。
- [x] 头部注释含区块开发约定；`.merge-tmp` 与 `merge-extract/merge-css/build-merge.mjs` 保留为可重建中间件（符合 PLAN §6 同步工作流）。