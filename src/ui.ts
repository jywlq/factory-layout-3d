import type { DeviceType } from './spec'

export interface UIRefs {
  viewport: HTMLDivElement
  addButtons: Record<DeviceType, HTMLButtonElement>
  moveButton: HTMLButtonElement
  rotateButton: HTMLButtonElement
  snapButton: HTMLButtonElement
  viewButton: HTMLButtonElement
  saveButton: HTMLButtonElement
  loadButton: HTMLButtonElement
  screenshotButton: HTMLButtonElement
  fileInput: HTMLInputElement
  selectionText: HTMLSpanElement
  dxfButton: HTMLButtonElement
  dxfSampleButton: HTMLButtonElement
  dxfFileInput: HTMLInputElement
  dxfStatusText: HTMLSpanElement
  fpsButton: HTMLButtonElement
  fullscreenButton: HTMLButtonElement
  exitFullscreenButton: HTMLButtonElement
}

export function createUI(root: HTMLElement): UIRefs {
  root.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <h2>设备面板</h2>
        <button data-device="machine">+ 添加机床</button>
        <button data-device="shelf">+ 添加货架</button>
        <button data-device="pallet">+ 添加托盘</button>
        <button data-device="agv">+ 添加 AGV</button>
      </aside>
      <main class="main-area">
        <div class="toolbar">
          <button id="btn-fps">自由视角</button>
          <button id="btn-move">移动模式</button>
          <button id="btn-rotate">旋转模式</button>
          <button id="btn-snap">吸附：开</button>
          <button id="btn-view">切换顶视图</button>
          <button id="btn-save">保存场景</button>
          <button id="btn-load">加载场景</button>
          <button id="btn-shot">导出截图</button>
          <button id="btn-dxf">导入CAD</button>
          <button id="btn-dxf-sample">加载示例CAD</button>
          <button id="btn-fullscreen">全屏</button>
          <span id="selection-text">未选中设备</span>
          <span id="dxf-status"></span>
          <input id="file-input" type="file" accept="application/json" hidden>
          <input id="dxf-input" type="file" accept=".dxf" hidden>
        </div>
        <div id="viewport"></div>
        <button id="btn-exit-fullscreen" style="display:none">退出全屏</button>
      </main>
    </div>
  `

  const getEl = <T extends HTMLElement>(selector: string): T => {
    const el = root.querySelector<T>(selector)
    if (!el) throw new Error(`找不到元素: ${selector}`)
    return el
  }

  return {
    viewport: getEl<HTMLDivElement>('#viewport'),
    addButtons: {
      machine: getEl<HTMLButtonElement>('button[data-device="machine"]'),
      shelf: getEl<HTMLButtonElement>('button[data-device="shelf"]'),
      pallet: getEl<HTMLButtonElement>('button[data-device="pallet"]'),
      agv: getEl<HTMLButtonElement>('button[data-device="agv"]'),
    },
    moveButton: getEl<HTMLButtonElement>('#btn-move'),
    rotateButton: getEl<HTMLButtonElement>('#btn-rotate'),
    snapButton: getEl<HTMLButtonElement>('#btn-snap'),
    viewButton: getEl<HTMLButtonElement>('#btn-view'),
    saveButton: getEl<HTMLButtonElement>('#btn-save'),
    loadButton: getEl<HTMLButtonElement>('#btn-load'),
    screenshotButton: getEl<HTMLButtonElement>('#btn-shot'),
    fileInput: getEl<HTMLInputElement>('#file-input'),
    selectionText: getEl<HTMLSpanElement>('#selection-text'),
    dxfButton: getEl<HTMLButtonElement>('#btn-dxf'),
    dxfSampleButton: getEl<HTMLButtonElement>('#btn-dxf-sample'),
    dxfFileInput: getEl<HTMLInputElement>('#dxf-input'),
    dxfStatusText: getEl<HTMLSpanElement>('#dxf-status'),
    fpsButton: getEl<HTMLButtonElement>('#btn-fps'),
    fullscreenButton: getEl<HTMLButtonElement>('#btn-fullscreen'),
    exitFullscreenButton: getEl<HTMLButtonElement>('#btn-exit-fullscreen'),
  }
}
