# 三维工厂布局规划器（最小 Demo）

基于 **Vite + TypeScript + three** 的无后端 Web 3D 最小示例：将工厂布局建模为一份 JSON 场景契约（`SceneSpec`），在浏览器中三维浏览、拖拽编辑、保存/加载与截图，目标是快速给客户展示未来厂房和设备的面貌。

## 项目状态

| 阶段                      | 内容                                                         | 状态     |
| :------------------------ | :----------------------------------------------------------- | :------- |
| 地基（原 M1）             | 3D 浏览 / 设备添加、拖拽、旋转 / 网格吸附 / 顶视图 / 场景保存加载 / 截图导出 | ✅ 已完成 |
| CAD→3D（原 M2，本期主线） | 上传符合规范的 DXF → 自动生成地面/墙/设备占位，生成后仍可编辑保存；仓库内置样例 | ✅ 已完成 |
| 打磨交付（原 M3）         | WASD 自由视角 / 全中文 UI 收尾 / 配色与名称标签 / README 收尾 / 演示脚本演练 | ✅ 已完成 |
| 工业级演进（M4+）         | 真实 CAD 兼容 / 真实设备模型库 / 布局工程校验 / AI 布局助手（见 ROADMAP） | 📋 规划中 |

需求基线见 `TASKBOOK.md`；开发者全流程指引见 `DEVELOPMENT.md`；架构与 AI 协作约定见 `AGENTS.md`；从 Demo 到工业级工具的演进路线见 `ROADMAP.md`。

## 环境要求

- **Node.js**：`^20.19.0` 或 `>=22.12.0`（Vite 8 官方要求，推荐最新 LTS）
- **npm**：随 Node 自带即可
- **浏览器**：支持 WebGL 的现代浏览器（Chrome / Edge 最新版推荐）

## 启动方式

```
npm i
npm run dev        # 开发服务器，默认 http://localhost:5173
```

构建：

```
npm run build      # tsc 类型检查 + vite build，产物输出到 dist/
npm run preview    # 本地预览生产构建
```

## 功能清单

- 30m × 20m 示例工厂（地面、外墙、设备）
- 左侧设备面板：机床 / 货架 / 托盘 / AGV 一键添加
- 点击选中设备，支持 TransformControls：移动 / 旋转
- 吸附开关：平移 0.5m，旋转 15°
- Delete 删除选中设备，Esc 取消选中
- 透视视角 / 顶视图切换（顶视图为正交相机）
- 导入 CAD（DXF）/ 一键加载内置样例，自动生成地面、墙与设备占位
- WASD 自由视角模式：键盘移动 + 左键拖动转向
- 场景 JSON 导出与导入
- 当前视角 PNG 截图导出

操作方式：工具栏「退出自由视角」可切回轨道模式（鼠标拖动旋转、右键平移、滚轮缩放）；再次点「自由视角」进入 WASD 模式（WASD 移动、Space 上升、Shift 下降、左键拖动转向、滚轮沿视线前后移动，Esc 退出）。应用启动时默认处于自由视角。点击设备选中后，用工具栏「移动模式 / 旋转模式」拖动手柄编辑。

## 设备外观（DEVICE_PRESETS）

| type      | 中文名 | 尺寸 w×h×d (m)  | 颜色         |
| :-------- | :----- | :-------------- | :----------- |
| `machine` | 机床   | 2 × 1.5 × 1.5   | 蓝 `#3b82f6` |
| `shelf`   | 货架   | 2.4 × 2.2 × 0.8 | 橙 `#f59e0b` |
| `pallet`  | 托盘区 | 2.5 × 0.3 × 2   | 绿 `#10b981` |
| `agv`     | AGV    | 1.2 × 0.4 × 0.8 | 红 `#ef4444` |

## SceneSpec 数据格式（单位：米，Y-up）

```
{
  "floor": { "w": 30, "d": 20 },
  "walls": [
    { "x": 0, "z": -10, "len": 30, "h": 3, "rotY": 0 }
  ],
  "devices": [
    { "id": "machine-1", "type": "machine", "x": -8, "z": -4, "rotY": 0 }
  ]
}
```

一切交互（添加/拖拽/旋转/删除/导入）只修改这份 JSON，再由 `buildScene(scene, spec)` 整体重建场景；数据契约不能持久化的操作，UI 一律不提供（高度锁定贴地、旋转仅限绕竖直轴）。

## CAD 规范 v1（输入规范）

> 解析器实现见 `src/dxf.ts`；内置样例见 `public/fixtures/sample.dxf`。demo 只对本规范与自带样例负责。

- ASCII DXF，单位米。
- **FLOOR 层**：闭合 LWPOLYLINE = 地面轮廓，取其包围盒作为 floor 的 w/d（居中对齐）。
- **WALL 层**：LINE / LWPOLYLINE 的每个直线段 = 一段墙中心线（len=段长，rotY=段方向；弧段允许折线近似）。
- **设备**：INSERT 块，块名 ∈ 设备目录（不区分大小写）；插入点 = 设备中心；块旋转角 = 设备朝向。
- 缺 FLOOR 时回退：WALL 包围盒外扩 1 m。
- 坐标映射：DXF(x,y) → three(x,z)，保证顶视图的右/上 = CAD 的右/上，角度方向一致。
- 墙高：CAD 规范 v1 未定义，默认 3 m。

## 代码结构（src）

- `spec.ts`：`SceneSpec` 类型定义
- `defaultSpec.ts`：内置小工厂示例
- `builder.ts`：`buildScene(scene, spec)` 场景重建；`DEVICE_PRESETS` 设备外观表
- `controls.ts`：OrbitControls / TransformControls / 自定义 WASD 自由视角（吸附、限位、相机切换）
- `dxf.ts`：ASCII DXF → `SceneSpec`；`loadDxfFromFile` / `loadDxfFromUrl`
- `io.ts`：JSON 导入导出、PNG 截图
- `ui.ts`：原生 HTML/CSS 工具栏
- `main.ts`：应用入口与交互逻辑
- `public/fixtures/sample.dxf`：内置 CAD 样例

## 已知限制

1. 设备只支持平面布局：落地 + 绕竖直轴转向，高度与倾斜不在本期范围；
2. 设备为彩色占位方块 + 中文标签，非真实设备模型；
3. 无后端，场景以 JSON 文件形式在浏览器本地保存/加载；
4. CAD 规范 v1 由本项目定义，demo 只对自带样例负责，不承诺解析客户任意 DXF/DWG。

## 许可证

[MIT](./LICENSE)
