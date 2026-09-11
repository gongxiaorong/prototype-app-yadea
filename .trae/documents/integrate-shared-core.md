# 整合公共部分：抽取 JS 共享内核（SHARED CORE）

## Context（为什么做）
`index.html` 已实现单文件双 Vue 实例（用户端 `mountUser` / 商户端 `mountMerchant`），CSS 内核已归到 `layer-base`、CDN 已去重。
但两端的 **JS 基础设施存在大面积重复**：图标函数 `luci`、`toast`、下拉刷新 `initPullToRefresh`、页面栈导航（nav 栈）各自都有一份实现。用户希望「先整合他们的公共部分」，把这些同源的公共代码抽成一份共享内核，两端复用，减少重复、便于后续统一演进。

已核实事实：
- `luci`：两端**逐字相同**（696B）→ 可零风险共享。
- `toast`：两端**逐字相同**（同款函数体）→ 可共享（需以每个实例自己的 `toasts` ref 作参数）。
- `initPullToRefresh`：**同源但实现不同**（A 用通用 onStart/onMove/onEnd + document 级 mousemove/mouseup；B 用元素级 mousedown/mousemove/mouseup/mouseleave）→ 需统一为一份"规范实现"再共享。
- 页面栈 nav：**同源但快照结构/细节不同**（A：数组快照 + `showRentLoading` 复位 + `NAV_SCREENS` 已填充；B：对象快照 + `NAV_SCREENS` 为空）→ 需泛化为共享工厂 `createNav({screens, pageRefList, onResetLoading})`，统一数组快照。
- CSS `layer-base` 已共享、CDN 已去重 → 不在本次范围。

## 目标形态（index.html 的 `<script>` 内）
```
/* ══ SHARED CORE ══ */  ← 一份，两端复用
  luci(n,c)                        // from A/both，共享
  makeToaster() → {toasts, toast}  // toast 工厂，app 各自持有 toasts ref
  ptrBind(root, cid, iid, cb)      // 下拉刷新规范实现
  createNav({screens, pageRefList, onResetLoading}) → {navOpen,navBack,navDrop,navSwap,navReset}
function mountUser(root){ ... }
function mountMerchant(root){ ... }
```
各端 setup 中删掉自有重复定义，改为调用共享函数（自由变量名保持不变，`luci`/`toast`/`initPullToRefresh`/`navOpen` 等仍按原名引用，保证模板与内部调用零改动）。

## 改动清单
修改文件（**核心**）：`scripts/build-merge.mjs` —— 新增「公共部分去重」变换步骤；重新生成 `index.html`。
不直接手改 `index.html`（它由脚本重建）。`user.html` / `merchant.html` 只读，不做任何改动；`.trae/specs`、`PLAN.md` 无关不动。

变换细分（全部在 build-merge 装配阶段对 A.js / B.js 文本做精确锚点替换/删除）：

1. **共享 `luci`**
   - SHARED CORE 注入一份 `function luci(n,c){...}`（取两端相同的那份）。
   - 从 A.js 删除顶部 `function luci(...)` 行、从 B.js 删除 setup 内 `function luci(...)` 行。
   - 安全点：为精确等长子串，非正则；删除后 setup 内 `luci` 经作用域链解析到 SHARED。

2. **共享 `toast`**
   - SHARED CORE 注入 `function makeToaster(){ const toasts=ref? ... }`。注意：`toast` 用到 `ref`/`setTimeout`，`Vue` 全局可用；`ref` 由 `const{...}=Vue` 提供。为避免对 `ref` 引用的依赖，改为共享纯函数：
     `function toastPush(list, counter, msg, type)`：`list` 为 `toasts.value` 数组（或 toasts ref 本身），`counter` 为 `{n:0}` 计数对象。
   - 各端替换：`const toasts=ref([]); let tid=0; function toast(...){...}` →
     `const toasts=ref([]); const _tt={n:0}; function toast(msg,type='info'){toastPush(toasts.value,_tt,msg,type)}`
   - 前置：需在 build-merge 中对两端各自的该段做精确匹配替换（两端当前该段逐字相同，可同一模板）。

3. **共享 `initPullToRefresh`（规范实现，root 作用域）**
   - SHARED CORE 注入 `function ptrBind(root, containerId, indicatorId, onRefresh){...}`（合并 touch + 一套稳妥的鼠标路径）。
   - 各端删除自有 `function initPullToRefresh(...){...}` 整段（用该函数 unique 前缀到结尾的精确锚点摘除），替换为 setup 上文可解析的 3 参版本：
     - A：在 `mountUser` 内、`const app=createApp` 之前加 `function initPullToRefresh(cid,iid,cb){ return ptrBind(root,cid,iid,cb) }`。
     - B：同理在 `mountMerchant` 内加同款。（B 的 `initPullToRefresh` 目前在 setup 内且被 return；删除后 B 的 setup 经自由变量解析到 mountMerchant 的 wrapper，return 仍可用。）
   - 行为对齐提示：两端后台下拉刷新的桌面鼠标实现统一为同一套（当前 A/B 略有差别，统一后以规范实现为准）。

4. **共享页面栈 nav（`createNav` 工厂）**
   - SHARED CORE 注入 `function createNav(opts){ const navStack=[]; ... 返回 {navOpen,navBack,navDrop,navSwap,navReset,navLog} }`，快照统一为数组；`onResetLoading` 参数承载 A 的 `showRentLoading.value=false`。（B 无此项时传空函数）
   - 各端把 setup 内「 `_navClone` → popstate 监听」这一整段内联 nav 实现以内容锚点摘除，替换为在该 setup 内 `pageRefList` 定义好之后的一行：
     `const {navOpen,navBack,navDrop,navSwap,navReset,navLog}=createNav({screens:NAV_SCREENS, pageRefList:pageRefList, onResetLoading:/*A:()=>showRentLoading.value=false; B:null*/});`
   - 位置与边界需在实现时以锚点精确定位（A 的 nav 块 706~815、B 的 2130~2196 一带），并用首次实现后的浏览器回归兜底。
   - 风险最高：该段代码量大、边界多；实现时保留原 `_navClone/_navR/_navSnapshot/_navRestore` 语义至工厂内。

> 分阶段实施并逐段验证；若第 4 步（nav）风险暴露过大，可拆分单独做并先行交付 1–3。

## 验证
1. `git` 已建分支于检查点 `c660a14`；实现后手动提交一个新 commit。
2. 语法校验：`node --check` 导出的 `<script>` 块（沿用 `scripts/export-script.mjs`）。
3. 自检断言：合并后 JS 中 `function luci(`、`function toast(` 各只出现 1 次；`ptrBind` 出现 1 次；`createNav` 出现 1 次；两端对 `index.html` 的 `app.mount(root)` 仍为 2 次。
4. 浏览器实测（本地 `python -m http.server` + browser_use）：
   - 双端均正常渲染；icon（依赖 `luci`）显示正常；
   - 任一端触发一次 `toast`（如登出/操作）正常弹出；
   - 下拉刷新可用（若自动化难以模拟触摸，则确认无相关报错，桌面鼠标下拉路径走规范实现）；
   - 两端做一个页面跳转 + 返回（menu / tab → 详情 → 返回），确认 nav 栈 push/pop 正常、不越界；
   - host 三态切换正常。
5. 回归：用户端串租车下单、商户端切「车辆/告警」等主链路无 console 错误。

## 回滚
改动仅在 `scripts/build-merge.mjs` 装配逻辑与重建的 `index.html`。`git checkout` 回到检查点 `c660a14` 即整体回滚；`merge-extract` 可随时从只读源快照 `user.html`/`merchant.html` 重抽恢复基线。