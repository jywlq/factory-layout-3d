# 三维工厂布局规划器（最小 Demo）

这是一个基于 **Vite + TypeScript + three** 的无后端 Web 3D 最小示例。

## 启动方式

```bash
npm i
npm run dev
```

构建：

```bash
npm run build
```

## 功能清单

- 30m × 20m 示例工厂（地面、外墙、设备）
- 左侧设备面板：机床 / 货架 / 托盘 / AGV 一键添加
- 点击选中设备，支持 TransformControls：移动 / 旋转
- 吸附开关：平移 0.5m，旋转 15°
- Delete 删除选中设备，Esc 取消选中
- 透视视角 / 顶视图切换（顶视图为正交相机）
- 场景 JSON 导出与导入
- 当前视角 PNG 截图导出

## SceneSpec 数据格式（单位：米，Y-up）

```json
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

## 代码结构（src）

- `spec.ts`：类型定义、默认数据导出
- `defaultSpec.ts`：内置小工厂示例
- `builder.ts`：`buildScene(scene, spec)` 场景重建
- `controls.ts`：OrbitControls / TransformControls 封装
- `io.ts`：JSON 导入导出、PNG 截图
- `ui.ts`：原生 HTML/CSS 工具栏
- `main.ts`：应用入口与交互逻辑
