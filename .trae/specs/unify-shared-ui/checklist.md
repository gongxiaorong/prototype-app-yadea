# Checklist

- [x] 颜色 token 归一：base/user/merchant 三层与设计 token 等价的裸 hex 已改 `var(--accent/--link/--success/--danger/--accent-2)`，`:root` 定义处保留；浏览器实测渲染色值不变（`.is-on-warn`/ptr-spinner/品牌 mark 已变 token）。
- [x] 7 条同名不同值：部分因 token 收敛变值等价（login-submit.is-on/ptr-spinner/品牌 mark，输出保留双前缀属冗余无害）；`.is-on-warn` 仍真分歧维持 `#root-xxx`。
- [x] 金额 formatter：两端共用同一共享 `fmtRp`，统一 `id-ID`；浏览器实测两侧金额显示一致。
- [x] 浏览器实测（组件回退后）：双端渲染、Tab 切换、导航、toast、host 三态正常；console 无应用级 error（之前的 SyntaxError 已随组件回退消失）。
- [x] `user.html`/`merchant.html` 未被修改；`index.html` 仍为唯一产物，可经脚本一键重建。
- [ ] （拦阻记录，未落地）共享 Vue 组件 `registerSharedComponents` / `YdSwitch`/`YdChip`/`YdStepper` 注册与迁移：**已回退**。经三类标签写法实测，DOM 单文件模板无法运行时解析全局组件（落成空自定义元素），需先改模板编译方式，故该项标记为未完成、留待后续。
- [x] 商户首页经营数据（`今日收款/本月收款`）已改为 `fmtRp`，浏览器实测显示 id-ID 点千分位（`Rp 3.240 / Rp 28.500`）。