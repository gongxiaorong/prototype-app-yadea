# key 命名规范化清单（通用文案归通用子命名空间）

生成日期：2026-09-29　｜　依据：`AGENTS.md` §5（命名空间划分）

口径：**通用 UI 文案**（确定 / 至 / 其他 / 取消 / 完成…）应置于 `common` 的**通用子命名空间**（`common.action.*`、`common.label.*`、`common.dateTime.*`、`common.toast.*`、`common.status.*` 等）；**专有文案**才留在 `common.orders.*` / `common.profile.*` / `user.*` / `merchant.*` 等语境位。

判定方法：扫描两端 zh-CN，凡「文案 ∈ 通用词表」却挂在「非通用位」的 key 即候选。跨目录同一中文须合并到**同一个** `common.*` 键（`common.*` 在两目录逐字一致）。

## 候选清单（19 条）

| # | 中文 | 现 key（目录） | 建议 key |
|---|---|---|---|
| 1 | 确定 | `common.orders.filterConfirm`（rent/swap） | `common.action.confirm` |
| 2 | 至 | `common.orders.filterDateTo`（rent/swap） | `common.dateTime.rangeTo` |
| 3 | 其他 | `common.orders.docOther`（rent/swap） | `common.label.other` |
| 4 | 下一步 | `common.profile.nextStep`（rent/swap） | `common.action.nextStep` |
| 5 | 设置 | `common.profile.menuSettings`（rent/swap） | `common.label.settings` |
| 6 | 无内容可复制 | `common.copy.empty`（rent/swap） | `common.toast.nothingToCopy` |
| 7 | 保存成功 | rent `user.common.saveSuccess` ｜ swap `merchant.common.saveSuccess` | `common.toast.saveSuccess` |
| 8 | 复制成功 | rent `merchant.orders.idCopied` ｜ swap `label.copied` | `common.toast.copySuccess` |
| 9 | 我知道了 | rent `merchant.profile.iKnow` | `common.action.iKnow` |
| 10 | 收起 | rent `merchant.alert.timelineCollapse` | `common.action.collapse` |
| 11 | 排序 | rent `merchant.profile.modelSort` | `common.action.sort` |
| 12 | 禁用 | rent `merchant.status.disabled` ｜ swap `merchant.cabinet.disable` | `common.status.disabled` |
| 13 | 启用 | rent `merchant.status.enabled` ｜ swap `merchant.cabinet.enable` | `common.status.enabled` |
| 14 | 处理中 | rent `merchant.status.processing` | `common.status.processing` |
| 15 | 完成 | swap `action.done` | `common.action.done` |
| 16 | 重试 | swap `action.retry` | `common.action.retry` |
| 17 | 继续 | swap `action.continue` | `common.action.continue` |
| 18 | 暂无 | swap `label.none` | `common.label.none` |
| 19 | 开启 | swap `demoOps.enable` | `common.action.enable` |

## 说明与待确认

- **不动**的近似项：`common.orders.cancelOrder`=「取消订单」属订单专属动作，保留在 `orders`。
- **跨目录合并**（#7/#8/#12/#13）：现分处两目录的不同 feature key，合并为同一 `common.*` 键后，两目录各删原键。
- **落点**（`common.action` / `common.label` / `common.status` / `common.toast` / `common.dateTime`）为建议，可调整。
- **新建子命名空间**：`common.status`、`common.toast`（当前无）。
- **已落地（2026-09-29）**：19 条全部应用到 5 个语言文件；复跑 `node scripts/i18n_check.mjs` 通过——`common.*` 两目录一致、无 MISSING/ORPHAN、跨目录漂移 0。
