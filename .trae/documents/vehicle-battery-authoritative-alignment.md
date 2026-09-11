# 用户端车辆/电池 → 商户端权威源对齐实现计划（最终修订）

## Context（问题与背景）

问题：用户端 `MV10086` 是兜底编号，来自 `v.vin || ('MV'+v.id+'0086')`，说明：
- 用户端原始数据 `allVehicles` 无 `vin/model`（只有 `id/name/dark/locked`）
- 商户端是权威数据源，`vehicles` 含完整 `vin/ctrl/model/plate/...`
- 用户修正：两端都**不需要车牌号**（`plate`），统一只用 `vin`；先清理未使用字段；用户端以商户端为准，只展示归属当前账号的车辆/电池。

## 需求确认

1. **清理字段**：两端都不要车牌 `plate`，只保留需要用到的字段，移除兜底生成的 `MVxxx0086`
2. **统一标识**：两端唯一标识用 `vin`（车辆）/`battNo`（电池），彻底删掉 `MV{id}0086`
3. **数据权限**：只显示我的 → 用户端展示商户端中 `account` 匹配当前登录账号的那部分车辆/电池
4. **完整对齐**：用户端字段改用商户端权威字段（`vin/model/batteryMain/batterySub`），彻底抛弃用户端原硬编码数据
5. **双向流向**：商户端变更 → 用户端实时同步；用户端绑定解绑 → 商户端也同步（已存在 `uVehicles` 映射逻辑可复用）

## 关键发现（调研结论）

商户端已有成熟的"按用户账号过滤车辆/电池"逻辑，可直接复用：
- `openUserDetail(u)` → 会按 `u.account` 过滤出该用户的 `uVehicles`/`uBatteries`，并做字段映射
- 映射规则（对用户端友好）：
  - 车辆：`{vin:v.vin, model:v.model, status:v.online?'在线':'离线', batteryMain:v.batteryMain, batterySub:v.batterySub}`
  - 电池：`{code:b.battNo, model:b.model, soc:b.level}`
- 这个映射正好丢弃了 `plate`，满足"不需要车牌号"要求
- 用户端直接读取这个过滤+映射结果即可，无需自己重复过滤

审计结果（未使用/可清理）：
- `plate`：商户端仅在编辑读写，但列表/详情不展示；用户明确不需要，因此用户端**不消费**
- `MV{id}0086`：用户端兜底逻辑，用户端彻底删掉

## 当前数据结构对比

| 维度 | 用户端（需改造） | 商户端（权威源，已过滤映射） |
|-----|---------------|----------------------------|
| 车辆字段 | `id/name/dark/source/locked` → 抛弃 | `vin/model/status/batteryMain/batterySub` → 用户端直接用 |
| 电池字段 | `id/model/soc/source/discharge` → 抛弃 | `code/model/soc` → 用户端直接用 |
| 标识 | `id` 兜底到 `MV+id+0086` → 移除 | `vin`（车辆）/ `battNo → code`（电池）→ 唯一标识 |
| 归属 | 硬编码 → 抛弃 | 商户端已按 `account` 过滤 → 用户端直接消费 |

## 实现方案

### 核心设计

1. **共享层（SHARED CORE）MERGED**：
   - 已有：`orderCount / vehicleCount / batteryCount / ...`
   - 新增：`MERGED.myVehicles`（过滤后的我的车辆数组）、`MERGED.myBatteries`（过滤后的我的电池数组）
   - 商户端 `openUserDetail` 后，将生成好的 `uVehicles`/`uBatteries` 发布到 `MERGED.myVehicles`/`myBatteries`
   - 当商户端 `vehicles`/`batteries` 本身变更（增删改），也重新发布

2. **用户端数据源完全切换**：
   - 丢弃原 `allVehicles`/`homeBatteries` 硬编码
   - 用户端 `vehicles` → `computed(() => MERGED.myVehicles || [])`
   - 用户端 `homeBatteries` → `computed(() => MERGED.myBatteries || [])`

3. **字段对齐与模板修正**：
   - 车辆列表：`:key="v.vin"`（不再 `v.id`）；车型 `{{displayName || v.model}}`；编号 `{{v.vin}}`（不再兜底 `MV`）
   - 保留用户端 `vehicleNames[v.vin]` 自定义车名功能（key 改为 `vin`）
   - 电池列表：`:key="b.code"`（不再 `b.id`）；型号 `b.model`；电量 `b.soc`（对应商户端 `level`）
   - 彻底移除模板中的 `v.vin || ('MV'+v.id+'0086')`

4. **双向同步**：
   - 商户端手动绑定车辆/电池到用户 → 绑定后自动同步到 `MERGED` → 用户端刷新列表
   - 用户端解绑 → 用户端移除后，`MERGED` 同步更新 → 商户端也走原解绑逻辑（已有，复用）

### 关键改动清单

**scripts/build-merge.mjs**：
1. **SHARED CORE `MERGED` 扩容**：增加 `myVehicles: []`、`myBatteries: []`
2. **publishMerged 更新**：在发布计数后，追加发布 `MERGED.myVehicles = uVehicles.value; MERGED.myBatteries = uBatteries.value;`
3. **用户端注入替换**：
   - 删掉原 `allVehicles = [...]` 硬编码，替换为 `const allVehicles = []; const vehicles = computed(() => MERGED.myVehicles || []);`
   - `homeBatteries` 同理：原硬编码替换为 `const homeBatteries = computed(() => MERGED.myBatteries || []);`
4. **模板文本替换**：
   - `{{ v.vin || ('MV'+v.id+'0086') }}` → `{{ v.vin }}`（彻底移除 MV 兜底）
   - `:key="v.id"` → `:key="v.vin"`；电池 `:key="b.id"` → `:key="b.code"`

**merchant.html（构建时变换）**：
1. 在 `openUserDetail` 中 `uVehicles.value=...` 赋值后，追加调用 `publishMerged()`，把过滤后的我的车发布到 `MERGED`
2. 确认 `publishMerged` 已经 `watch` 依赖 `vehicles.value` 长度，变更会触发重发布

**user.html 关键逻辑适配（构建时变换）**：
1. `currentVehicle` computed：`x.id === v.id` → `x.vin === v.vin`
2. `saveVNameEdit`：`vehicleNames[currentVehicle.value.id] = n` → `vehicleNames[currentVehicle.value.vin] = n`
3. `selectMyVehicle`：`x.id === v.id` → `x.vin === v.vin`
4. `openMyVehicleFromHome`：`x.id === v.id` → `x.vin === v.vin`

### 实施步骤（分 3 步）

**Step 1：完善共享桥与发布逻辑**
- 修改 `build-merge.mjs`：`MERGED` 新增 `myVehicles/myBatteries`
- 修改 `publishMerged`，在计数之后，把 `uVehicles.value` / `uBatteries.value` 赋值给 `MERGED`
- 在 `openUserDetail` 末尾追加调用 `publishMerged()`（确保打开用户详情后发布）

**Step 2：用户端数据源替换和字段对齐**
- 构建时：把 `const allVehicles=[...]` 替换为空数组 + computed 读取 `MERGED.myVehicles`
- 把 `homeBatteries=ref([...])` 替换为 `const homeBatteries = computed(() => MERGED.myBatteries || [])`
- 替换模板中 `:key="v.id"` → `:key="v.vin"`；`v.vin || MVxxx` → `v.vin`
- 适配 `currentVehicle` 查找、`saveVNameEdit` key 改为 `vin`；电池 key 改为 `code`

**Step 3：验证收尾**
- 重建产物
- 验证：`MV10086` 彻底消失，用户端车辆列表只显示当前用户（匹配 account）的车，字段与商户端一致
- 验证双向：商户端绑定新车辆 → 用户端立即出现；用户端解绑 → 商户端也同步消失

## 验收标准

1. 用户端再也不会出现 `MVxxx0086` 这种兜底编号
2. 用户端显示的车辆字段（vin、model）与商户端一致，且只展示归属当前登录账号的车辆/电池
3. 车牌号 plate 在用户端不展示（满足需求），商户端保留自用不影响
4. 商户端绑定/解绑 → 用户端列表实时同步；双向数据流打通
5. 控制台无 undefined 错误，双端渲染正常

## 验证流程

1. 执行全量构建：`node scripts/merge-extract.mjs && node scripts/merge-css.mjs && node scripts/build-merge.mjs`
2. 打开 `index.html`，切换到用户端，查看首页"我的车辆"列表
3. 验证：是否无 MV 编号，是否只显示匹配账号的车辆，车型/编号正确
4. 在商户端打开对应用户详情，绑定/解绑车辆，切回用户端看是否实时同步