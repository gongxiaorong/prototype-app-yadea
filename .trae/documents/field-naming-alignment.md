# 双端同模块字段命名对齐（audit + 分阶段 rename）

## Context（为什么做）
两端的「同模块」数据字段命名不一致（如订单：用户 `orderId/createTime/payee/payStatus`，商户 `id/created/payment/paySt`；钱包：用户 `totalBalance`，商户 `total`）。用户要求：**先通栏整个项目，双端同样模块的字段命名必须对齐**——两端对同一业务概念使用同一套字段名，便于跨端数据桥与后续维护。

已盘点两端同模块字段分歧（见下表）；部分"同模块"对象语义粒度不同（用户=我的设备租借，商户=车辆/订单管理），只能对**确实对应**的字段对齐，各自私有字段保留。

## 统一命名规范（两端共同遵守）
- 主键统一 `id`；时间字段统一 `createdAt` / `updatedAt` / `paidAt` / `cancelledAt` / `finishedAt`（取消 `createTime/create_time/created/time` 这套杂糅）。
- 金额统一数字 `amount`（渲染经 `fmtRp`，不再存格式化串）；钱包总额统一 `totalBalance`。
- 支付：渠道 `payChannel`、状态 `payStatus`（替 `payment/paySt/payee` 的混用）。
- 设备：ID 统一 `id`，型号统一 `model`，状态统一 `status`。

## 双端同模块字段映射（对齐目标 = 单项的规范名）
| 模块 | 概念 | 用户端(现) | 商户端(现) | 对齐为 |
|---|---|---|---|---|
| 订单 | 主键 | `orderId` | `id` | `id` |
| 订单 | 创建时间 | `createTime` | `created` | `createdAt` |
| 订单 | 支付渠道 | `payee` | `payment` | `payChannel` |
| 订单 | 支付状态 | `payStatus`(+`statusText/Color`) | `paySt` | `payStatus` |
| 订单 | 金额 | `amount`(格式化串) | `amount`(数字) | `amount`(数字) |
| 订单 | 状态文本/色 | `statusText/statusColor` | `statusLabel`(派生) | 保留各自展示派生，不强行合一 |
| 订单 | 续租子单 | `renewOrders` | `renewOrders` | 已一致 |
| 钱包 | 总余额 | `totalBalance` | `total` | `totalBalance` |
| 钱包 | 充值/赠送 | `rechargeBalance/bonusBalance` | 同名 | 已一致 |
| 车辆(车辆管理) | 设备标识 | `id` | `vin` | 桥边界映射 `id↔vin`（跨端一致性，不混两种标识语义） |
| 车辆(车辆管理) | 型号 | `name/model` | `model/fullName` | `model` |
| 车辆(车辆管理) | 状态 | `locked/…` | `status` | `status`（两端车辆模块统一） |
| 车辆(车辆管理) | 在线 | — | `online` | `online`（用户侧如有则用同名） |
| 车辆/电池 | 型号/状态 | `model/status` | `model/status` | 已一致 |
| 电池 | 电池编号 | `id` | `battNo` | 桥边界映射（内部保留语义名） |
| 门店 | 名称/地址 | `name/addr` | `name/addr` | 已一致 |
| 用户/账号 | — | `boundPhone/boundEmail/…` | `accounts/users/…` | 概念不同，不强行对齐 |

> 结论：**真正需要改名对齐的分歧集中在「订单」与「钱包」两个模块**（几张被两端都用到的字段）。设备/电池因两端语义不同，跨端一致性放在桥边界 `id/vin`、`id/battNo` 映射，不做内部大改。用户/账号概念不同、门店已一致——不动。

## 改动范围与策略
目标：订单、钱包两模块的可对齐字段，在**两端内部**统一到单一规范名（改数据、computed、模板、方法），bridge 契约字段名随之用规范名。
- 仅重命名「同义同概念」字段（上表"对齐为"列）；单端私有、或不同语义的字段**不改名**，避免把语义改坏。
- 全程脚本化：在 `build-merge.mjs` 对 Ajs/Bjs/Ahtml/Bhtml 做**精确 token 替换**（`字段名` → 规范名），每个替换带出现次数断言；不依赖人工行号。
- 高风险：字段名可能在对象字面量、模板 `{{ x.foo }}`、computed、方法多处出现，替换必须全覆盖（用 Token 边界 `名称:` / `.名称` / `['名称']` / `"名称"` 等形态统一替换）。

## 分阶段（每阶段重建 + 浏览器验证 + 独立提交）
- **Phase 1 · 钱包**：`totalBalance`（用户）↔`total`（商户）→ 统一 `totalBalance`；核对 `rechargeBalance/bonusBalance` 已在两端同名。
- **Phase 2 · 订单**：`orderId→id`（用户侧订单对象键）、`createTime→createdAt`（两端）、`payee/payment→payChannel`、`paySt→payStatus`（商户）；用户 `amount` 若为格式化串则仅在桥服务出数字（内部展示串不动，避免大改）。
- **Phase 3 · 桥契约化**：把 `MERGED` 契约字段名用规范名（`orderCount/vehicleCount/batteryCount/walletBalance/lastOrderId/updatedAt`），两端发布/消费用它；`id/vin`、`id/battNo` 在桥边界映射。
- （设备/电池内部字段：仅当两真同义才动，否则不 rename。）

## 关键文件
- `scripts/build-merge.mjs`（token 替换表 + SHARED CORE 契约）；重建 `index.html`。
- 源快照 `user.html`/`merchant.html` 只读不动；`.merge-tmp` 可重建。

## 验证
- 每 Phase：`merge-extract → merge-css → build-merge` 重建；`node --check` 语法。
- 自检：每个重命名字段替换次数 ≥1 且有界；无残留在源 token。
- 浏览器实测：双端渲染、切换货币、导航正常；钱包/订单字段改名后各页显示不变（值相同）；Phase3 后用户端"商户端同步"条实时读契约字段联动。
- `user.html`/`merchant.html` 未改动；`index.html` 一键重建。

## 风险与边界
- 重命名贯穿整端大量使用点，存在漏改/误改风险 → 用**有界断言 + token 边界** + 每阶段浏览器回归兜底。
- 语义不同、单端私有字段不强行对齐（否则改坏含义）。
- 设备/电池跨端一致性走桥边界映射，不在两端内部做破坏性 rename。
- Task3/4 组件（DOM 模板）拦阻与本任务无关，另项处理。

## 回滚
`git` 回退到 `1e2d606` 即还原；重建管线 `merge-extract → merge-css → build-merge` 一键可复现。