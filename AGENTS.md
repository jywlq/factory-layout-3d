# AGENTS.md

This file provides guidance to Lingma (lingma.aliyun.com) when working with code in this repository.

## 项目简介

三维工厂布局规划器（最小 Web Demo）。基于 Vite + TypeScript + three.js 的无后端单页面应用，界面文字为中文。

- 需求基线见 **`TASKBOOK.md`（任务书 v2）**：本期核心交付是 **CAD(DXF)→三维场景自动生成**，目标是给客户快速展示厂房与设备面貌。
- 入口页面：`index.html` 加载 `src/main.ts`。
- 当前进度：**M1 地基、M2 CAD→3D、M3 打磨交付均已完成**；M4+ 工业级演进仅规划（见 `ROADMAP.md`）。下一阶段是按验收清单做演示演练与必要收尾，勿再按“DXF 未实现”推进。

## 文档体系

| 文档 | 职责 |
|---|---|
| `README.md` | 对外说明：项目介绍、运行步骤、功能清单、SceneSpec 格式、CAD 规范 v1、已知限制 |
| `TASKBOOK.md` | 需求唯一基线（任务书 v2），范围、验收清单与"我的假设"的事实来源 |
| `DEVELOPMENT.md` | 个人开发者全流程指引：环境搭建、开发流程、代码规范、测试策略、构建部署 |
| `AGENTS.md` | 本文件：架构要点与 AI 协作约定 |
| `ROADMAP.md` | M4+ 工业级演进路线（本期任务书范围外，仅规划） |

同一事实只允许有一个来源：需求以 `TASKBOOK.md` 为准，设备外观以 `builder.ts` 的 `DEVICE_PRESETS` 为准；文档与代码不一致时修正文档。

## 常用命令

```bash
# 安装依赖
npm i

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

> 环境要求：Node.js `^20.19.0 || >=22.12.0`（Vite 8 官方要求）。
>
> 注意：项目没有配置测试框架。自检时请手动按 README 中的功能清单逐条验证。
>
> 分支、提交与 PR 规范见 `DEVELOPMENT.md` 第 5 节（Conventional Commits，中文描述；PR 标题与描述均用中文）。

## 技术栈与约束

- **构建工具**：Vite 8
- **语言**：TypeScript（tsconfig 启用 `noUnusedLocals`、`noUnusedParameters`）
- **3D 渲染**：three.js 0.185 + `OrbitControls` / `TransformControls`
- **UI**：原生 HTML/CSS，无框架
- **包管理**：普通 npm 依赖；当前白名单为 `three` + `dxf-parser`（dev：`vite` / `typescript` / `@types/three`），**不得新增其他依赖**

按任务书要求，以下内容**禁止引入**：React/Vue/CSS 框架、WebGPU、后端/数据库、DWG/STEP/IGES 解析、真实 glTF 模型、仿真/AGV 调度/实时数据、登录/权限/国际化、测试框架。

## 核心架构

### 1. 场景数据契约 `SceneSpec`

场景真相来自一份 JSON 对象（单位：米，Y-up），类型定义在 `src/spec.ts`：

```ts
interface SceneSpec {
  floor: { w: number; d: number }
  walls: Array<{ x; z; len; h; rotY }>
  devices: Array<{ id; type; x; z; rotY }>
}
```

- `src/defaultSpec.ts` 内置示例小工厂：30 m × 20 m 地面、四圈外墙、4 台机床、2 组货架、1 处托盘区。
- 不要绕过 `SceneSpec` 直接操作 Three.js 对象来“持久化”场景状态；所有保存/加载都基于该契约。

### 2. 纯函数式重建：`buildScene(scene, spec)`

`src/builder.ts` 暴露：

```ts
export function buildScene(scene: THREE.Scene, spec: SceneSpec): BuildResult
```

- 每次调用会移除旧场景根节点并按 `spec` 整体重建地面、网格、墙、设备。
- 返回 `{ root, deviceObjects }`，其中 `deviceObjects` 是 `deviceId -> Object3D` 的映射，用于 `main.ts` 中点选和 TransformControls 绑定。
- 设备外观（尺寸、颜色、中文标签）由 `builder.ts` 中的 `DEVICE_PRESETS` 表决定。新增设备类型时同步更新该表。

### 3. 编辑闭环：只改 `spec`，然后重建

`src/main.ts` 负责交互逻辑，其模式为：

1. 用户操作（添加/拖拽/旋转/删除/导入 JSON）修改内存中的 `spec` 对象。
2. 调用 `rebuildAndKeepSelection()` → `buildScene(scene, spec)`。
3. 如有选中项，重新 `setSelection(selectedId)` 以恢复 TransformControls 绑定。

拖拽/旋转时使用 `controls.setMode('translate' | 'rotate')` 和 `setSnap(enabled)`。吸附步长在 `controls.ts` 中设置为：**平移 0.5 m、旋转 15°**。

> 注意：SceneSpec 的设备契约不含高度字段，`controls.ts` 中用 `transform.minY = 0 / maxY = 0` 把 Y 轴平移锁定在地面，并隐藏绿色 Y 箭头。不要移除该限位，否则设备可被抬离地面，重建场景后高度丢失（表现为“高度被重置为 0”）。
>
> 同理，契约只支持绕竖直轴的朝向 `rotY`：`controls.ts` 的 `setMode` 里通过 `showX/showY/showZ` 切换手柄可见性——旋转模式只保留绿色 Y 环（红/蓝环和 E 环隐藏，否则设备可被翻倒，倾斜无法写入 rotY，重建/加载后会被重置为直立）；平移模式隐藏绿色 Y 箭头。修改模式切换逻辑时不要破坏这套可见性约束。

### 4. 视图系统

- 透视相机：`THREE.PerspectiveCamera`，初始位置 `(24, 20, 24)`，看向原点。
- 顶视图相机：`THREE.OrthographicCamera`，位置 `(0, 40, 0)`，使用 `up = (0, 0, -1)` 保证与 CAD 视角方向一致。
- 切换逻辑在 `main.ts` 的 `toggleView()`，会同时更新 `OrbitControls` 和 `TransformControls` 的相机引用。
- **WASD 自由视角**：`controls.ts` 内的自定义 Unity 式 FPS 模式（**不是** `PointerLockControls`）。开启后禁用 OrbitControls；左键拖动改朝向（yaw/pitch），WASD/Space/Shift 移动，滚轮沿视线前后移动；拖拽设备时暂停移动，Esc 或工具栏按钮退出回轨道模式。仅作用于透视相机。应用启动时默认开启自由视角。

### 5. 输入输出

`src/io.ts` 提供：

- `downloadSpec(spec)`：将当前 `SceneSpec` 作为 `scene-spec.json` 下载。
- `loadSpecFromFile(file)`：读取 JSON 并做基础格式校验后返回 `SceneSpec`。
- `exportPng(renderer)`：基于当前渲染画布导出 `factory-layout.png`。

## 文件职责速览

- `src/spec.ts`：`SceneSpec` 类型定义。
- `src/defaultSpec.ts`：默认示例工厂数据。
- `src/builder.ts`：`buildScene` 纯函数；设备外观预设；中文标签生成。
- `src/controls.ts`：封装 `OrbitControls` + `TransformControls` + 自定义 WASD 自由视角，含拖拽时禁用轨道、吸附步长、相机切换。
- `src/dxf.ts`：ASCII DXF → `SceneSpec` 映射；`loadDxfFromFile` / `loadDxfFromUrl`。
- `src/io.ts`：JSON 导入导出、PNG 截图。
- `src/ui.ts`：生成左侧设备面板与顶部工具栏 DOM，返回 UI 引用。
- `src/main.ts`：应用入口、状态管理、交互事件绑定、动画循环。
- `src/style.css`：原生样式。
- `public/fixtures/sample.dxf`：内置 CAD 样例（一键加载）。

## 人机协同测试约定（重要）

- 用户浏览器配置为下载后需手动选取目录，**agent 发起的任何文件下载都会失败**；涉及下载/导出的验证一律交给用户手动完成。
- **未经用户明确要求，不要主动自动化操作浏览器**。需要浏览器验证时，把测试步骤整理成清单交给用户手动执行。
- 主动向用户发起协助请求：请用户复现、截图、粘贴控制台输出、提供下载的文件内容等。

## CAD→3D 已实现（TASKBOOK 第 6 节）

- **已落地**：依赖 `dxf-parser`；`src/dxf.ts` 做 ASCII DXF → `SceneSpec` 映射；工具栏「导入CAD」「加载示例CAD」+ `#dxf-status` 状态栏；内置样例 `public/fixtures/sample.dxf`。
- 映射规则：FLOOR 层闭合 LWPOLYLINE 包围盒作地面并居中；WALL 层 LINE/LWPOLYLINE 逐段成墙；INSERT 块名不区分大小写匹配设备目录（machine/shelf/pallet/agv）；缺 FLOOR 回退为 WALL 包围盒外扩 1 m；DXF(x,y)→three(x,z)；墙高默认 3 m。
- 解析结果在 dev 模式用 `console.assert` 做基础自证（floor 尺寸、墙数）。
- 导入后生成的 spec 必须能继续走现有编辑闭环（移动/旋转/添加/删除/保存）。
- 修改解析逻辑时保持与 `public/fixtures/sample.dxf` 及 README「CAD 规范 v1」一致。
