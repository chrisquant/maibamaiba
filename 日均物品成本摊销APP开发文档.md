# 日均物品成本摊销 APP React Native 开发文档

---

## 一、文档概述

- **开发框架**：React Native + Expo（支持 Expo Go 热重载，代码修改实时真机预览，无需编译打包，适配快速开发）
- **数据存储**：纯本地存储，采用 Expo SQLite + AsyncStorage，无云端同步、无网络请求，全程离线运行
- **运行平台**：iOS（iPhone 竖屏专属，适配 iOS 14.0 及以上版本），支持 Expo Go 实时预览、正式打包上架 App Store
- **技术栈**：React Native 0.74+、Expo SDK 52+、expo-sqlite（v14+）、React Navigation v6、React Hook Form v7、Reanimated v3（动画）、Victory Native XL（图表）、expo-notifications、expo-image-picker、expo-document-picker、expo-sharing
- **开发模式**：分层组件架构（数据层 / 业务逻辑层 / UI 层），组件化开发，热重载实时预览，所有功能均为必开发项

> **依赖版本参考（package.json）**
> ```json
> {
>   "expo": "~52.0.0",
>   "react-native": "0.74.5",
>   "react-navigation/native": "^6.1.18",
>   "react-navigation/bottom-tabs": "^6.6.1",
>   "react-hook-form": "^7.53.0",
>   "react-native-reanimated": "~3.10.1",
>   "victory-native": "^41.0.0",
>   "expo-sqlite": "~14.0.3",
>   "expo-notifications": "~0.28.0",
>   "expo-image-picker": "~15.0.7",
>   "expo-document-picker": "~12.0.2",
>   "expo-sharing": "~12.0.1"
> }
> ```

---

## 二、核心技术规范

### 1. 开发与预览规则

- **开发环境**：Node.js 20+、Expo CLI（`npx expo`）、VS Code
- **预览方式**：手机安装 Expo Go，连接同一 WiFi，扫描终端二维码，代码保存即实时热重载预览，无编译等待
- **样式规范**：使用 `StyleSheet.create()` 创建样式，单位用 dp，适配 iPhone 全机型竖屏，禁止横屏
- **数据处理**：所有金额保留 2 位小数，日期采用本地系统时间
- **全局状态**：使用 Context API + useReducer 管理全局数据（资产列表、分类、设置），按数据域拆分多个 Context，避免单一巨型 Context

### 2. 持有天数更新机制（重要）

> ⚠️ **iOS 平台限制说明**：iOS 系统严格限制 App 后台执行，`expo-background-fetch` 的触发时机由系统调度，无法保证每日 0 点精确执行。**主方案**为前台补算，后台刷新作为辅助。

**主方案（前台补算，必须实现）**：
- App 每次启动（`AppState` 从 `background`/`inactive` 切换至 `active`）时，检查所有"服役中"资产的上次更新日期
- 若上次更新日期早于当前日期，立即补算持有天数并重新计算日均成本
- 补算逻辑写入 SQLite 工具类 `refreshAllAssets()`，确保数据在用户看到页面前已更新

**辅助方案（后台刷新，尽力而为）**：
- 使用 `expo-background-fetch` + `expo-task-manager` 注册后台任务
- 明确接受系统可能延迟或跳过执行，不作为数据准确性的依赖
- 后台任务仅执行 SQLite 更新，不触发 UI 刷新

```typescript
// App.tsx — AppState 监听示例
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { refreshAllAssets } from './db/assetRepository';

export function useAppStateRefresh() {
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (appState.current !== 'active' && next === 'active') {
        await refreshAllAssets();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);
}
```

### 3. 核心计算公式（固定不可修改）

```
1. 基础日均成本   = (物品购入价 + 附加费用总和) / 已持有天数
2. 净日均成本     = (物品购入价 + 附加费用总和 - 卖出残值) / 已持有天数
3. 单次使用成本   = (物品购入价 + 附加费用总和) / 实际使用次数
4. 已持有天数     = 本地当前日期 - 购买日期（自然日，停用/报废/卖出后停止累计）
```

### 4. 边界情况处理规范

| 场景 | 处理规则 |
|------|----------|
| 持有天数为 0（当天购买） | 显示"今日购入"，日均成本展示为 `—`，不参与计算 |
| 持有天数为负（购买日期填了未来） | 校验不通过，日期选择器禁止选择今天之后的日期 |
| 附加费用为负数（如返现） | 允许输入负值，但总费用（购入价 + 附加费总和）不得为负，否则提示"费用合计不能为负" |
| 卖出残值 > 购入价 + 附加费总和 | 允许（代表溢价出售），净日均成本显示为负值并标注"（溢价）" |
| 使用次数为 0 | 单次使用成本显示为 `—`，不参与计算 |
| SQLite 写入失败 | Toast 提示"保存失败，请重试"，不关闭表单，保留用户输入 |
| 图片选择失败 / 权限被拒 | Toast 提示"无法访问相册，请在系统设置中开启权限"，图片区域保持空占位 |
| 数据库初始化失败 | 全屏错误页，提示"数据初始化失败，请重启 App"，提供重试按钮 |

### 5. 数据库表结构（本地 SQLite）

**asset 表（资产表）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 主键，自增 |
| name | TEXT NOT NULL | 物品名称 |
| price | REAL NOT NULL | 购入价（≥ 0） |
| buyTime | TEXT NOT NULL | 购买日期，ISO 8601 格式 `YYYY-MM-DD` |
| category | TEXT | 分类名称 |
| image | TEXT | 图片本地路径 |
| addFee | REAL DEFAULT 0 | 附加费用总和（可为负） |
| useCount | INTEGER DEFAULT 0 | 使用次数 |
| warrantyTime | TEXT | 保修日期，ISO 8601 格式 |
| targetCost | REAL | 目标日均成本 |
| status | INTEGER DEFAULT 0 | 0 服役中 / 1 已停用 / 2 已卖出 / 3 报废丢失 |
| sellPrice | REAL DEFAULT 0 | 卖出残值 |
| remark | TEXT | 备注 |
| holdDays | INTEGER DEFAULT 0 | 持有天数（冗余字段，由程序维护） |
| dailyCost | REAL DEFAULT 0 | 日均成本（冗余字段，由程序维护） |
| updatedAt | TEXT | 最后更新时间，用于补算判断 |

**category 表（分类表）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 主键，自增 |
| name | TEXT NOT NULL | 分类名称 |
| icon | TEXT | 分类图标（emoji 或图标名） |
| isDefault | INTEGER DEFAULT 0 | 1 = 系统默认分类，不可删除 |

**wish 表（心愿单表）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 主键，自增 |
| name | TEXT NOT NULL | 物品名称 |
| expectPrice | REAL | 预估价格 |
| expectDays | INTEGER | 目标持有天数 |
| expectDaily | REAL | 预估日均成本（由前两项自动计算） |
| level | INTEGER | 心仪程度（1–5） |

**addFeeItem 表（附加费用明细表）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 主键，自增 |
| assetId | INTEGER NOT NULL | 关联 asset.id |
| amount | REAL NOT NULL | 费用金额（可为负） |
| remark | TEXT | 费用备注 |
| createdAt | TEXT | 创建时间 |

> 附加费用单独存表，asset.addFee 为聚合冗余字段，每次新增/删除费用后同步更新。

---

## 三、全局交互规范

- **点击反馈**：所有可点击组件添加按压透明度变化（`activeOpacity: 0.8`）
- **表单校验**：必填项为空时提交按钮置灰不可点击，给出红色文字提示（字号 12dp，颜色 `#ef4444`）
- **数据刷新**：下拉刷新、从子页面返回上一页时自动刷新列表，保证数据实时同步
- **弹窗提示**：删除、清空数据等危险操作，必须弹出二次确认弹窗，明确提示操作不可撤销
- **空状态**：无数据页面展示占位图 + 提示文字，禁止展示空白页面
- **Toast 提示**：操作成功/失败均通过底部 Toast 反馈，显示 2 秒后自动消失

---

## 四、页面完整开发规范（共 6 个主页面）

### （一）底部 Tab 导航页（全局容器）

#### 1. 布局设计

- 固定底部 Tab 栏，高度 60dp，背景色 `#FFFFFF`，选中图标 + 文字 `#2563eb`，未选中 `#9ca3af`
- 包含 4 个 Tab 项：首页资产、数据统计、心愿清单、个人中心
- 采用 React Navigation Bottom Tabs 实现，切换无刷新，支持左右滑动切换

#### 2. 功能实现

- 初始化本地 SQLite 数据库，创建全部数据表（含迁移版本号管理）
- App 启动及每次从后台切回前台时，调用 `refreshAllAssets()` 补算所有"服役中"资产的持有天数与日均成本
- 全局状态初始化，加载本地存储的资产、分类、心愿单数据

---

### （二）页面 1：首页（资产列表页）

#### 1. 页面布局（从上至下）

**顶部导航栏**
- 高度 50dp，背景色 `#2563eb`，居中显示 APP 名称（白色加粗，字号 20dp）
- 右侧放置两个图标按钮：搜索图标（白色）、添加 + 图标（白色）

**全局数据汇总卡片**
- 通栏卡片，左右边距 10dp，上下边距 8dp，高度 70dp，圆角 10dp，背景色 `#FFFFFF`，阴影效果
- 内部横向三等分，居中展示：总资产金额（加粗）、总日均成本（加粗）、物品总数量，字号 16dp，标签文字灰色 12dp

**分类横向滚动栏**
- 横向滚动布局，高度 40dp，左右边距 10dp，item 间距 15dp
- 默认分类：数码、家电、服饰、汽车、其他；支持自定义分类展示
- 选中分类：背景色 `#2563eb`，文字白色；未选中：背景色 `#f3f4f6`，文字灰色

**资产卡片列表**
- 竖向列表，下拉刷新功能，item 间距 10dp，左右边距 10dp
- 单张卡片：高度 90dp，圆角 10dp，背景色 `#FFFFFF`，阴影效果
- 卡片内部布局：左侧图片缩略图（60×60dp，圆角 8dp）→ 中间文字区域（物品名称 16dp 加粗、已使用 X 天 12dp 灰色）→ 右侧日均成本（18dp 加粗 `#2563eb`，单位 元/天）
- 空状态：居中展示占位图片 + 文字"点击右上角 + 添加首个资产"，字号 14dp 灰色

#### 2. 交互逻辑

- **搜索按钮**：点击弹出搜索弹窗，输入框支持按物品名称、分类模糊搜索，实时筛选列表
- **添加按钮**：点击跳转资产新增编辑页
- **卡片点击**：跳转资产详情页
- **卡片左滑**：弹出操作栏（编辑、删除、更改状态），点击对应按钮执行操作
- **分类点击**：筛选对应分类资产，无数据显示空状态
- **下拉刷新**：调用 `refreshAllAssets()` 重新计算所有资产数据，刷新列表与全局汇总数据
- **列表上拉**：无分页，全部数据一次性加载

---

### （三）页面 2：资产新增编辑页

#### 1. 页面布局（竖向滚动表单）

**顶部导航栏**
- 左侧：取消按钮（文字 `#2563eb`，字号 16dp）
- 中间：标题（新增资产 / 编辑资产，字号 18dp 加粗）
- 右侧：保存按钮（文字 `#2563eb`，字号 16dp，必填项为空时置灰不可点击）

**表单区域（ScrollView 包裹，上下边距 15dp）**

| 表单项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| 图片上传 | 图片选择 | 否 | 方形占位框 100×100dp，圆角 10dp，虚线边框；点击弹出选择框（拍照 / 从相册选择） |
| 物品名称 | 文本输入框 | 是 | placeholder"请输入物品名称"，为空时红色提示 |
| 分类 | 下拉选择器 | 是 | 点击弹出分类选择弹窗 |
| 购入价格 | 数字输入框 | 是 | 数字键盘，值须 ≥ 0 |
| 购买日期 | 日期选择器 | 是 | iOS 原生日期选择器，禁止选择未来日期 |
| 附加费用 | 动态列表 | 否 | 可新增多条，每条含金额（可为负）+ 备注，自动汇总总附加费用 |
| 使用次数 | 开关 + 数字框 | 否 | 开关开启后显示使用次数输入框，值须为整数且 ≥ 0 |
| 保修日期 | 日期选择器 | 否 | 可选填 |
| 目标日均成本 | 数字输入框 | 否 | 数字键盘，值须 ≥ 0 |
| 物品状态 | 单选组 | 是 | 服役中 / 已停用 / 已卖出 / 报废丢失，默认服役中 |
| 卖出残值 | 数字输入框 | 条件 | 仅"已卖出"状态时显示，值须 ≥ 0 |
| 备注 | 多行文本框 | 否 | placeholder"请输入型号、备注等信息" |

#### 2. 交互逻辑

- **取消按钮**：若表单有修改，弹出"确认放弃修改？"二次确认弹窗；无修改直接返回
- **图片选择**：调用 `expo-image-picker`，压缩至长边不超过 1080px，存储 `FileSystem.documentDirectory` 下的本地路径
- **附加费用**：点击添加按钮新增一行，点击删除按钮移除对应行，实时汇总总费用；总费用（购入价 + 附加费合计）不得为负
- **状态切换**：选中"已卖出"自动显示卖出残值输入框，其他状态隐藏
- **保存按钮**：校验全部必填项与边界规则，校验通过后将数据存入 SQLite，返回首页并触发列表刷新；SQLite 写入失败时保留表单并弹出 Toast 提示
- **编辑模式**：页面自动回显本地存储的资产数据，修改后覆盖原数据

---

### （四）页面 3：资产详情页

#### 1. 页面布局（从上至下）

- **顶部导航栏**：左侧返回按钮，右侧编辑按钮（跳转资产新增编辑页）
- **资产头部展示区**：物品大图（全屏宽度，高度 200dp，圆角 10dp）、物品名称（20dp 加粗）、状态标签（对应背景色圆角标签）
- **核心数据卡片**：通栏卡片，展示购入总价、附加总费用、持有天数、日均成本、使用次数、单次成本，每项上下排列；持有天数为 0 时日均成本显示 `—`，使用次数为 0 时单次成本显示 `—`
- **成本明细列表**：竖向列表，展示购入价、各笔附加费用、卖出残值、净成本明细
- **资产信息区**：展示购买日期、保修日期、目标日均成本、备注信息
- **底部操作栏**：三个按钮横向排列——修改状态、添加附加费、记录使用次数，圆角背景

#### 2. 交互逻辑

- **返回按钮**：点击返回上一页，触发列表刷新
- **编辑按钮**：跳转编辑页，全量数据回显
- **修改状态**：弹出状态选择弹窗，切换后自动更新数据并重新计算日均成本
- **添加附加费**：弹出输入弹窗（金额 + 备注），提交后更新总费用与日均成本，金额允许输入负值
- **记录使用次数**：弹出数字输入框，提交后更新使用次数与单次成本，值须为正整数
- **保修日期提醒**：距离保修日期 ≤ 7 天时，顶部显示红色警告文字"保修即将到期（X 天后）"

---

### （五）页面 4：数据统计页

#### 1. 页面布局（从上至下）

- **顶部导航栏**：标题"数据统计"，居中显示
- **时间筛选栏**：横向按钮组，全部 / 本周 / 本月 / 本年，选中背景色 `#2563eb` 白色文字，未选中灰色背景
- **图表区域**
  - 资产总额趋势图（折线图）：X 轴为时间，Y 轴为资产总额
  - 日均成本趋势图（折线图）：X 轴为时间，Y 轴为日均成本
  - 分类占比饼图：展示各分类资产金额占比
- **数据汇总区**：卡片展示总购入金额、总附加费用、总卖出残值、净总支出、物品总数
- **资产排序列表**
  - 顶部排序选择器：按日均成本、持有天数、购入价格、使用次数升降序排序
  - 列表展示对应排序后的资产简要信息

#### 2. 交互逻辑

- **时间筛选**：点击后切换时间范围，图表、汇总数据实时刷新
- **图表交互**：点击折线图节点显示对应数值气泡，点击饼图区块高亮显示占比
- **排序切换**：选择排序规则后，列表实时重新排序
- **列表项点击**：跳转对应资产详情页

---

### （六）页面 5：心愿清单页

#### 1. 页面布局

- **顶部导航栏**：标题"心愿清单"，右侧添加心愿按钮
- **心愿卡片列表**：样式同首页资产卡片，竖向排列；卡片内容：物品名称、预估价格、目标持有天数、预估日均成本、心仪程度标签（1–5 星）
- **空状态**：居中占位图 + 文字"添加心仪物品，提前核算成本"

#### 2. 交互逻辑

- **添加按钮**：弹出心愿录入表单，输入名称、预估价格、目标持有天数，自动计算预估日均成本（预估价格 ÷ 目标持有天数）
- **卡片左滑**：弹出编辑、删除、转为资产按钮
- **转为资产**：点击后带入名称、预估价格数据跳转资产新增编辑页，用户手动补全其他字段，完成保存后自动清除该心愿条目

---

### （七）页面 6：个人中心页

#### 1. 页面布局

- **头部区域**：默认头像、本地存储状态标识（"全部数据本地存储"）
- **功能菜单列表**：分类管理、保修提醒（开关）、数据备份、数据恢复、清空数据、使用帮助、关于我们、版本信息
- **底部区域**：当前 APP 版本号

#### 2. 交互逻辑

- **分类管理**：新增 / 编辑 / 删除分类，自定义分类图标，系统默认分类（`isDefault=1`）不可删除，删除自定义分类后该分类下的资产自动归入"其他"
- **保修提醒开关**：开启后，通过 `expo-notifications` 注册本地推送，保修到期前 7 天每天早上 9:00 推送一条提醒（格式："【保修提醒】xxx 保修将于 X 天后到期"）；关闭后取消所有已注册的保修推送
- **数据备份**：见下方"数据备份与恢复"规范
- **数据恢复**：见下方"数据备份与恢复"规范
- **清空数据**：弹出二次确认弹窗，确认后清空 asset、category（保留默认分类）、wish、addFeeItem 四张表，同时删除已缓存的本地图片文件

---

## 五、功能模块开发要求

### 1. 分层架构规范

```
src/
├── db/                   # 数据层：SQLite 工具类与 Repository
│   ├── database.ts       # 数据库初始化、版本迁移
│   ├── assetRepository.ts
│   ├── categoryRepository.ts
│   ├── wishRepository.ts
│   └── addFeeRepository.ts
├── hooks/                # 业务逻辑层：自定义 hooks
│   ├── useAssets.ts
│   ├── useCategories.ts
│   └── useWishes.ts
├── contexts/             # 全局状态：Context + useReducer
│   ├── AssetContext.tsx
│   └── SettingsContext.tsx
├── screens/              # UI 层：页面组件
├── components/           # 通用组件
└── utils/                # 工具函数（日期计算、金额格式化）
```

- **数据层**：封装 SQLite 工具类，实现增删改查全封装，页面不直接执行 SQL
- **业务逻辑层**：通过 custom hooks 封装业务逻辑，screens 只做 UI 渲染与事件绑定
- **UI 层**：screens 不包含直接的数据库调用，所有数据通过 hooks 或 Context 获取

### 2. 持有天数自动更新

- **主方案**：App 切换至前台时调用 `refreshAllAssets()`（见第二章说明）
- **辅助方案**：注册 `expo-background-fetch` 后台任务，每次执行时调用同一 `refreshAllAssets()`
- `refreshAllAssets()` 仅更新 `status = 0`（服役中）的资产，停用/报废/卖出资产的天数不再累计

### 3. 数据备份与恢复

#### 备份方案

- 导出格式：JSON 文件，文件名格式 `cost-backup-YYYYMMDD-HHmm.json`
- 导出内容：包含 asset、category、wish、addFeeItem 四张表的完整数据，以及导出时间戳和 App 版本号
- 存储位置：通过 `expo-sharing` 调起系统分享面板，用户可选择保存到"文件" App（iCloud Drive 或本机存储）、发送到 AirDrop 等
- **图片不在备份范围内**，备份文件中仅保留图片的原始本地路径（恢复后如路径失效，图片显示默认占位图）

```json
// 备份文件结构示例
{
  "version": "1.0.0",
  "exportedAt": "2026-05-04T11:30:00+08:00",
  "appVersion": "1.0.0",
  "data": {
    "assets": [...],
    "categories": [...],
    "wishes": [...],
    "addFeeItems": [...]
  }
}
```

#### 恢复方案

- 通过 `expo-document-picker` 让用户从"文件" App 选择 `.json` 备份文件
- 恢复前校验 JSON 结构与版本兼容性，不符合格式时提示"文件格式不正确，请选择有效的备份文件"
- **冲突处理策略**：弹出选择弹窗，用户选择"覆盖现有数据"或"取消恢复"
  - 覆盖：先清空四张表，再批量写入备份数据
  - 取消：不执行任何操作
- 恢复完成后刷新所有页面数据，并 Toast 提示"数据恢复成功，共导入 X 条资产"

### 4. 推送提醒

- 使用 `expo-notifications` 实现本地推送，无需网络，无需 APNs 远程推送证书
- 推送权限在首次开启"保修提醒"开关时通过 `Notifications.requestPermissionsAsync()` 申请
- 用户拒绝权限时，提示"请在系统设置 > 通知中开启权限，以接收保修提醒"，开关恢复关闭状态
- 保修推送触发时间：保修日期前 7 天（含）至保修日期当天，每天 09:00 本地时间推送
- 添加/修改保修日期时自动注册推送；删除资产或关闭推送开关时取消对应推送

### 5. 通用组件封装

封装以下通用组件，供各页面直接引用：

| 组件 | 说明 |
|------|------|
| `AppButton` | 主要按钮 / 次要按钮 / 危险按钮，支持 loading 状态 |
| `AppInput` | 带标签的输入框，支持错误提示 |
| `AppCard` | 通用卡片容器，带阴影和圆角 |
| `AppModal` | 通用弹窗，支持确认 / 取消 / 自定义内容 |
| `AppDatePicker` | iOS 日期选择器封装，支持最小 / 最大日期限制 |
| `AppToast` | 底部 Toast 提示，自动消失 |
| `EmptyState` | 空状态占位图 + 提示文字 |
| `ChartWrapper` | Victory Native XL 图表封装，支持数据实时更新 |

---

## 六、打包上架要求

### 1. 环境准备

- 安装 EAS CLI：`npm install -g eas-cli`
- 登录 Expo 账号：`eas login`
- 确认已加入 Apple Developer Program（个人或公司账号，年费 $99）

### 2. 项目配置（app.json / app.config.js）

```json
{
  "expo": {
    "name": "日均成本",
    "slug": "daily-cost-tracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "ios": {
      "bundleIdentifier": "com.yourname.dailycosttracker",
      "buildNumber": "1",
      "supportsTablet": false,
      "deploymentTarget": "14.0",
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "需要访问相册以添加物品图片",
        "NSCameraUsageDescription": "需要访问相机以拍摄物品图片",
        "NSUserNotificationsUsageDescription": "用于推送保修到期提醒"
      }
    },
    "plugins": [
      "expo-notifications",
      ["expo-image-picker", {
        "photosPermission": "需要访问相册以添加物品图片",
        "cameraPermission": "需要访问相机以拍摄物品图片"
      }]
    ]
  }
}
```

> **注意**：`bundleIdentifier` 需与 App Store Connect 中创建的 App 一致，且全球唯一，建议使用反向域名格式。

### 3. EAS Build 配置（eas.json）

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m1-medium"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "你的App Store Connect App ID"
      }
    }
  }
}
```

### 4. 打包构建

```bash
# 构建正式 iOS 包（.ipa）
eas build --platform ios --profile production

# 构建完成后，EAS 控制台提供下载链接，也可直接提交
eas submit --platform ios --profile production
```

> EAS Build 在云端构建，无需本地 Mac 或 Xcode 环境。构建完成后可直接通过 `eas submit` 提交到 App Store Connect。

### 5. App Store Connect 配置

在 [App Store Connect](https://appstoreconnect.apple.com) 完成以下配置后方可提交审核：

| 配置项 | 说明 |
|--------|------|
| App 名称 | 最多 30 字符，建议"日均成本 - 物品摊销记录" |
| 副标题 | 最多 30 字符，如"记录每天用了多少钱" |
| 分类 | 主分类：财务；副分类：效率 |
| 关键词 | 最多 100 字符，如"日均成本,物品摊销,资产管理,消费记录" |
| 描述 | 最多 4000 字符，说明 App 功能与价值 |
| 隐私政策 URL | 必填，即使是纯本地 App 也需提供（可部署一个静态页面） |
| 截图 | 每种设备尺寸至少 1 张，建议提供 iPhone 6.5"（1284×2778）和 5.5"（1242×2208）两种 |
| App 年龄分级 | 根据问卷填写，无暴力/成人内容，一般评为 4+ |

### 6. 权限声明与隐私合规

本 App 申请的权限及用途说明（需与 `infoPlist` 配置一致）：

| 权限 | 用途 | 是否必须 |
|------|------|----------|
| 相册访问（NSPhotoLibraryUsageDescription） | 为资产添加图片 | 否（可跳过） |
| 相机访问（NSCameraUsageDescription） | 拍摄资产图片 | 否（可跳过） |
| 本地通知（NSUserNotificationsUsageDescription） | 保修到期提醒 | 否（关闭开关可不申请） |

> 本 App **不申请**网络、定位、联系人、麦克风等权限。审核时如被质疑，说明 App 为纯本地离线应用即可。

### 7. 审核注意事项

- **隐私政策**：必须提供可访问的隐私政策 URL，内容需说明 App 不收集任何用户数据
- **测试账号**：纯本地 App 无需登录，审核备注中说明"无需账号，直接使用"
- **截图真实性**：截图需与实际 App 功能一致，不得包含误导性内容
- **首次构建建议**：先用 `preview` profile 生成内部测试包，通过 TestFlight 分发给测试用户验证功能，确认无误后再提交正式审核

---

## 七、异常处理与边界情况总结

> 本章汇总第二章边界情况规范，供开发自查使用。

### 数据输入边界

- 购买日期：禁止选择未来日期，日期选择器设置 `maximumDate={new Date()}`
- 持有天数为 0（当天购买）：日均成本显示 `—`，不参与统计图表计算
- 附加费用金额：允许负值（代表返现/补贴），但总费用（购入价 + 所有附加费合计）不得为负
- 卖出残值：允许大于购入价（溢价出售），净日均成本可为负，页面标注"（溢价）"
- 使用次数：仅允许非负整数，0 时单次成本显示 `—`

### 系统级异常

- SQLite 初始化失败：全屏错误页 + 重试按钮，记录错误日志
- SQLite 读写失败：Toast 提示"操作失败，请重试"，不关闭当前页面
- 图片权限被拒：Toast 提示引导用户前往系统设置开启权限
- 图片选择失败：保留默认占位图，不阻断表单提交
- 备份文件格式错误：提示"文件格式不正确"，不执行任何数据操作
- 推送权限被拒：提示引导用户去系统设置，保修提醒开关自动关闭

---

*文档版本：v1.1 | 最后更新：2026-05-04*
