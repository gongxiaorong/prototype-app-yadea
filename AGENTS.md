# AGENTS — 多语言同步规则

本文件定义 `yadea-rental-merge` 项目多语言资源的同步规范。任何改动中文源文本的 Agent / 脚本，都必须遵循以下规则，确保 `zh-CN`（源语言）与各目标语言翻译文件保持一致。

---

## 1. 文件存放路径与命名规范

| 项 | 说明 |
| --- | --- |
| 存放目录 | `locales/`（项目根目录下，与 `index.html` 同级） |
| 命名规范 | `<language-code>.json`，小写 BCP-47 代码 |
| 文件清单 | `zh-CN.json`（源）、`zh-HK.json`、`en.json`、`id.json`、`th.json` |

- 禁止在 `locales/` 外的位置（如 `index.html` / `swap.html` 内联）新增语言文件或硬编码文案。
- 新增语言时：在 `locales/` 下新建 `<lang>.json`，并同步登记到第 3 节的「目标语言列表」。
- 所有 JSON 文件统一使用 **UTF-8（无 BOM）** 编码，结尾保留一个换行符，缩进为 2 个空格。

## 2. 数据结构约定

- 各语言文件为**嵌套 JSON 对象**，按命名空间（如 `common`、`rental`、`swap`）分层。
- 逻辑 key 为**点路径（dot-path）**，例如 `common.reset`、`rental.user.tab.vehicles`。
- 同一语义的 key 在五种语言文件中**必须位于相同的嵌套路径**下，key 名称（英文）保持一致，仅最末级值为各自语言译文。
- 禁止为 key 追加数字后缀（如 `menu.home0`）作为"复制粘贴残留"，这是历史 bug，出现即修。
- 译文值中若含占位符，必须使用 vue-i18n 标准插值 `{name}`，且各语言占位符名称与数量必须一致。

## 3. 源语言与目标语言

| 角色 | 语言代码 | 说明 |
| --- | --- | --- |
| **源语言（权威）** | `zh-CN` | 唯一权威源，所有变更以它为准 |
| 目标语言 1 | `zh-HK` | 繁体中文（中国香港） |
| 目标语言 2 | `en` | English |
| 目标语言 3 | `id` | Bahasa Indonesia |
| 目标语言 4 | `th` | ไทย（泰语） |

> 同步方向为单向：**`zh-CN` → 其它四种语言**。目标语言之间互不派生，互不回写源语言。

## 4. 变更检测规则

以 `zh-CN.json` 为基准，对其余语言文件做扁平化（flatten）后逐 key 比对：

- **新增（MISSING）**：`zh-CN` 中存在、但目标语言缺失该 key → 需补齐。
- **变更（CHANGED）**：key 存在于两侧，但源值发生修改（文本/占位符变化）→ 目标语言需重新翻译。
- **孤立（ORPHAN）**：目标语言存在、但 `zh-CN` 已删除该 key → 从目标语言清理（不保留死 key）。
- **数值/占位符一致性**：源值含数字或 `{placeholder}` 时，目标译文必须保留相同数字集合与占位符集合（参考 `scripts/_i18n_b_audit.mjs` 的数字 parity 检查）。

检测实现可复用现有脚本：
- `scripts/i18n_check.mjs`：扁平化五种语言，**按项目分组**（index / swap）输出缺失、占位符与数字不一致、孤立键清单。
- 新增 / 定点修正翻译时，按点路径向五个语言文件写入相同嵌套位置。

## 5. 同步执行流程

当 `zh-CN` 变动或新增文本时，按以下流程同步：

```
① 检测   → 对比 zh-CN.json 与 locales/{en,id,th,zh-HK}.json，产出差异清单
           （新增 / 变更 / 孤立 key，及数字·占位符不一致项）
② 生成占位 → 对「新增 / 变更」key，先在目标语言文件写入源语言值作占位
           （保证运行不缺 key、不抛 i18n 缺失告警），并标记为待译
③ 翻译   → 将占位项交由翻译补全：
           · en / id / th / zh-HK 各自独立翻译，互不复制；
           · 术语统一（参考历史校准：车辆=Vehicle/Kendaraan/ยานพาหนะ、
             押金=Deposit/Jaminan、退款=Refund/Pengembalian Dana 等）；
           · 状态词、断词连字符、大小写按各语言规范校对
           （详见记忆 `android-merchant` i18n 审计修复要点）
④ 校验   → 重跑检测脚本，确认：
           · 各语言 key 集合 == zh-CN key 集合（无 MISSING / 无 ORPHAN）
           · 数字与占位符集合与源一致
           · 无数字后缀残留 key
⑤ 归一化 → 统一 JSON 格式（2 空格缩进、UTF-8、结尾换行），提交
```

### 执行约束

- **不自动生成机翻并直接入库**：占位后必须显式翻译，禁止把源中文当译文常驻。
- **保持 key 顺序与结构一致**：新增 key 放在对应命名空间内、与 `zh-CN` 同级位置，避免跨文件顺序漂移。
- **幂等**：重复执行同步流程，已翻译项不被覆盖、已一致项不产生 diff。
- **权威源即 `index.html`**：`index.html` 是当前唯一权威产物，可直接修改；语言变更只改 `locales/*.json`。

## 6. 验收清单（PR/提交前）

- [ ] `zh-CN` 与 `en`/`id`/`th`/`zh-HK` 的扁平 key 集合完全一致。
- [ ] 无占位残留：目标语言值不是未翻译的中文原文（已翻译项）。
- [ ] 占位符 `{...}` 与数字集合在五种语言中一致。
- [ ] 无 `…0`/`…1` 等数字后缀残留 key。
- [ ] 五个 JSON 文件均为 UTF-8、2 空格缩进、结尾换行。

## 7. 多项目命名空间划分（rental / swap）

本仓库同一套 `locales/*.json` 服务两个并行前端项目，**按项目前缀划分命名空间**：

| 层 | 命名空间 | 归属 |
| --- | --- | --- |
| **共享层** | `common.*` | 两项目共用（货币 / 操作 / 状态 / 单位 / 语种等） |
| **rental（权威源）** | `rental.user.*` / `rental.merchant.*` / `rental.demo.*` | `index.html`（租车系统 · 用户端 + 商户端合并产物） |
| **swap** | `swap.*` | `swap.html`（换电系统 · 用户端 + 商户端脚手架） |

规则：
- 两项目**共用**的术语（货币 / 操作 / 状态 / 单位 / 语种等）一律放在 `common.*`，不在项目前缀下重复定义。
- 项目**专属**串一律带项目前缀：租车 → `rental.user.*` / `rental.merchant.*` / `rental.demo.*`；换电 → `swap.*`（壳层 / 导航现有：`swap.title` / `swap.userSide` / `swap.merchantSide` / `swap.splitView` / `swap.gotoRental`）。
- swap 未来若长出业务页，置于 `swap.user.*` / `swap.merchant.*`，与租车的 `rental.user.*` / `rental.merchant.*` 平行，互不冲突。
- 两项目字符串**共用同一组 5 个语言文件**，键集合必须完全一致（`common.*` / `rental.*` / `swap.*` 全部计入）；校验脚本按 `shared / rental / swap` 分组输出（见 `scripts/i18n_check.mjs`）。
- 若未来两项目需要**不同的目标语言集**（例如 swap 暂不做 `zh-HK`），应改为按项目分目录（`locales/rental/` 与 `locales/swap/`）方案，并同步调整本规范与校验脚本。

## 8. 底部弹窗规范（底部弹窗治理）

`index.html` 的全部底部弹窗（用户端 + 商户端）必须收敛到共享套件 `registerSheetKit(app)`（见 SHARED CORE，双端 mount 前各调用一次）。禁止新写裸的 `transition fd/sh + absolute inset-0 遮罩 + bottom-0 面板` 手写弹窗；新增弹窗一律用共享组件，防止样式再次漂移。

> **实施状态（2026-09-15 · 收口）**：`index.html` 的 **33 个底部弹窗已 100% 收敛到共享套件**——手写 `rounded-t-[20px]` 面板计数为 **0**；现为 `<bottom-sheet>` ×31 + `<option-sheet>` ×2。
> - `OptionSheet`：租赁类型、租赁方案；
> - `BottomSheet` A 型（标题 + 右上角 X）：联系门店（取还信息图标与门店页按钮共用）、选择门店钱包、更多操作（证件）、证件照片来源、添加资料（用户端）、添加用户资料（商户端）、手动输入编号（商户端）、更多操作（订单）、更多操作（用户钱包）、续租 `showRenewPlan`、支付 `showPayment`、退款/结束订单 `showRefund`、改价 `showPaySplit`、全部筛选 ×4、选择车型 `vehShowModelSheet`、选择电池型号 `battShowModelSheet`、绑定用户 `userPickActive`、订单选择 `orderPickActive`、绑定设备 `uBindMod`、套餐选择 `pkgPicker`、编辑赠送余额 `uWalletSheet`；
> - `BottomSheet` B 型（滚轮/日期）：`roDatePicker`、`ordersDatePicker`、用户端·商户端轨迹时间、电池轨迹时间、客服时分 `hmPicker`；
> - `mask-z` **沿用各弹窗原遮罩层级**（600 / 620 / 630 / 750 / 800 / 900 / 1850 / 1891 / 1897 / 1900 / 1920 / 2010 / 2020 / 2590；动态提升用 `:mask-z="idSelectMode?1921:750"`）；`max-h` 沿用原高度（65 / 70 / 82 / 92 / 95%，无上限者取默认 60%）。`uWalletSheet` 原为"遮罩包裹面板"同层嵌套，已顺带修正为「遮罩 = 面板 − 1」。
> - **实测覆盖**：绝大多数弹窗已在无头浏览器逐个打开验证（标题/X/把手/`max-h`/`z`/关闭）；`pkgPicker` / `uWalletSheet` / `userPickActive` / `orderPickActive` 及商户端车辆·电池轨迹时间因页面状态/权限/数据无法在无头环境驱动，**仅做结构与语法核对**（与已验证的同构弹窗一致），需人工点一次确认。
>
> **遮罩取值已归一**（26 个底部弹窗遮罩 `.35`/`.45` → `.4`；残留 `.45` 仅剩非底部弹窗的居中浮层）。**内容行 token 化已完成第一批**：`.sheet-search`（6 处搜索框）、`.sheet-body`（7 处内容滚动区），见 §8.7。**未做（独立轮次）**：z-index 刻度化 / 高度三档化（都会改变现有视觉，需先出全层级顺序表）、内容行 token 化的剩余部分（`.sheet-chip` 筛选 chips、`.sheet-row-danger` 危险行、无隐藏滚动条类的那 10 处滚动区）。`swap.html` 另有 4 个底部弹窗（`areaSheet` / `planDetail` / `showIdPicker` / `showIdAction`），待其「字符串模板 → in-DOM HTML」迁移完成后按同一套件处理。

### 8.1 统一规范取值（7 维度）

| 维度 | 统一取值 |
| --- | --- |
| 触发方式 | 状态 ref（如 `showXxx`）驱动，打开用 open 事件，关闭走**单一 `closeXxx()` 出口**，上下文复位只在出口内做 |
| 弹窗结构 | 遮罩(`.sheet-mask`，`data-od-id` 可选) + 面板(`.sheet-panel`) + 把手(`.sheet-handle`) + 头部(A/B 型) + 内容区 + 安全区 |
| 样式规范 | 遮罩 `rgba(0,0,0,.4)`；面板 `absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] flex flex-col`，`max-height:60%`(sm 默认)/70%(md)/92%(lg 长表单)，`padding-bottom:max(24px,env(safe-area-inset-bottom))` |
| 动画 | 仅 `.fd`（遮罩）+ `.sh`（面板）；头部 A 型口：17px semibold + 右上角 X；B 型：`取消|居中标题|确定` |
| 交互逻辑 | 把手/顶部下拉超过约 80px 关闭（`v-sheet-drag`）；内容滚动已下移时不误关 |
| 文案格式 | 行：`px-4 pb-1 flex flex-col gap-10px`；选项行 `w-full py-3.5 rounded-xl text-center text-[15px]`，未选中 `#F6F7F9`/`#111`，选中 `var(--accent)` 底 + 白字加粗 |
| 组件复用 | `BottomSheet`（壳：A 型 = 居中标题 + 右上角 X；B 型 = `取消｜居中标题｜确定`；插槽 `default` / `footer`）/ `OptionSheet`（单选列表）；**滚轮·日期类一律用 `BottomSheet type="B"`**（原 `WheelDateSheet` 只有 A 型头、会丢掉"确定"，已删除），勿各自复制结构 |

> **号码行（联系门店 / 客服电话）**：沿用「联系门店」原有**单行**样式——`w-full py-3.5 rounded-xl text-center text-[15px]`，底 `#F6F7F9`，整行点击拨号（`dialStorePhone`）。**两个入口共用同一个 `BottomSheet`**：门店页 / 订单页的「联系门店」按钮与下单确认页「取还信息」卡片的电话图标都开它（数据同源 `csList` → `storePhoneList`）。原 `csSheet` 居中弹窗（`fixed z-[9999]`、三列行）已删除，不再存在"同数据两种呈现"。
> **⚠️ 不要给号码行加备注/区号**（曾试过"备注 + 号码 + 区号"两行版，已被要求回退）：联系门店弹窗内容必须与各订单入口拉起的完全一致，只显示号码。

### 8.2 z-index 刻度

面板 = 遮罩 + 1。`600`(页面浮层)/`900`(业务表单)/`2000`(流程型)/`2500`(全局)。传 `:mask-z` 传遮罩档位，面板自动 +1。

### 8.3 共享组件 API

- `BottomSheet`：props `open/title/type(A|B)/size(sm|md|lg)/maskZ/handle/showX/oid/panelOid`；emit `close/confirm`；插槽 `default/footer`。
- **⚠️ `open` 只能声明为「无类型 + `default:false`」，严禁写 `open:Boolean`**。多处调用方用**字符串 ref** 当开关（`userPickActive='vehicle'` / `uWalletSheet=''` / `pkgPicker` / `trackTimePicker` / `roDatePicker` / `hmPicker` 等，前两个初始值就是空字符串），而 Vue 的**布尔属性转换**会把空字符串 `''` 变成 `true`：实测 3.5.42 下 `Boolean ← ''` → `true`，**连 `[Boolean, String]` 写进类型也照样转成 `true`**（只有「不声明 Boolean」才保持 `''` 为假值）。后果是该弹窗**在空值时自己弹出来、并且关不掉**——关闭出口把它置回 `''`，仍然为真。真实症状：商户端首页平白多出「绑定用户」弹窗、点右上角 X 无效（2026-09-15 修复）。改为 `open:{default:false}` 后，布尔真值（`showDatePicker=true`）、字符串值（`'vehicle'`）、空值（`false`/`null`/`''`）三类语义与手写 `v-if` 完全一致。
- `OptionSheet`：props `open/title/options/modelValue/size/maskZ/handle/showX/oid/panelOid`；emit `update:modelValue/select/close`。`options` 支持 `[{value,label}]` 或纯字符串/数字数组（此时 value=下标）。选中跳高亮依赖 `:model-value`；确认动作走 `@select`（value），关闭走 `@close`。
- 滚轮 / 日期类：用 `BottomSheet type="B"`（`取消｜标题｜确定`），滚轮标记（`.track-wheel-*` 三列 + `ref` + `@scroll`）原样放进 `default` 插槽——**插槽内容属于父作用域**，`ref` 与滚动吸附逻辑不需要改。注意：别用只有「标题 + X」的 A 型头承接靠"确定"提交草稿（`xxxDraft`）的滚轮弹窗，否则无法提交（这正是 `WheelDateSheet` 被删的原因）。
- 已知可见变化：滚轮弹窗按钮文案由「确认」统一为「确定」、颜色由 `var(--link)` 统一为 `var(--accent)`，并新增把手；如需保留原文案可加 `confirmText` prop。
- 头部 A 型右上角关闭按钮：`.sheet-x` 为 32×32 命中区、`right:16px`，垂直位置在头部内**上移 20px**（`top:calc(50% - 20px)` + `translateY(-50%)`）——不要与标题文字垂直居中（有把手时视觉明显偏沉）。三个组件共用该类，改一处即三处生效。实测（有把手、面板高 277）：X 距面板顶 18px，比标题中心高 20px，与把手底留 3px 间隙。

> **⚠️ in-DOM 模板使用铁律（本项目为单文件 in-DOM 模板，浏览器 HTML 解析器会小写标签名并把 `/` 当 void 专属）**：
> - 组件标签**必须写 kebab-case**（`<option-sheet>` / `<bottom-sheet>` / `<wheel-date-sheet>`），**禁止 PascalCase**（如 `<OptionSheet>`）——否则渲染时报 `Failed to resolve component: optionsheet`，弹窗整块不渲染、点击拉不起来。组件注册名保持与之一致（`app.component('option-sheet',...)`）。
> - **必须显式闭合**（`</option-sheet>`），**禁止自闭合 `/>`**（`<option-sheet .../>` 会被当作未闭合起始标签，吞掉后续兄弟节点 → 布局传透）。
> - **组件模板必须单根节点**：禁止两个 `<transition>` 作为兄弟根（组件会成 fragment，`<transition>` 要求恰一子元素，真实 DOM 下点击弹窗不显示/不联动）。统一外部包 `<div class="sheet-root">`（`position:static;width:0;height:0;overflow:visible`，不占位，absolute 遮罩/面板仍相对外层手机容器定位），内部两个 transition 作普通子节点。
> - **自定义指令的值必须是「函数」**：写 `v-sheet-drag="()=>$emit('close')"`，**严禁** `v-sheet-drag="$emit('close')"`。后者是内联表达式，`$emit('close')` 会在**每次渲染时立即执行**，弹窗一打开就被自己关掉——现象是 `open` 置 true 后立刻回 false、DOM 里面板停在 `sh-leave-active sh-leave-to`，极易被误判为"挂载失败 / 组件没渲染"。（2026-09-15 实测根因，曾导致整套改造被回滚。）
> - **同类隐患**：任何自定义指令（`v-sheet-drag` / `v-swipe-close` / `v-long-pan`）都不要写内联调用表达式，一律传函数引用（`v-swipe-close="navBack"`）或箭头函数（`v-swipe-close="()=>goBack()"`）。
>
> **💡 图标可用性**：`registerSheetKit(app)` 会把 `luci` 挂到 `app.config.globalProperties.luci`，因此所有组件模板（BottomSheet/OptionSheet/WheelDateSheet 及后续共享组件）内可直接用 `luci('x','w-5 h-5 text-[#999]')` 渲染图标，不会因组件 render 作用域而抛 `luci is not a function`。（历史坑：组件模板裸调用全局 `luci` 曾触发该错误，已由 globalProperties 兜底。）
>
> **🔍 浏览器回归诊断注意**：页面用 `vue.global.prod.js`，生产构建下 `app._instance` 与 `el.__vue_app__` **都不存在**（Vue 只在 `__DEV__ || __FEATURE_PROD_DEVTOOLS__` 分支里赋值），据此判断"挂载失败 / 弹窗没渲染"必然得到假阴性。需要读状态时用临时探针捕获 `app.mount(root)` 的返回值（公共实例代理）到 `window.__px`，再读写 `__px.showXxx`；诊断结束必须移除探针。看效果也可靠 DOM 判据：`.sheet-root` 存在（组件已注册）+ 面板出现/消失 + `getComputedStyle` 的 `zIndex` / `maxHeight` / `borderTopLeftRadius` / 遮罩 `backgroundColor`。

### 8.4 长表单例外（size="lg"）

续租方案、支付、退款、支付拆分等长表单可配置 `lg`(≈92%)；其余默认 `sm`(60%)，超出内部滚动。

### 8.5 验收

- 新弹窗只用共享组件，不再出现手写 `transition name="fd"/name="sh"` 的底部弹窗。
- 每个弹窗保留单一 `closeXxx()` 出口；占用 `data-od-id` 的可回归定位。
- 迁移只动模板与共享件，不触碰业务 ref 与 nav 栈体系（`paint()` 只做 `initPillDrag()`，与弹窗无关）。`data-page-node-id` / `data-od-id` 是外部标注与回归定位锚点：面板级身份经 `oid` / `panelOid` 传入，插槽内节点标注原样保留。
- 逐弹窗实测四项：打开稳定不闪退（指令表达式回归）、选中后 `@select` 生效并关闭、右上角 X 关闭、下滑关闭（合成 `touchstart` + `touchend`，垂直位移 > 80px）；控制台 0 错误。
- `mask-z` 必须**沿用手写弹窗原有的遮罩层级**（如 2030 / 2590），面板自动 +1；本规范**不做 z-index 归一**，归一需先出全层级顺序表后单独一轮。

### 8.6 权威源与构建约束

- `index.html` 是**唯一权威源**，可直接手改；**禁止**再运行 `scripts/build-merge.mjs`——它会用 `2026-09-11` 的 `.merge-tmp/{A,B}.*` 重新组装并覆盖 `index.html`，丢掉此后全部改动（i18n、跨端数据桥、弹窗套件）。该脚本自 P6 起已废弃，仅作历史参照。
- 源快照 `user.html` / `merchant.html` 已删除，脚本实际已不可重跑（`.merge-tmp/` 亦被 `.gitignore` 忽略）。
- 套件回滚：`git checkout -- index.html`（本轮改动未提交时），或从备份还原——`.merge-tmp/_pre_restore_index.html`（套件还原前）、`.merge-tmp/_pre_tokens_index.html`（内容行 token 化前）。
- 套件分块定位：`.sheet-*` 令牌在 `<style id="layer-base">` 末尾（注释 `底部弹窗共享组件 token`）；`registerSheetKit(app)` 在 SHARED CORE 内、紧随 `SYS_recent()` 之后；两处调用点分别在 `mountUser` / `mountMerchant` 的 `app.mount(root)` 之前。
- **改完 `index.html` 必做三项自检**（本次踩过坑）：
  1. **内联脚本语法**：提取 `<script>` 内容跑 `new Function(code)`。组件 `template` 是**单引号 JS 字符串**，里面写 `''` 会截断整个脚本（`SyntaxError: Unexpected string`），引号一律写 `\'`；
  2. **标签配平**：`<div>/</div>`、`<transition>/</transition>`、`<bottom-sheet>/</bottom-sheet>` 成对；
  3. **挂载冒烟**：打开页面后 `#mount-user` / `#mount-merchant` 内的 `.sheet-root` 数量应为「已迁移弹窗数」（为 0 说明脚本报错、App 根本没挂载）。
  4. **空态自检**：静置页面时 `.sheet-panel` 计数必须为 **0**（除设计上默认打开的），且每个 `:open` 绑定的 ref 在空态下为假值。见 §8.3 的 `open` prop 陷阱：`''` 会被 Boolean 类型转成 `true`，导致弹窗自开且关不掉。
- 迁移脚本约定：给组件传**纯文本标题**用静态属性 `title="中文"`；传**表达式**才用 `:title="a==='x'?'y':'z'"`——写成 `:title="中文"` 会被当成变量求值成 undefined，标题空白。

- **⚠️ sheet 内容行禁止自带底部 `pb-6/7/8`**（2026-09-16）：`.sheet-panel` token 已含 `padding-bottom:max(24px,env(safe-area-inset-bottom))`，内容行（尤其底部按钮行 `px-5 pb-8 shrink-0` / `flex gap-3 px-5 pb-8` / `px-5 pb-7 pt-2`）再带 `pb-*` 会双重底距（32px+24px=56px+）。已清理 **11 处**（pb-8×8 + pb-7×3）；保留的 `pb-*` 仅：textarea 内部 `p-4 pb-8`（字数计数器留空）、滚轮选择器 `relative px-2 pb-8`（轮体下留白）、滚动区 `flex-1 overflow-y-auto pb-8`（滚动呼吸感）——这些是元素自身语义，不是面板底距。

### 8.7 内容行 token（`.sheet-search` / `.sheet-body`）

壳统一后，壳**内部的内容行**仍是各家手写，属于第二层漂移源。第一批已收敛（2026-09-15），两条 token 都定义在 `<style id="layer-base">` 的 `底部弹窗共享组件 token` 段内、紧随 `.sheet-scroll` 之后。

| token | 等价替代的写法 | 已替换 | 用法 |
| --- | --- | --- | --- |
| `.sheet-search` | `relative? mx-5 mb-3 rounded-full flex items-center px-4 py-2.5 gap-2 shrink-0` + 内联 `background:#F6F7F9;border:1px solid #E5E5E5` | 6 处 | **新增搜索框只写 `class="sheet-search"`**；内部图标 / `<input>`（`v-model`、`placeholder`、`luci('search',...)`）仍写在插槽里 |
| `.sheet-body` | `flex-1 overflow-y-auto [min-h-0]` + `hid` / `hide-scroll` / `conf-scroll-hide` 任一 | 7 处 | 弹窗内容滚动区，只额外保留内边距工具类，如 `class="sheet-body px-5 pb-3"` |

- `.sheet-body` 只替换了**原来就带隐藏滚动条类**的容器；另有 **10 处** `flex-1 overflow-y-auto px-*`（无 hide 类，当前会显示滚动条）保持原样——是否一并归一属于**可见变化**，需单独决定，勿顺手改。
- `v-sheet-drag` 的滚动守卫已把 `.sheet-body` 纳入（`t.closest('.sheet-scroll,.sheet-opt-list,.sheet-body')`）：内容区滚到一半时下拉不再误关弹窗。
- 替换原则：**取值逐项照搬、只换类名**，不新增/删除声明（`.sheet-body` 相对原写法只多 `min-height:0`，在已有 `overflow-y:auto` 的容器上不改变几何）。
- **验证方式（可复用）**：在同一页面里并排构造「原 utility 写法」与「新 token 写法」两个元素，逐项对比 `getComputedStyle` + `getBoundingClientRect`。`.sheet-search` 已按此法验证与替换前逐项一致（`margin:0 20px 12px` / `padding:10px 16px` / `border-radius:9999px`；面板宽 369 时实测搜索框 329×42，与替换前基线完全相同）；`.sheet-body` 在真实弹窗（商户端·全部筛选）实测 `flex-grow:1` / `min-height:0` / `overflow-y:auto` / `scrollbar-width:none`。
- **⚠️ UnoCSS 是按需运行时（`@unocss/runtime` CDN）**：新出现的 utility 类是**异步**生成的，元素插入 DOM 后立即读 computed style 会看到"类没生效"的假象（本次差点误判成"token 改了视觉"）。要判断某类是否生效，等 ~1s 再读，或直接查 `document.styleSheets` 里有没有该选择器。token 是静态 CSS，不受该时序影响。

## 9. 页面栈导航（快照式）

`index.html` 的返回由 `createNav({screens, pageRefList})` 维护（双端各一份实例；`pageRefList` 是参与快照/恢复的状态 ref 列表，含 `tab` 与各 `xxxOV / showXxx / profileSub` 等）。

- **入栈时机**：调用方先 `navOpen()`（此时快照 = 当前页，即"来源页"），**再**改状态进入新页。顺序颠倒会把目标页状态当成来源快照。
- **`navOpen` 按名字去重**：`name`（缺省取 `nameOf()`）已在栈中 → 该次入栈被忽略（日志 `重复入栈已忽略`）。`nameOf()` 是在**改状态前**求值的，所以它返回的通常是"来源页"的名字。
- **Tab 根切换清栈**：商户端 `setTab(t)` 内部执行 `navReset()`；用户端 `setTab` 不重置。
- **⚠️ 跨 Tab 程序性跳转必须保留栈**：`goVehicleDetail` / `goBatteryDetail` / `goUserDetail` 的模式是「先 `navOpen()` 压入来源快照 → `setTab(目标 Tab)` → 打开目标页」。若 `setTab` 执行 `navReset()`，刚压入的这层会被一并清掉，目标页成为**栈空页**，返回只能走 `navBack()` 的边界兜底落到首页（症状：车辆详情 → 用户详情 → 返回 → 直接回商户端首页）。因此这三个调用点传 `setTab(t, true)`；底部 Tab 手动点击仍不传参（保持清栈语义）。
- **`navBack` 边界兜底**：栈空且当前状态 ≠ `_rootSnap` 时"恢复首页"并打日志 `边界兜底·恢复首页`；栈空且等于根快照则原地不动。排查"返回落点不对"先看这条日志。
- **⚠️ 跨 Tab 返回不要闪**：`navBack` / `navSwap` 在还原快照前会给 `<html>` 加 `nav-noanim` 类、`setTimeout 60ms` 后移除；配套 CSS 让 `.nav-noanim .tab-fade-*{enter,leave}-{active,from,to}` 全部 `transition:none;opacity:1;transform:none`。原因：还原历史页时 `tab` 从 `profile`→`vehicles` 触发外壳 `<transition name="tab-fade" mode="out-in">`，`out-in` 旧 Tab 离场后会留约 0.2s 空白间隙（= 返回时"闪一下"）。正向跳转（`setTab` 进新页）**不**加 `nav-noanim`，`tab-fade` 动画照常保留。改返回逻辑或 `tab-fade` 时要维持这个静默机制。
- **⚠️ 顶部导航栏已组件化 `<nav-bar>`（2026-09-16）**：全部子页头部统一用共享组件 `nav-bar`（`registerSheetKit` 内注册，双端可用），**禁止再手写** `pt-14 px-4 pb-3 flex items-center` 头部。用法：`<nav-bar title="车辆详情" @back="navBack()"></nav-bar>`；右侧动作 `<template #right>`（内容须在 32px 内：单图标或 2 字文本按钮）；`border-color` 传 `''` 关闭底部分割线；`bg` 自定义背景；`:back="false"` 时左侧仍占位 32px 保标题居中。组件内部左右恒 32px 对称（返回按钮/占位 ↔ 右侧槽），标题 `flex-1 text-center` 恒居中——历史坑：手写 `mr-8` 补偿式头部在带右侧动作时标题左偏 14px+。当前已迁移 **79 处**，保留手写的仅：搜索栏头部 ×2、`arrow-left` 变体 ×2、深色扫码头部、仅返回按钮无标题页 ×1。动态标题用 `:title="expr"`，静态用 `title="中文"`（见 §8.6 迁移脚本约定）。
- **回归判据**：控制台 `[页面栈]` 日志应严格配对（`push A ← B` 对应 `back B → A`）；跨 Tab 跳转后**不应**出现紧邻的 `reset 清空N层`。返回过程中逐帧采样 `#root-merchant .flex-1.relative.flex.flex-col.overflow-hidden` 的 `opacity` 应恒为 `1`（无空白帧），且 `document.documentElement` 含 `nav-noanim`；正向跳转则 `opacity` 应出现 `0` 且不含 `nav-noanim`（动画保留）。栈变化也可由 `navLog()` 主动打印，无需探针。

## 10. 共享 UI 组件清单（registerSheetKit 内注册，双端可用）

2026-09-16 组件化第二批（在 `nav-bar` 基础上新增 4 个）。**禁止再手写同形态标记**：

- **`<confirm-dialog>`**：居中确认弹窗（遮罩 rgba(0,0,0,.45) + 300px 白卡 + 标题/描述/取消确认 + loading 遮罩 spinner）。用法：`<confirm-dialog :open="showX" title="解绑车辆" desc="..." :loading="xLoading" z="2000" oid="xx" @close="closeX()" @confirm="confirmX()"></confirm-dialog>`。中间额外内容（输入框等）放默认 slot；`:mask-close="false"` 禁止点遮罩关闭（loading 时自动禁点双按钮）。已迁移 **19 处**（2026-09-16 第二批 10 处按"多数交互"归一：遮罩可点关、loading 走遮罩层——`vehMod/battMod/psConfirmMod/ordersMod/profileMod/uUnbindMod/alertMod/roCancelMod/roRefundConfirm/docDeleteMod`，其中拆分双 transition 的 4 处已消除；`confirm-bg` prop 支持危险操作红钮如 docDeleteMod）。仅剩 1 处手写：`newAccCred`（账号创建成功）是单按钮结果提示弹窗，非取消/确认对，不适配该组件。
- **`<empty-state>`**：空状态（图标圆 + 主文案 + 次文案 + 默认 slot 附加按钮）。用法：`<empty-state icon="bike" text="暂无车辆"></empty-state>`；圆/图标/文案样式可用 `circle-class/icon-class/text-class` 覆盖；根节点普通 div，支持 v-if/v-else 与 data-od-id 透传。已迁移 **18 处**；2 处结构特殊保留手写。
- **`<tab-bar>`**：底部导航。用法：`<tab-bar :items="[{key:'home',icon:'home',label:'首页',activeWhen:tab==='home',hidden:!can('home.view'),go:function(){setTab('home')}}]" :show="!showLogin" active-color="#2B3F5F" @select="setTab"></tab-bar>`；无 `go` 时 @select 抛 item.key；两端各 1 处已迁移（用户端 #FF6A00 / 商户端 #2B3F5F）。
- **`<page>`**：全屏子页容器（transition + absolute inset-0 + 可选下滑关闭）。用法：`<page :open="vehOV==='detail'" :z="560" :swipe-close="()=>goBack()">...内容...</page>`；`trans` 可选 'sl'/'fd'。已迁移 **28 处**（全部 `transition name="sl" + v-swipe-close + 标准类` 形态）；其余形态（fd 淡入页、无滑动页等）按需增量迁移，**新子页一律用 `<page>`**。

组件迁移通用注意：静态文本属性传 `title="中文"`，表达式才用 `:title`；`z` 等 Number prop 用静态属性 `z="2000"` 会自动转换；迁移脚本对"某子元素强制当标题"的解析有误伤风险（empty-state 把第 2 个子元素当 text），迁移后必须浏览器逐页抽查。
