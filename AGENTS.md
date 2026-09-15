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
