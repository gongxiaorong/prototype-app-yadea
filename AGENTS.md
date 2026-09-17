# AGENTS — 项目规范

单仓库双前端：`index.html`（租车系统 · 用户端 + 商户端合并产物，**唯一权威产物**）与 `swap.html`（换电系统脚手架）。两者均为**单文件 in-DOM 模板** + CDN Vue3 生产构建 + UnoCSS 运行时。Agent 改动必须遵守以下规范。

---

## 1. 权威源与构建红线

- `index.html` 是唯一权威源，直接手改。
- `locales/*.json` 是唯一文案源；禁止在 HTML 内联硬编码新文案。
- 版本控制：改完必须自检（见 §6）；`swap.html` 的独立改动与 `index.html` 分开说明。

## 2. in-DOM 模板铁律

本项目模板由浏览器 HTML 解析器先行解析，以下规则违反即渲染异常：

1. 组件标签**必须 kebab-case**（`<bottom-sheet>`），禁止 PascalCase；注册名与之一致。
2. 组件标签**必须显式闭合** `</bottom-sheet>`，禁止自闭合 `/>`（会被当未闭合起始标签，吞掉后续兄弟节点）。
3. 组件模板**必须单根节点**；含双 `<transition>` 的组件统一外包 `<div class="sheet-root">`（static 定位不占位）。
4. 自定义指令的值**必须是函数**：`v-swipe-close="navBack"` 或 `v-swipe-close="()=>goBack()"`；**严禁**内联调用表达式 `v-swipe-close="$emit('close')"`（每次渲染立即执行 → 弹窗自开自关）。
5. 组件 `template` 是单引号 JS 字符串：内部引号一律写 `\'`，裸写 `''` 会截断整个脚本。
6. 传纯文本用静态属性 `title="中文"`；传表达式才用 `:title="expr"`——`:title="中文"` 会被当变量求值成 undefined。
7. `z` 等 Number prop 支持静态属性自动转换；动态值用 `:z` 绑定表达式。
8. 图标：`registerSheetKit(app)` 已把 `luci` 挂到 `app.config.globalProperties`，组件模板内可直接 `luci('x','w-5 h-5')`。
9. **UnoCSS 是按需运行时**：新 utility 类异步生成，插入 DOM 后立即读 computed style 会误判"类没生效"；等 ~1s 再读或查 `document.styleSheets`。静态 CSS token 不受影响。

## 3. 共享组件清单

全部在 `registerSheetKit(app)` 内注册（SHARED CORE，双端 mount 前各调用一次），双端可用。**禁止再手写同形态标记**。

### nav-bar — 子页顶栏

```html
<nav-bar title="车辆详情" @back="navBack()"><template #right>...</template></nav-bar>
```

- 内部左右恒 32px 对称（返回钮/占位 ↔ 右侧槽），标题 `flex-1 text-center` 恒居中；**禁止手写 `mr-8` 补偿式头部**（带右侧动作时标题必偏）。
- 右侧槽内容须 32px 内（单图标或 2 字文本按钮）；`border-color=''` 关分割线；`bg` 自定义背景；`:back="false"` 左侧仍占位保居中。保留手写头部：搜索栏、`arrow-left` 变体、深色扫码头部、无标题仅返回页。

### page — 全屏子页容器

```html
<page :open="vehOV==='detail'" :z="560" :swipe-close="()=>goBack()">...内容...</page>
```

- props：`open/z(Number)/bg/trans('sl'|'fd')/swipeClose(Function)/oid`；未传 `swipe-close` 时下滑 emit `close`。
- **全屏子页一律用 `<page>`**（手写 `transition name="sl"` 壳已清零）；动态层级写成 `:z` 表达式（如 `:z="idSelectMode?1910:600"`）。

### bottom-sheet / option-sheet — 底部弹窗

**禁止**手写 `transition fd/sh + 遮罩 + bottom-0 面板` 形态，所有底部弹窗只用这两个组件。

- `BottomSheet`：props `open/title/type(A|B)/size(sm|md|lg)/maskZ/handle/showX/oid/panelOid`；emit `close/confirm`；插槽 `default/footer`。A 型 = 居中标题 + 右上角 X；B 型 = `取消｜居中标题｜确定`（**滚轮/日期类一律 B 型**，滚轮标记放 default 插槽，ref 与吸附逻辑随父作用域原样工作）。
- `OptionSheet`：props `open/title/options/modelValue/...`；emit `update:modelValue/select/close`；`options` 支持 `[{value,label}]` 或纯数组（value=下标）。
- **⚠️ `open` 只能声明为「无类型 + `default:false`」，严禁 `open:Boolean`**：调用方大量用字符串 ref 当开关（`userPickActive='vehicle'`、`uWalletSheet=''`），Vue 布尔转换会把 `''` 变 `true`（`[Boolean,String]` 也一样），导致弹窗空值自开且关不掉。只有不声明类型才与手写 `v-if` 语义一致。

统一取值：

| 维度 | 规范 |
| --- | --- |
| 触发/关闭 | 状态 ref 驱动；关闭走**单一 `closeXxx()` 出口**，上下文复位只在出口内做 |
| 结构 | `.sheet-mask`(遮罩) + `.sheet-panel` + `.sheet-handle` + 头部(A/B 型) + 内容区 + 安全区 |
| 样式 | 遮罩 `rgba(0,0,0,.4)`；面板 `rounded-t-[20px]`，高 60%(sm)/70%(md)/92%(lg 长表单)，底距 token 已含 safe-area |
| 动画 | 仅 `.fd`(遮罩) + `.sh`(面板) |
| 交互 | `v-sheet-drag` 下拉 >80px 关闭；内容滚动中不误关（守卫覆盖 `.sheet-scroll/.sheet-opt-list/.sheet-body`） |
| 选项行 | 未选中 `#F6F7F9`/`#111`，选中 `var(--accent)` 底白字加粗 |
| z-index | 面板 = 遮罩 + 1；`mask-z` 沿用原层级，**不做归一** |

内容行 token（定义于 `<style id="layer-base">` 的 `底部弹窗共享组件 token` 段）：

- `.sheet-search`：弹窗内搜索框，只写类名，图标/`<input>` 放插槽。
- `.sheet-body`：内容滚动区（等价 `flex-1 overflow-y-auto min-h-0` + 隐藏滚动条类）；只额外加内边距工具类。未归一的滚动区勿顺手改（属可见变化，需单独决定）。
- **⚠️ sheet 内容行禁止自带底部 `pb-6/7/8`**（面板 token 已含 safe-area 底距，叠加成双重底距）。例外仅：textarea 内部、滚轮轮体留白、滚动区呼吸感——属元素自身语义。
- **swap.html**：已接入同一套共享组件（`registerSheetKit` 含 `bottom-sheet`/`option-sheet`/`nav-bar`/`page`/`confirm-dialog`/`image-viewer`/`empty-state`/`tab-bar`/`loading-overlay`，`.sheet-*` token、`.fd/.sh` 过渡、`globalProperties.luci` 齐备）。保留手写：`loc-auth-modal`（图标在标题上方）与 `newAccCred`（单按钮结果页）；`transition name="fd"` 的全屏/登录带属非子页壳，保留。收敛情况以实际 DOM 为准，勿按旧结论汇报。

联系门店号码行：单行样式、整行点击拨号、**只显示号码**（不加备注/区号）；门店页/订单页/取还信息卡片三入口共用同一弹窗。

### confirm-dialog — 居中确认弹窗

```html
<confirm-dialog :open="showX" title="..." desc="..." :loading="xLoading" z="2000" oid="xx"
  :mask-close="false" confirm-bg="var(--accent)"
  :confirm-text="..." :cancel-text="..." @close="closeX()" @confirm="confirmX()"></confirm-dialog>
```

- 遮罩 rgba(0,0,0,.45) + 300px 白卡 + 双按钮 + loading 遮罩 spinner；额外中间内容放默认 slot。
- `confirm-text/cancel-text` 定制按钮文案；**`cancel-text` 传空串隐藏取消键**（单按钮形态）；`confirm-bg` 支持危险红钮/`var(--accent)`；`:mask-close="false"` 禁点遮罩（loading 时双按钮自动禁点）。
- 例外（保留手写）：`newAccCred`（账号创建成功单按钮结果页）；`swap.html` 的 `loc-auth-modal`（图标位于标题**上方**，而组件渲染顺序固定为 标题→描述→slot，无法表达）。
- 卡片宽度固定 **300px**，按钮用 **`rounded-xl`**；`confirm-bg` 可传渐变字符串（如 `:confirm-bg="'linear-gradient(135deg,#33456B,#22304E)'"`）；单按钮用 `cancel-text=""`；文案/动态色用 `confirm-text`/`confirm-bg` 表达式。

### empty-state — 空状态

```html
<empty-state icon="bike" text="暂无车辆" sub="..."></empty-state>
```

- `root-class/circle-class/icon-class/text-class/sub-class` 覆盖样式：`root-class` 默认 `flex flex-col items-center justify-center py-16`，各页 padding 不同时用它覆盖（如 `root-class="flex flex-col items-center justify-center text-center pt-24"`，或 `pt-[150px]` 走根节点透传的 `style`）；图标无圆底时 `circle-class="contents"`（`display:contents` 让图标 span 直接成为 flex 项，等价于原「裸图标 + 文案」形态）。
- **`icon=""` 隐藏图标圆**（一行文字空态：`icon="" text="未找到匹配地区" text-class="text-[14px] font-normal text-[#999]"`）；根节点普通 div，支持 v-if/v-else、`data-od-id` 与 `style` 透传；默认 slot 渲染在 sub 之后（可用于按钮，如「暂无可用仓位 + 我知道了」）。
- 例外（保留手写）：`swap.html` 的「暂无相关数据」（110px 渐变色方框图标，非圆底）与「暂无套餐」（图标右下带角标圆点）。

### tab-bar — 底部导航

```html
<tab-bar :items="[{key,icon,label,activeWhen,hidden,go}]" :show="!showLogin" active-color="#2B3F5F" @select="setTab"></tab-bar>
```

无 `go` 时 `@select` 抛 `item.key`。

### loading-overlay — 全屏 loading 遮罩

```html
<loading-overlay :open="showXLoading" brand oid="xx-loading"></loading-overlay>
```

`brand` 模式渲染 yadi-loading 品牌圆环，否则 spinner + 可选 `text`；默认 z-3000、bg rgba(255,255,255,.7)，`z/bg` 可覆盖。

### image-viewer / exited-view — 双端同构内容组件（须放 `<page>` 壳内）

```html
<page :open="previewImage" :z="2500" trans="fd" oid="image-preview"><image-viewer :src="previewImage" @close="previewImage=null"></image-viewer></page>
<page :open="appExited" :z="950" trans="fd" oid="app-exited-overlay" bg="black"><exited-view @relaunch="relaunchApp"></exited-view></page>
```

`image-viewer` 的 `tip` 定制关闭提示；双端 z 差异留在壳层。`login` 双端差异为结构性（错误提示行/头部关闭钮/enter 提交），**维持双端各自实现，不抽取**。

## 4. 页面栈导航（快照式）

`createNav({screens, pageRefList})` 双端各一份；`pageRefList` 为参与快照/恢复的 ref 列表；运行期追加 ref **只能**走返回的 `navAddRefs(list)`（内部同步重捕根快照，保证各次快照长度一致；直接改 `pageRefList` 会让兜底恢复把后加的 ref 写成 `undefined`）。

> **适用范围**：两端**同一实现**（`index.html` 与 `swap.html` 的 `createNav` 逐字相同）。差异仅在接线方式：index 每端各建一个实例；swap 把实例建在 `authState()` 工厂内（每端各一份），页面级状态通过 `auth.addNavRefs([...])` 在 setup 末尾注册进快照。
> - `swap.html` 用 `NAV_SCREENS` 承接页面打开动作（`ovInfo/subLang/subBindPhone/...`），`nameOf()` 由 `profileSub → profileOV → showLogin` 推导；**新增页面时两者都要登记**。app 级页面（`station/swap/cardPack/deposit/battery*/planOrder*`）无 screen——由入口函数先 `navOpen('xxx')` 再改状态。
> - 页面级 ref（`tab/swapShow/swapStep/curStation/curCab/batteryDetailRec/planOrderDetail/swapRecordsScope`）注册进快照；**数据类 ref 不得注册**（`idSingle/depositState/swapRecords/batteryList` 等，注册会导致保存后被回滚）。
> - **`nav-noanim` 两端统一**：`tab` 都在 `pageRefList` 内，`tab-fade` 过渡两端同名同参（index 为单一包装 `out-in`；swap 为三个块级过渡交叉淡入），`.nav-noanim` 抑制规则两端各一份（改一处必须同步另一处）。swap 商户端无 Tab 内容切换，该处不产生动画差异。
> - 新增 `navOpen('名')` 时必须能落到某个 screen，或紧随其后有状态赋值（否则是死入口）。

- **入栈顺序**：先 `navOpen()`（快照 = 来源页），再改状态进新页；顺序颠倒会把目标页状态当来源快照。
- **按名去重**：`name`（缺省取 `nameOf()`）已在栈中 → 入栈被忽略（日志 `重复入栈已忽略`）。排查"页面进不去"先看这条。
- **保存后返回用 `navBack()`**：它弹栈**并恢复快照**；`navDrop` 只弹栈不恢复——保存表单后回列表页一律 `navBack()`（除非 `idInfoList` 这类未入快照的数据，恢复不会回滚）。误用 `navDrop` 会导致栈残留旧页名、再次进入被去重吞掉。
- **跨 Tab 跳转**：`goVehicleDetail/goBatteryDetail/goUserDetail` 模式 = 先 `navOpen()` → `setTab(t, true)` → 打开目标页；传 `true` 避免 `setTab` 清栈。底部 Tab 手动点击不传参（保持清栈）。
- **`navBack` 边界兜底**：栈空且状态 ≠ 根快照 → 恢复首页（日志 `边界兜底·恢复首页`）。
- **返回不闪**：`navBack/navSwap` 还原快照前给 `<html>` 加 `nav-noanim`（60ms 后移除），抑制 `tab-fade` 过渡（index 单包装 `out-in` / swap 块级交叉淡入）造成的空白帧；正向 `setTab` 不加，动画保留。改返回逻辑或 `tab-fade` 时必须维持该机制，且两端 `.nav-noanim` 规则同步。
- **回归判据**：`[页面栈]` 日志 push/back 严格配对；跨 Tab 跳转后不应出现紧邻 `reset`；返回过程容器 `opacity` 恒 1 且含 `nav-noanim`，正向跳转出现 `opacity 0` 且不含。

## 5. 多语言（i18n）

### 文件与方向

- `locales/` 下 5 个文件：`zh-CN.json`（**唯一权威源**）→ `zh-HK / en / id / th`（单向同步，互不派生、不回写）。
- 嵌套 JSON、点路径 key、五语言同路径同名；UTF-8 无 BOM、2 空格缩进、结尾换行。
- 占位符用 vue-i18n `{name}`，五语言名称与数量必须一致。
- **禁止数字后缀 key**（`menu.home0` 类复制粘贴残留），出现即删。

### 命名空间划分

| 层 | 前缀 | 归属 |
| --- | --- | --- |
| 共享 | `common.*` | 两项目共用术语（货币/操作/状态/单位/语种） |
| 租车 | `rental.user.* / rental.merchant.* / rental.demo.*` | `index.html` |
| 换电 | `swap.*`（业务页用 `swap.user.* / swap.merchant.*`） | `swap.html` |

两项目共用同一组 5 文件，键集合完全一致。

### 变更流程

```
检测（node scripts/i18n_check.mjs，按 shared/rental/swap 分组输出 MISSING/CHANGED/ORPHAN/占位符·数字不一致）
→ 新增/变更 key 先写源语言值占位 → 显式翻译（禁止机翻直接入库、禁止中文常驻译文）
→ 重跑校验：key 集合一致、占位符与数字集合一致、无数字后缀
→ 格式归一化后提交（幂等：已译项不覆盖）
```

术语基线：车辆=Vehicle/Kendaraan/ยานพาหนะ、押金=Deposit/Jaminan、退款=Refund/Pengembalian Dana。

## 6. 改动自检清单（提交前必做）

1. **内联脚本语法**：提取 `<script>` 跑 `new Function(code)`。
2. **标签配平**：`div/transition/page/组件标签` 开闭成对；推荐栈式校验（div/page/transition 计数）而非简单计数——注意注释里的示例标签会造成计数误报。
3. **挂载冒烟**：双端 `.sheet-root` 数量符合预期（为 0 = 挂载失败）；静置 `.sheet-panel` 计数为 0（`open` prop 空值陷阱自查）。
4. **浏览器诊断**：生产构建下 `app._instance` 为 `null`，判断挂载失败勿据此下结论——用 DOM 判据（`.sheet-root`、面板出现、computed style）；需读 setup 状态时用 `el._vnode.component.setupState`（只读调试，勿写回）。
5. **逐页抽查**：打开稳定、选中回调生效并关闭、X 关闭、下滑关闭、控制台 0 错误；迁移"取值逐项照搬、只换壳"，沿用原 z/mask-z，不做归一。

## 7. 已知坑速查

| 症状 | 根因 | 规则 |
| --- | --- | --- |
| 弹窗空值自开且关不掉 | `open:Boolean` 把 `''` 转 `true` | `open` 只声明 `{default:false}` |
| 组件不渲染 / `Failed to resolve component` | PascalCase 或自闭合 | §2.1/2.2 |
| 弹窗一打开立即关闭 | 自定义指令写了内联调用表达式 | §2.4，一律传函数 |
| 组件模板内 `luci is not a function` | 依赖全局作用域 | 已由 `globalProperties` 兜底 |
| 页面进不去，日志 `重复入栈已忽略` | 栈残留旧页名（如保存后误用 `navDrop`） | 保存后用 `navBack()`（§4） |
| 返回时闪白 | 还原快照时 Tab 过渡的空白帧 | `nav-noanim` 机制（§4） |
| sheet 底距异常偏大 | 内容行自带 `pb-*` 与面板 token 叠加 | §3 内容行禁 `pb-6/7/8` |
| 新 utility 类"没生效" | UnoCSS 按需异步生成 | 等 ~1s 或查 `styleSheets`（§2.9） |
| 挂载失败误判 | 生产构建 `app._instance` 为 `null` | §6.4 用 DOM 判据 |
| 迁移后标题偏移 | 手写头部 `mr-8` 补偿 | 一律用 `nav-bar`（§3） |
