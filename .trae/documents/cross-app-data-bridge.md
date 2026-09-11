# 跨端数据桥：商户端为准 → 用户端实时同步（MERGED）

## Context（为什么做）
两端已是两个独立 Vue 实例（`mountUser`/`mountMerchant`）。用户希望打通订单、车辆·电池、钱包数据，且**以商户端为准**、**自动实时**。
由于货币切换已证明「全局 `Vue.reactive` 跨实例实时联动」（`MONEY` 改一处、双端重渲）可行，本方案复用同一机制的共享数据桥 **MERGED**：商户端作为数据源持续发布，用户端只读实时反映——无需合并 Vue 实例（合并既高风险、也解不了 Task3/4 的 DOM 模板组件问题，故不采用）。

## 目标形态（index.html `<script>` 内）
```
/* SHARED CORE */ 
  MONEY（已有）→ fmtRp
  MERGED = Vue.reactive({ orderCount:0, vehicleCount:0, batteryCount:0, walletBalance:0, lastOrderNo:'—', updatedAt:0 })
function mountUser(root){  ... 蒙上 mergedStats = computed(读 MERGED) ... }   // 消费端：只读
function mountMerchant(root){ ... publishMerged() + watch → 写 MERGED ... }     // 数据源：发布
```
- 数据方向：**仅商户端→用户端**，商户为准（本次不做用户写回）。
- 机制：`Vue.reactive` 全局对象，与 `MONEY` 一致 → 用户端被依赖的 computed 端点实时更新。

## 统一字段契约（命名对齐）
两端的内部变量名各不相同（商户侧 `orders/vehicles/batteries/uWallet`，用户侧 `homeBatteries/currentOrder/walletActive` 等）。为让两端「说同一种话」，数据桥以一份**对齐的字段契约**为唯一口径，商户端发布与用户端消费均使用同一套字段名；端内内部名 → 契约名在**桥边界**统一映射。

契约 `MERGED`（两端共用，字段名即契约名）：
| 字段 | 含义 | 商户端来源(内部) | 用户端消费 |
|---|---|---|---|
| `orderCount` | 订单数 | `orders.length` | 状态条订单数 |
| `vehicleCount` | 车辆数 | `vehicles.length` | 状态条车辆数 |
| `batteryCount` | 电池数 | `batteries.length` | 状态条电池数 |
| `walletBalance` | 钱包可用额 | `uWallet.total` | 状态条钱包（经 fmtRp） |
| `lastOrderNo` | 最近订单号 | 首单 `orderId`/`id` | 状态条最近单号 |
| `updatedAt` | 更新时间戳 | `Date.now()` | 展示刷新时间 |

- 商户端 `publishMerged()` 只写契约字段；用户端只读契约字段。
- 后续凡两端要互通的字段，一律先纳入契约并统一命名，避免新字段各自命名。
- 本次不改两端**内部**变量名（那是更大范围的重命名重构，另议）；对齐责任落在桥边界的映射上。

## 改动清单
修改文件：`scripts/build-merge.mjs`（含 SHARED CORE 注入 + 两端 JS/模板变换）；重建 `index.html`。源快照只读，`.merge-tmp` 可重建。

1. **SHARED CORE**：新增（字段名即契约）
   ```
   var MERGED = Vue.reactive({ orderCount:0, vehicleCount:0, batteryCount:0, walletBalance:0, lastOrderNo:'—', updatedAt:0 });
   ```

2. **商户端发布（Bjs，数据源）**：在 setup 内注入
   - `function publishMerged(){ try{ MERGED.orderCount=orders.value.length; MERGED.vehicleCount=(vehicles.value||[]).length; MERGED.batteryCount=(batteries.value||[]).length; MERGED.walletBalance=(uWallet&&uWallet.total)?uWallet.total:0; var last=(orders.value&&orders.value[0])||null; MERGED.lastOrderNo=last?(last.orderId||last.id||'—'):'—'; MERGED.updatedAt=Date.now(); }catch(e){} }`
   - 触发：加一个 **`watch`（immediate）**，源为聚合 getter `[orders.value.length, (vehicles.value||[]).length, (batteries.value||[]).length, (uWallet&&uWallet.total)||0]` → `publishMerged`。`immediate:true` 挂载即播种。
   - 注入锚点：商户端原有 `onMounted(()=>{brandLoading…` / `watch([tab,homeOV…` 一带（L6228-6231），实现时以唯一字符串锚定并在前后置入，带 `assert`。
   - 防御：全部 `try/catch` + `?.`/`||` 兜底，不确定的变量实现时先核验，缺失则降级 0/跳过，不让发布挂坏商户端。

3. **用户端消费（Ajs）+ 展示（Ahtml）**：
   - Ajs：新增 `const mergedStats=computed(()=>({orderCount:MERGED.orderCount,vehicleCount:MERGED.vehicleCount,batteryCount:MERGED.batteryCount,walletBalance:MERGED.walletBalance,lastOrderNo:MERGED.lastOrderNo,updatedAt:MERGED.updatedAt}));`，并在 setup `return` 暴露（return 尾部追加 `,mergedStats`）。
   - Ahtml：首页（`#sc-home` 容器内、L737 一带）插入状态条，**全部使用契约字段名**：
     `商户端同步 ▶ 订单 {{mergedStats.orderCount}} · 车辆 {{mergedStats.vehicleCount}} · 电池 {{mergedStats.batteryCount}} · 钱包 {{ fmtRp(mergedStats.walletBalance) }} <small>({{mergedStats.lastOrderNo}})</small>`
   - 注入锚点：Ahtml 首页 `#sc-home` 后稳定元素；实现时锚定唯一字符串，带 `assert`。

4. **自检**：`MERGED` 定义含上述 6 个契约字段且出现 1 次；`publishMerged` 1 次；`mergedStats` 出现（定义+return+模板若干）；`fmtRp` 仍 1 定义；未见非契约字段写入 MERGED。

## 确定性验证（浏览器实测）
- 双端挂载后，用户端首页应出现「商户端同步」状态条，初始值来自商户端播种（订单数/车辆/电池/钱包）。
- 在**商户端**触发一个确定改变数据的操作（首选 `demoSetListEmpty` 清空/恢复订单，或用户详情「调账」`submitUAdjust` 改钱包），观察**用户端状态条实时联动**（订单数或钱包变化），且切货币时钱包仍随 `fmtRp` 换算。
- Console 无应用自身 error / [Vue warn]；双端 Tab 切换、导航、host 三态正常。
- 源 `user.html`/`merchant.html` 未改；`index.html` 为唯一产物，一键可重建。

## 风险与边界
- 商户端变量名（`orders/vehicles/batteries/uWallet`）是否都能直接在 setup 消化：实现时先核验，必要时用 `window` 不引、只在 setup 内引用；发布用 `try/catch` 兜底，缺失字段不崩发布。
- 仅「商户→用户」单向、只读反映，用户端不改写商户数据（符合"商户为准"）。
- 不合并 Vue 实例、不改模板编译方式（Task3/4 组件拦阻仍按原记录，另项处理）。

## 回滚
改动集中在 `build-merge.mjs` + 重建的 `index.html`；`git` 回退到 `1e2d606` 即还原。中间层可 `merge-extract → merge-css → build-merge` 一键重建。