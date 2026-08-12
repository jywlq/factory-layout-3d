# 个人开发者全流程开发文档

> 适用对象：本项目的个人开发者（及 AI 编码助手）。
> 本文档覆盖**环境搭建 → 本地开发 → 代码规范 → 测试验证 → 构建部署**的完整流程。
> 需求基线以 [`TASKBOOK.md`](./TASKBOOK.md) 为准，架构细节与 AI 协作约定见 [`AGENTS.md`](./AGENTS.md)，功能与使用说明见 [`README.md`](./README.md)。

---

## 目录

1. [项目概述](#1-项目概述)
2. [环境搭建](#2-环境搭建)
3. [项目结构](#3-项目结构)
4. [核心架构与数据契约](#4-核心架构与数据契约)
5. [开发流程](#5-开发流程)
6. [代码规范](#6-代码规范)
7. [测试策略](#7-测试策略)
8. [构建与部署](#8-构建与部署)
9. [常见问题排查（FAQ）](#9-常见问题排查faq)
10. [已知限制](#10-已知限制)

---

## 1. 项目概述

**三维工厂布局规划器**是一个无后端的最小 Web 3D Demo：导入/编辑/保存三维工厂布局场景，用于在客户面前快速演示"导入 CAD 平面图 → 自动生成三维厂房 → 现场微调 → 保存/截图带走"的链路。

- **技术栈**：Vite 8 + TypeScript + three.js 0.185，UI 为原生 HTML/CSS，界面文字全部中文。
- **当前进度**：地基阶段（手动布局 / 编辑 / 保存）已完成；**CAD(DXF)→三维场景自动生成**为本期主线，尚未实施（见 `TASKBOOK.md` 第 3 节）。
- **范围红线**：不引入 React/Vue/CSS 框架、WebGPU、后端/数据库、DWG/STEP/IGES 解析、真实 glTF 模型、仿真/AGV 调度/实时数据、登录/权限/国际化、测试框架。依赖白名单：`vite`、`typescript`、`three`（+ 实施 CAD→3D 时允许的 `dxf-parser`），除此之外**不新增任何依赖**。

## 2. 环境搭建

### 2.1 软件要求

| 软件 | 版本要求 | 说明 |
|---|---|---|
| Node.js | `^20.19.0` 或 `>=22.12.0`（推荐最新 LTS） | Vite 8 的官方要求，低版本启动会直接报错 |
| npm | 随 Node 自带即可（≥ 10） | 项目使用普通 npm 依赖，不使用 yarn/pnpm |
| Git | 任意现代版本 | 用于拉取代码与提交 PR |
| 浏览器 | 支持 WebGL 的现代浏览器（Chrome / Edge 最新版推荐） | three.js 渲染依赖 WebGL |

> 验证方式：`node --version` 输出应 ≥ 20.19；`npm --version` 可正常输出。

### 2.2 获取代码与安装依赖

```bash
# 克隆仓库
git clone https://github.com/jywlq/factory-layout-3d.git
cd factory-layout-3d

# 安装依赖（项目已含 package-lock.json，将按锁定版本安装）
npm i
```

### 2.3 启动与验证

```bash
# 启动开发服务器，默认 http://localhost:5173
npm run dev
```

浏览器打开后应看到内置示例小工厂（30 m × 20 m 地面、四圈外墙、7 台设备），可旋转/缩放浏览。确认控制台（F12）**无报错**即环境搭建完成。

### 2.4 编辑器建议（可选）

- 推荐 VS Code，开箱即用支持 TypeScript。
- 项目 `tsconfig.json` 启用了 `noUnusedLocals`、`noUnusedParameters` 等严格检查，编辑器会实时提示，无需额外插件。

## 3. 项目结构

```
factory-layout-3d/
├── index.html            # 页面入口，加载 src/main.ts
├── package.json          # 依赖与脚本（dev / build / preview）
├── tsconfig.json         # TypeScript 严格配置
├── README.md             # 项目说明、功能清单、SceneSpec 格式
├── TASKBOOK.md           # 项目任务书 v2（需求唯一基线）
├── AGENTS.md             # 架构说明与 AI 协作规范
├── DEVELOPMENT.md        # 本文档：个人开发者全流程开发文档
├── LICENSE               # MIT 许可证
└── src/
    ├── main.ts           # 应用入口：状态管理、交互事件绑定、动画循环
    ├── spec.ts           # SceneSpec 数据契约类型定义
    ├── defaultSpec.ts    # 内置示例小工厂数据
    ├── builder.ts        # buildScene 纯函数重建场景；DEVICE_PRESETS 设备外观表
    ├── controls.ts       # OrbitControls + TransformControls + PointerLockControls 封装（吸附/限位/相机切换/FPS移动）
    ├── dxf.ts            # ASCII DXF → SceneSpec 映射（dxf-parser）
    ├── io.ts             # JSON 导入导出、PNG 截图
    ├── ui.ts             # 原生 DOM 生成左侧设备面板与顶部工具栏
    └── style.css         # 原生样式
```

> CAD→3D 主线已实施：`src/dxf.ts` 实现 ASCII DXF → SceneSpec 映射，`public/fixtures/sample.dxf` 为内置样例，工具栏"导入CAD"/"加载示例CAD"为入口。

## 4. 核心架构与数据契约

### 4.1 SceneSpec：唯一的场景真相

场景状态只存在于一份 JSON 对象中（单位：米，Y-up），类型定义见 [`src/spec.ts`](./src/spec.ts)：

```ts
interface SceneSpec {
  floor: { w: number; d: number }                        // 地面尺寸
  walls: Array<{ x; z; len; h; rotY }>                   // 墙：中心点 + 长度 + 高度 + 绕 Y 轴角度
  devices: Array<{ id; type; x; z; rotY }>               // 设备：唯一 id + 类型 + 平面位置 + 朝向
}
```

**硬性原则**：一切交互（添加/拖拽/旋转/删除/导入）只修改内存中的 `spec`，然后调用 `buildScene(scene, spec)` 整体重建；**禁止绕过 spec 直接操作 Three.js 对象来"持久化"场景状态**。

### 4.2 纯函数重建：buildScene(scene, spec)

[`src/builder.ts`](./src/builder.ts) 中的 `buildScene` 每次调用会移除旧场景根节点（`factory-root`）并整体重建地面、网格、墙、设备，返回 `{ root, deviceObjects }`（`deviceObjects` 为 `deviceId → Object3D` 映射，供点选与 TransformControls 绑定）。

设备外观（尺寸、颜色、中文标签）由 `DEVICE_PRESETS` 表决定，当前四类：

| type | 中文名 | 尺寸 w×h×d (m) | 颜色 |
|---|---|---|---|
| `machine` | 机床 | 2 × 1.5 × 1.5 | 蓝 `#3b82f6` |
| `shelf` | 货架 | 2.4 × 2.2 × 0.8 | 橙 `#f59e0b` |
| `pallet` | 托盘区 | 2.5 × 0.3 × 2 | 绿 `#10b981` |
| `agv` | AGV | 1.2 × 0.4 × 0.8 | 红 `#ef4444` |

新增设备类型时必须同步更新该表。未收录的 `type` 会以灰色占位方块（1.5×1×1）渲染，标签直接显示 type 字符串。

### 4.3 编辑闭环与数据能力边界

`main.ts` 的交互模式：**修改 spec → `rebuildAndKeepSelection()` → 恢复选中态**。

契约不含高度字段，也不含绕水平轴的朝向，因此 UI 能力被刻意约束（"界面能力 ≤ 数据能力"）：

- [`src/controls.ts`](./src/controls.ts) 用 `transform.minY = 0 / maxY = 0` 把设备锁定在地面，并隐藏绿色 Y 箭头；
- 旋转模式只保留绿色 Y 环（红/蓝环和 E 环隐藏），防止设备被翻倒后姿态无法写回 `rotY`；
- 吸附步长：平移 0.5 m、旋转 15°，可开关。

> 修改 `controls.ts` 的模式切换逻辑时，不要破坏上述可见性/限位约束，否则重建或加载后设备位姿会被重置。

### 4.4 视图系统

- 透视相机：`PerspectiveCamera`，初始 `(24, 20, 24)` 看向原点；
- 顶视图相机：`OrthographicCamera`，位于 `(0, 40, 0)`，`up = (0, 0, -1)` 保证朝向与 CAD 平面图一致；
- 切换逻辑在 `main.ts` 的 `toggleView()`，会同时更新 `OrbitControls` 与 `TransformControls` 的相机引用，并按地面尺寸重算正交视锥；
- **WASD 自由视角**：基于 `PointerLockControls`，切换后指针锁定、鼠标转向、WASD 平移、Space 上升、Shift 下降；拖拽设备时自动暂停移动，Esc 退出回到轨道模式。

## 5. 开发流程

### 5.1 日常循环

```bash
npm run dev        # 开发：Vite HMR 热更新，改动即时生效
npm run build      # 自检：tsc 类型检查 + vite build，必须通过
npm run preview    # 预览生产构建产物
```

每完成一个小改动，至少执行一次 `npm run build` 并在浏览器里过一遍 [README 功能清单](./README.md)（项目没有测试框架，手工验证是硬性要求）。

### 5.2 分支策略

- `main`：保持随时可演示状态，不直接推送。
- 功能/文档分支：从 `main` 切出，命名 `feat/<主题>`、`fix/<主题>`、`docs/<主题>`，例如 `feat/dxf-import`、`docs/developer-guide`。
- 一个 PR 只做一件事；CAD→3D 这类大任务按可演示的纵切面拆小 PR。

### 5.3 提交规范（Conventional Commits，中文描述）

提交信息格式：`<type>: <简要描述>`，描述用中文，聚焦"为什么/做了什么"。

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 文档变更 |
| `refactor` | 不影响行为的重构 |
| `style` | 格式调整（不影响逻辑） |
| `chore` | 构建/依赖/杂项 |

示例：

```
feat: 导入 CAD(DXF) 自动生成地面/墙/设备
fix: 加载 JSON 后正交视锥未按新地面尺寸更新
docs: 补充 README 已知限制与 CAD 规范 v1
```

### 5.4 PR 提交规范

1. 推送分支后在 GitHub 创建 PR，**标题与描述均用中文**，标题沿用提交规范的 `<type>: <描述>` 格式。
2. 描述必须包含：**变更说明**（做了什么、为什么）、**自测情况**（对照验收清单逐条说明结果，包括未通过项）、**影响范围**（是否改动 SceneSpec 契约 / builder / controls 等关键模块）。
3. 涉及演示效果的变化，附截图或操作说明。
4. 合并前确保 `npm run build` 通过、控制台无报错。

### 5.5 拿不准的产品决策怎么办

遵循任务书工作原则：**有歧义选最简单实现；不做超出需求的重构；不加依赖；可读性 > 技巧性**。拿不准的产品决策写进任务书的"我的假设"（第 7 节），不默默自作主张。

## 6. 代码规范

### 6.1 TypeScript

- 严格遵循 `tsconfig.json`：未使用的局部变量/参数会直接编译失败（`noUnusedLocals` / `noUnusedParameters`），提交前先跑 `npm run build`。
- 类型导入使用 `import type`（`verbatimModuleSyntax` 已开启）。
- 不使用分号，字符串用单引号（与现有代码保持一致）。

### 6.2 模块与命名

- `src/` 按职责分模块，一个文件一个职责（见 [项目结构](#3-项目结构)）；新增模块命名沿用现有短名风格（如未来的 `dxf.ts`），不强求 catalog.ts/editor.ts 之类的命名。
- 导出函数用小驼峰（`buildScene`、`createEditorControls`）；类型用大驼峰（`SceneSpec`、`BuildResult`）；常量表用全大写下划线（`DEVICE_PRESETS`、`ROOT_NAME`）。
- Three.js 对象的业务标识放在 `userData`（如 `userData.deviceId`），场景根节点用固定名字 `factory-root` 识别。

### 6.3 注释与界面

- 代码注释使用**中文**，解释"为什么"（例如 `controls.ts` 中对 Y 轴限位原因的解释），不解释显而易见的"是什么"。
- UI 文字一律中文；UI 用原生 HTML/CSS，不引入任何 UI 框架。

### 6.4 改动红线（违反会破坏演示链路）

1. 不绕过 `SceneSpec` 持久化场景状态。
2. 不移除 `controls.ts` 的高度限位（`minY/maxY = 0`）与旋转手柄可见性约束。
3. 不在白名单之外新增依赖。
4. 不添加任务书禁止的能力（仿真、实时数据、登录权限等）。

## 7. 测试策略

项目**不引入测试框架**（任务书红线），采用"自动自证 + 手工清单"双轨：

### 7.1 自动自证（console.assert）

纯逻辑（尤其是未来的 DXF 解析）必须内置已知输入的自证：用 fixture 的已知坐标，在 dev 模式以 `console.assert` 对照手算值，断言失败在控制台立即可见。

### 7.2 手工功能清单

每次提交前按 [`README.md` 功能清单](./README.md) 逐条验证；里程碑节点按 [`TASKBOOK.md` 第 10 节验收清单](./TASKBOOK.md) 逐条跑并**如实报告**，包括：

- 四种设备添加、拖拽 0.5 m / 旋转 15° 吸附及开关；
- Esc 取消选中、Delete 删除；
- 保存 JSON → 刷新清空 → 加载恢复一致（含旋转角度）；
- 截图下载 PNG、顶视图切换且朝向与 CAD 一致；
- `npm run build` 通过、浏览器控制台无报错。

### 7.3 人机协同测试约定

- 浏览器被配置为下载需手动选取目录，**自动化触发的文件下载会失败**；下载/导出类验证由开发者手动执行。
- 使用 AI 助手时，未经明确要求不要自动操作浏览器；把测试步骤整理成清单手动执行，必要时截图/粘贴控制台输出留档。

### 7.4 演示验收

最终验收即演示：按 `TASKBOOK.md` 第 4 节演示脚本走一遍，任何环节卡顿/报错都视为未通过。

## 8. 构建与部署

### 8.1 生产构建

```bash
npm run build      # 先 tsc 类型检查，再 vite build，产物输出到 dist/
npm run preview    # 本地预览 dist/ 产物（http://localhost:4173）
```

`dist/` 为纯静态资源（本项目无后端），已在 `.gitignore` 中忽略，不入库。

### 8.2 静态托管部署

将 `dist/` 目录整体上传到任意静态托管即可：

- **GitHub Pages**：`vite.config` 中设置 `base` 为仓库名路径（如 `/factory-layout-3d/`）后构建，推送 `dist/` 到 `gh-pages` 分支或使用 Pages Actions。
- **Nginx**：将 `dist/` 拷贝到站点根目录即可，无需额外路由配置（单页应用只有一个入口）。
- **Vercel / Netlify**：构建命令 `npm run build`，输出目录 `dist`。

> 注意：若部署在子路径下，必须配置 Vite 的 `base` 选项，否则资源 404。

### 8.3 发布前检查

1. `npm run build` 通过，无 TS 错误；
2. `npm run preview` 打开，对照功能清单过一遍；
3. 控制台无报错；
4. README 与功能现状一致（新增能力同步更新文档）。

## 9. 常见问题排查（FAQ）

| 现象 | 原因与解决 |
|---|---|
| `npm run dev` 报 Node 版本错误 | Vite 8 要求 Node `^20.19.0 || >=22.12.0`，升级 Node |
| 端口 5173 被占用 | Vite 会自动顺延端口，看终端输出的实际地址；或关闭占用进程 |
| TransformControls 手柄不显示 | three ≥ 0.169 中 TransformControls 不是 Object3D，必须 `scene.add(transform.getHelper())`（见 `controls.ts`） |
| 拖拽设备时视角跟着转 | 拖拽期间需禁用 OrbitControls；three ≥ 0.169 不再派发 `dragging-changed`，用 `mouseDown/mouseUp` 事件切换（见 `controls.ts`） |
| 设备被"抬高"后保存再加载变回地面 | 契约无高度字段，这是设计约束而非缺陷；不要移除 Y 轴限位 |
| 旋转后设备"翻倒"再加载变直立 | 契约只支持 `rotY`；旋转模式只应保留绿色 Y 环 |
| 导出的 JSON 加载报"格式不正确" | `io.ts` 的 `isSceneSpec` 会校验字段类型，检查 JSON 是否缺字段或数值非法 |
| 子路径部署资源 404 | 配置 Vite `base` 选项后重新构建 |

## 10. 已知限制

对客演示时应主动声明（与 `TASKBOOK.md` 第 8 节一致）：

1. 设备只支持平面布局：落地 + 绕竖直轴转向，高度与倾斜不在本期范围；
2. 设备为彩色占位方块 + 中文标签，非真实设备模型；
3. 无后端，场景以 JSON 文件形式在浏览器本地保存/加载；
4. CAD 规范 v1 由本项目定义，demo 只对自带样例负责，不承诺解析客户任意 DXF/DWG。
