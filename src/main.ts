import './style.css'
import * as THREE from 'three'
import { buildScene, getDevicePresetLabel } from './builder'
import { createEditorControls } from './controls'
import { downloadSpec, exportPng, loadSpecFromFile } from './io'
import { loadDxfFromFile, loadDxfFromUrl } from './dxf'
import { defaultSpec } from './defaultSpec'
import type { DeviceSpec, DeviceType, SceneSpec } from './spec'
import { createUI } from './ui'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('找不到 #app')

const ui = createUI(app)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xe2e8f0)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
ui.viewport.appendChild(renderer.domElement)

const perspectiveCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 200)
perspectiveCamera.position.set(24, 20, 24)

const orthoCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 200)
orthoCamera.position.set(0, 40, 0)
orthoCamera.up.set(0, 0, -1)
orthoCamera.lookAt(0, 0, 0)

let activeCamera: THREE.Camera = perspectiveCamera

const ambientLight = new THREE.AmbientLight(0xffffff, 0.65)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
directionalLight.position.set(20, 30, 10)
directionalLight.castShadow = true
scene.add(directionalLight)

const controls = createEditorControls(activeCamera, renderer, scene)
controls.setSnap(true)

let spec: SceneSpec = JSON.parse(JSON.stringify(defaultSpec)) as SceneSpec
let buildResult = buildScene(scene, spec)
let selectedId: string | null = null
let snapEnabled = true
let topViewEnabled = false
let mode: 'translate' | 'rotate' = 'translate'

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function setSelection(deviceId: string | null): void {
  selectedId = deviceId
  if (!deviceId) {
    controls.detach()
    ui.selectionText.textContent = '未选中设备'
    return
  }

  const object = buildResult.deviceObjects.get(deviceId)
  if (!object) {
    selectedId = null
    controls.detach()
    ui.selectionText.textContent = '未选中设备'
    return
  }

  controls.attach(object)
  const device = spec.devices.find((d) => d.id === deviceId)
  const name = device ? getDevicePresetLabel(device.type) : deviceId
  ui.selectionText.textContent = `已选中：${name} (${deviceId})`
}

function updateOrthoFrustum(): void {
  const size = Math.max(spec.floor.w, spec.floor.d) / 2 + 6
  const { clientWidth, clientHeight } = ui.viewport
  const aspect = Math.max(clientWidth / Math.max(clientHeight, 1), 0.1)
  orthoCamera.left = -size * aspect
  orthoCamera.right = size * aspect
  orthoCamera.top = size
  orthoCamera.bottom = -size
  orthoCamera.updateProjectionMatrix()
}

function resizeRenderer(): void {
  const { clientWidth, clientHeight } = ui.viewport
  renderer.setSize(clientWidth, clientHeight)
  perspectiveCamera.aspect = clientWidth / Math.max(clientHeight, 1)
  perspectiveCamera.updateProjectionMatrix()
  updateOrthoFrustum()
}

function rebuildAndKeepSelection(): void {
  buildResult = buildScene(scene, spec)
  setSelection(selectedId)
  updateOrthoFrustum()
}

function updateDeviceFromTransform(deviceId: string): void {
  const object = buildResult.deviceObjects.get(deviceId)
  const device = spec.devices.find((d) => d.id === deviceId)
  if (!object || !device) return
  device.x = object.position.x
  device.z = object.position.z
  device.rotY = object.rotation.y
}

function makeDeviceId(type: DeviceType): string {
  let next = spec.devices.filter((d) => d.type === type).length + 1
  while (spec.devices.some((d) => d.id === `${type}-${next}`)) {
    next += 1
  }
  return `${type}-${next}`
}

function addDevice(type: DeviceType): void {
  const device: DeviceSpec = {
    id: makeDeviceId(type),
    type,
    x: 0,
    z: 0,
    rotY: 0,
  }
  spec.devices.push(device)
  rebuildAndKeepSelection()
  setSelection(device.id)
}

function toggleView(): void {
  topViewEnabled = !topViewEnabled
  activeCamera = topViewEnabled ? orthoCamera : perspectiveCamera
  controls.setCamera(activeCamera)
  ui.viewButton.textContent = topViewEnabled ? '切换透视视角' : '切换顶视图'
}

ui.moveButton.addEventListener('click', () => {
  mode = 'translate'
  controls.setMode(mode)
})

ui.rotateButton.addEventListener('click', () => {
  mode = 'rotate'
  controls.setMode(mode)
})

ui.snapButton.addEventListener('click', () => {
  snapEnabled = !snapEnabled
  controls.setSnap(snapEnabled)
  ui.snapButton.textContent = `吸附：${snapEnabled ? '开' : '关'}`
})

ui.viewButton.addEventListener('click', toggleView)
ui.saveButton.addEventListener('click', () => downloadSpec(spec))
ui.loadButton.addEventListener('click', () => ui.fileInput.click())
ui.screenshotButton.addEventListener('click', () => exportPng(renderer))

ui.fileInput.addEventListener('change', async () => {
  const file = ui.fileInput.files?.[0]
  if (!file) return
  try {
    spec = await loadSpecFromFile(file)
    setSelection(null)
    rebuildAndKeepSelection()
  } catch (error) {
    const message = error instanceof Error ? error.message : '加载失败'
    window.alert(message)
  } finally {
    ui.fileInput.value = ''
  }
})

ui.dxfButton.addEventListener('click', () => ui.dxfFileInput.click())

ui.dxfFileInput.addEventListener('change', async () => {
  const file = ui.dxfFileInput.files?.[0]
  if (!file) return
  try {
    ui.dxfStatusText.textContent = '正在解析 DXF...'
    spec = await loadDxfFromFile(file)
    setSelection(null)
    rebuildAndKeepSelection()
    ui.dxfStatusText.textContent = `解析完成：${spec.walls.length} 段墙 / ${spec.devices.length} 台设备`
  } catch (error) {
    ui.dxfStatusText.textContent = '解析失败'
    window.alert(error instanceof Error ? error.message : 'DXF 解析失败')
  } finally {
    ui.dxfFileInput.value = ''
  }
})

ui.dxfSampleButton.addEventListener('click', async () => {
  try {
    ui.dxfStatusText.textContent = '正在加载示例 DXF...'
    spec = await loadDxfFromUrl('/fixtures/sample.dxf')
    setSelection(null)
    rebuildAndKeepSelection()
    ui.dxfStatusText.textContent = `示例加载完成：${spec.walls.length} 段墙 / ${spec.devices.length} 台设备`
  } catch (error) {
    ui.dxfStatusText.textContent = '加载失败'
    window.alert(error instanceof Error ? error.message : '加载示例失败')
  }
})

for (const [type, button] of Object.entries(ui.addButtons) as [DeviceType, HTMLButtonElement][]) {
  button.addEventListener('click', () => addDevice(type))
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (controls.transform.dragging) return

  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, activeCamera)

  const intersections = raycaster.intersectObjects([...buildResult.deviceObjects.values()], true)
  const picked = intersections[0]
  if (!picked) {
    setSelection(null)
    return
  }

  const deviceRoot = picked.object.parent?.userData?.deviceId
    ? picked.object.parent
    : picked.object.parent?.parent
  const deviceId = deviceRoot?.userData?.deviceId as string | undefined
  setSelection(deviceId ?? null)
})

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    setSelection(null)
    return
  }

  if (event.key === 'Delete' && selectedId) {
    spec.devices = spec.devices.filter((d) => d.id !== selectedId)
    setSelection(null)
    rebuildAndKeepSelection()
  }
})

controls.transform.addEventListener('objectChange', () => {
  if (!selectedId) return
  updateDeviceFromTransform(selectedId)
})

window.addEventListener('resize', resizeRenderer)
resizeRenderer()

function animate(): void {
  requestAnimationFrame(animate)
  controls.orbit.update()
  renderer.render(scene, activeCamera)
}

animate()
