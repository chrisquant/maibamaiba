# 日均物品成本摊销 APP 开发文档（改进可执行版）

---

## 0. 文档定位

- 本文档是原《日均物品成本摊销APP开发文档》的改进执行版。
- 目标：降低实现风险、明确分期范围、提供可直接落地的开发与测试清单。
- 约束：纯本地离线、iOS 竖屏优先、不依赖云端服务。

---

## 1. 可行性结论与实施策略

### 1.1 可行性结论

- 产品可行：场景闭环完整，离线本地存储与需求高度匹配。
- 技术可行：Expo + React Native + SQLite 可以覆盖全部核心能力。
- 交付可行：建议按里程碑分期，避免首版功能过载。

### 1.2 实施策略（核心原则）

- 精度依赖前台补算，后台任务仅作增强，不作为准确性保证。
- 首版优先“记账与核算可用”，再叠加提醒、图表交互、体验优化。
- 依赖版本不硬编码 React Native 小版本，统一以 Expo 官方配套版本为准。

---

## 2. 技术基线（修订版）

### 2.1 框架与运行环境

- React Native（由 Expo SDK 当前稳定版托管）
- Expo（当前稳定版本，项目初始化后以 `expo doctor` 校验）
- 平台：iOS 14.0+，竖屏
- Node.js 20+

### 2.2 依赖安装原则（重要）

- 使用 `npx create-expo-app` 初始化项目。
- 使用 `npx expo install <pkg>` 安装与 Expo 兼容的依赖版本。
- 对非 Expo 托管库，使用 `npm install <pkg>`，再执行 `npx expo doctor` 验证。

### 2.3 依赖清单（建议）

```bash
# 路由
npx expo install @react-navigation/native @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# 数据与本地能力
npx expo install expo-sqlite @react-native-async-storage/async-storage
npx expo install expo-image-picker expo-document-picker expo-sharing expo-file-system
npx expo install expo-notifications expo-task-manager expo-background-fetch

# 动画与图表
npx expo install react-native-reanimated react-native-gesture-handler
npm install victory-native

# 表单
npm install react-hook-form zod @hookform/resolvers
```

> 注意：原文档中的 `react-navigation/native`、`react-navigation/bottom-tabs` 为错误包名，应使用 `@react-navigation/...`。

---

## 3. 分层架构与目录规范

```text
src/
├── db/
│   ├── database.ts
│   ├── migrations/
│   ├── assetRepository.ts
│   ├── categoryRepository.ts
│   ├── wishRepository.ts
│   └── addFeeRepository.ts
├── domain/
│   ├── models/
│   ├── calculators/
│   └── validators/
├── hooks/
├── contexts/
├── screens/
├── components/
├── services/
│   ├── backupService.ts
│   ├── notificationService.ts
│   └── imageService.ts
└── utils/
```

- `db`：SQL 与迁移。
- `domain`：计算公式、输入校验、状态规则，避免散落在 UI。
- `services`：备份、通知、媒体等系统能力封装。
- `screens`：只做展示与事件分发，不写 SQL。

---

## 4. 数据模型与关键约束

### 4.1 表结构（沿用并补强）

- `asset`、`category`、`wish`、`addFeeItem` 四张表沿用原方案。
- 增加以下约束建议：
  - `asset.buyTime` 必须 `<= 今天`。
  - `asset.price >= 0`。
  - `asset.useCount >= 0` 且整数。
  - `asset.status in (0,1,2,3)`。
  - 卖出状态时 `sellPrice >= 0`。

### 4.2 冗余字段策略

- `asset.addFee`、`asset.holdDays`、`asset.dailyCost` 为冗余字段，允许缓存，必须在以下操作后重算并落库：
  - 新增/编辑资产；
  - 新增/删除附加费；
  - 状态变更；
  - App 回前台时补算。

### 4.3 核心计算规则（保持不变）

```text
基础日均成本 = (购入价 + 附加费总和) / 持有天数
净日均成本   = (购入价 + 附加费总和 - 卖出残值) / 持有天数
单次使用成本 = (购入价 + 附加费总和) / 使用次数
持有天数     = 当前日期 - 购买日期（自然日）
```

---

## 5. 持有天数更新机制（落地版）

### 5.1 主方案（必须）

- 监听 `AppState` 进入 `active`。
- 执行 `refreshAllAssets()`：
  - 仅刷新 `status = 0`（服役中）；
  - 批量更新 `holdDays`、`dailyCost`、`updatedAt`；
  - 刷新完成后再触发列表渲染。

### 5.2 辅助方案（可选增强）

- 注册 `expo-background-fetch` + `expo-task-manager`。
- 仅做尽力更新，不承诺准点执行。
- 任何业务正确性不能依赖后台任务。

---

## 6. 功能分期与里程碑

## M0（项目初始化，1-2 天）

- 初始化 Expo 项目与目录。
- 建立 SQLite 初始化与迁移框架。
- 完成主题色、基础组件（Button/Input/Card/Modal/Toast/EmptyState）。
- 交付标准：可运行壳工程 + 可创建数据库。

## M1（MVP 核心闭环，5-7 天）

- 首页资产列表（筛选、搜索、左滑操作）。
- 资产新增编辑页（含附加费动态录入）。
- 资产详情页（状态更新、加附加费、记使用次数）。
- 前台补算 `refreshAllAssets()`。
- 交付标准：可以完整录入资产并稳定计算日均成本。

## M2（数据能力增强，3-4 天）

- 统计页（基础折线 + 饼图 + 排序）。
- 心愿清单（新增/编辑/删除/转资产）。
- 分类管理（默认分类不可删，删除后归类“其他”）。
- 交付标准：统计与心愿流程可用，分类规则正确。

## M3（系统能力与发布准备，3-5 天）

- 数据备份与恢复（JSON）。
- 保修提醒（通知权限、注册/取消策略）。
- 清空数据（含图片清理）。
- EAS 构建、TestFlight 验证、上架材料准备。
- 交付标准：可打包可测试，具备提审条件。

---

## 7. 页面范围说明（与原方案对齐）

- 底部 Tab：资产首页、数据统计、心愿清单、个人中心。
- 资产新增编辑页、资产详情页为栈内页面。
- 若排期紧张，统计页先上线“静态汇总 + 简化图表”，交互后补。

---

## 8. 备份恢复策略（修订）

### 8.1 导出

- 文件名：`cost-backup-YYYYMMDD-HHmm.json`。
- 内容：四张表 + `exportedAt` + `appVersion` + `schemaVersion`。
- 图片策略：仅导出路径，不导出二进制。

### 8.2 导入

- 校验 JSON 结构、版本字段、必需键。
- 仅支持“覆盖恢复”，不做复杂 merge。
- 恢复流程：事务清空 -> 批量写入 -> 重算冗余字段 -> 刷新上下文。

### 8.3 失败回滚

- 导入必须包裹事务，任何错误回滚到导入前状态。

---

## 9. 通知提醒策略（iOS）

- 仅本地通知，不涉及远程推送。
- 用户开启“保修提醒”时申请权限；拒绝则开关自动回退关闭。
- 每个有保修日期的资产维护独立通知 ID，便于更新与取消。
- 保修日前 7 天至当天，每天 09:00 推送一条。

---

## 10. 验收标准（功能 + 数据正确性）

### 10.1 核心用例

- 当天购买资产：持有天数 0，日均成本显示 `—`。
- 未来日期：禁止保存。
- 附加费可负但总费用不可负。
- 卖出残值大于成本：净日均为负，正确展示“溢价”语义。
- 使用次数 0：单次成本显示 `—`。
- 状态切到非服役中：后续不再累计持有天数。

### 10.2 一致性用例

- 首页列表、详情、统计汇总数值一致。
- 新增附加费后，资产总成本与日均成本同步变化。
- 从后台回前台后，持有天数按自然日补算正确。

### 10.3 容错用例

- SQLite 初始化失败显示全屏错误页且可重试。
- 相册权限拒绝、图片选择失败不阻断业务。
- 恢复文件非法时给出明确提示且不破坏现有数据。

---

## 11. 开发质量门禁（必须执行）

- TypeScript 严格模式开启（`"strict": true`）。
- 关键 domain 逻辑有单元测试（计算器、校验器、日期差）。
- 至少 1 轮真机回归（新增、编辑、删除、备份恢复、通知）。
- 每个里程碑结束跑一次完整冒烟清单。

---

## 12. 发布与提审清单

- `app.json` 中 `bundleIdentifier` 全局唯一且与 App Store Connect 一致。
- 权限文案（相册、相机、通知）与实际功能一致。
- 提供可访问隐私政策 URL（说明“纯本地、无账号、无云同步”）。
- 准备真实截图（与功能一致，不夸大）。
- 先走 TestFlight 内测，再提交正式审核。

---

## 13. 已识别风险与应对

- 依赖冲突风险：统一 `expo install`，每次改依赖后执行 `expo doctor`。
- 后台任务不稳定：业务正确性仅依赖前台补算。
- 图表性能风险：大数据量时降采样、分页或限制时间窗口。
- 通知管理复杂：以“每资产固定通知 ID”策略避免重复与泄漏。

---

## 14. 建议的下一步执行动作

1. 按本文件创建 M0 任务清单并初始化工程。
2. 先实现 `database + repository + calculator + validator` 四件套。
3. 完成 M1 后再接入统计和通知，避免前期分心。

---

*文档版本：v2.0-exec | 更新日期：2026-05-04*
