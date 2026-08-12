import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

export interface EditorControls {
  orbit: OrbitControls
  transform: TransformControls
  attach: (object: THREE.Object3D) => void
  detach: () => void
  setMode: (mode: 'translate' | 'rotate') => void
  setSnap: (enabled: boolean) => void
  setCamera: (camera: THREE.Camera) => void
  enableFPS: () => void
  disableFPS: () => void
  isFPSActive: () => boolean
  updateFPS: (delta: number) => void
  setFPSKeys: (keys: Partial<FPSKeys>) => void
}

interface FPSKeys {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

// WASD 移动速度（m/s）
const FPS_SPEED = 5
// 最低飞行高度（不穿地面）
const FPS_MIN_Y = 1
// 鼠标转向灵敏度
const MOUSE_SENSITIVITY = 0.002
// 滚轮缩放速度（每像素 deltaY 平移的距离，单位 m）
const WHEEL_ZOOM_SPEED = 0.05

/**
 * 修正 TransformControls gizmo 的两个视觉问题：
 * 1. 平移模式：默认正方向有"线+箭头"，负方向只有箭头锥无连接线 → 补上负方向连接线
 * 2. 旋转模式：Y 轴环默认为半圆且会跟随相机转向 → 替换为完整圆环（全圆对 Y 轴旋转对称，相机跟随不可见）
 */
function enhanceGizmo(helper: THREE.Object3D): void {
  let gizmoObj: any = null
  helper.traverse((child: any) => {
    if (child.isTransformControlsGizmo) gizmoObj = child
  })
  if (!gizmoObj) return

  // 1. 旋转 Y 环：半圆 → 全圆
  const rotateGizmo = gizmoObj.gizmo?.['rotate']
  if (rotateGizmo) {
    for (const mesh of rotateGizmo.children) {
      if (mesh.name === 'Y' && mesh.geometry) {
        const fullTorus = new THREE.TorusGeometry(0.5, 0.0075, 3, 64, Math.PI * 2)
        fullTorus.rotateY(Math.PI / 2)
        fullTorus.rotateX(Math.PI / 2)
        fullTorus.rotateZ(-Math.PI / 2)
        mesh.geometry.dispose()
        mesh.geometry = fullTorus
      }
    }
  }

  // 2. 平移 X/Z 轴：补上负方向连接线
  const translateGizmo = gizmoObj.gizmo?.['translate']
  const materialLib = gizmoObj.materialLib
  if (translateGizmo && materialLib) {
    const makeLine = (mat: THREE.Material, rx: number, ry: number, rz: number, name: string): THREE.Mesh => {
      const geo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.5, 3)
      geo.translate(0, 0.25, 0)
      const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
      geo.applyMatrix4(matrix)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.name = name
      mesh.renderOrder = Infinity
      return mesh
    }
    translateGizmo.add(makeLine(materialLib.xAxis.clone(), 0, 0, Math.PI / 2, 'X'))
    translateGizmo.add(makeLine(materialLib.zAxis.clone(), -Math.PI / 2, 0, 0, 'Z'))
  }
}

export function createEditorControls(
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): EditorControls {
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true
  orbit.target.set(0, 0, 0)

  const transform = new TransformControls(camera, renderer.domElement)
  transform.setMode('translate')
  transform.minY = 0
  transform.maxY = 0
  transform.showY = false

  // Unity 式自由视角状态
  let fpsActive = false
  let yaw = 0
  let pitch = 0
  let isDragging = false
  let transformDragging = false
  const fpsKeys: FPSKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  }

  // 自由视角鼠标转向：左键拖动改变相机朝向
  const dom = renderer.domElement
  const onPointerDown = (e: PointerEvent) => {
    if (!fpsActive || e.button !== 0) return
    isDragging = true
    dom.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!fpsActive || !isDragging || transformDragging) return
    yaw -= e.movementX * MOUSE_SENSITIVITY
    pitch -= e.movementY * MOUSE_SENSITIVITY
    // 限制俯仰角，防止翻转
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!fpsActive) return
    isDragging = false
    dom.releasePointerCapture(e.pointerId)
  }

  // FPS 模式滚轮缩放：沿相机前方向量平移相机
  const onWheel = (e: WheelEvent) => {
    if (!fpsActive || transformDragging) return
    e.preventDefault()
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    camera.position.addScaledVector(forward, -e.deltaY * WHEEL_ZOOM_SPEED)
    if (camera.position.y < FPS_MIN_Y) camera.position.y = FPS_MIN_Y
  }

  // TransformControls 拖拽时禁用 OrbitControls 和自由视角移动
  transform.addEventListener('mouseDown', () => {
    orbit.enabled = false
    transformDragging = true
  })
  transform.addEventListener('mouseUp', () => {
    orbit.enabled = !fpsActive
    transformDragging = false
  })

  const helper = transform.getHelper()
  scene.add(helper)
  enhanceGizmo(helper)

  return {
    orbit,
    transform,
    attach(object) {
      transform.attach(object)
    },
    detach() {
      transform.detach()
    },
    setMode(mode) {
      transform.setMode(mode)
      const rotateOnly = mode === 'rotate'
      transform.showX = !rotateOnly
      transform.showZ = !rotateOnly
      transform.showY = rotateOnly
    },
    setSnap(enabled) {
      transform.translationSnap = enabled ? 0.5 : null
      transform.rotationSnap = enabled ? THREE.MathUtils.degToRad(15) : null
    },
    setCamera(nextCamera) {
      orbit.object = nextCamera
      transform.camera = nextCamera
      orbit.update()
    },
    enableFPS() {
      fpsActive = true
      orbit.enabled = false
      // 从当前相机朝向读取初始 yaw/pitch
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      yaw = euler.y
      pitch = euler.x
      dom.addEventListener('pointerdown', onPointerDown)
      dom.addEventListener('pointermove', onPointerMove)
      dom.addEventListener('pointerup', onPointerUp)
      dom.addEventListener('wheel', onWheel, { passive: false })
    },
    disableFPS() {
      fpsActive = false
      isDragging = false
      orbit.enabled = true
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
    },
    isFPSActive() {
      return fpsActive
    },
    updateFPS(delta) {
      if (!fpsActive || transformDragging) return
      const distance = FPS_SPEED * delta
      const cam = camera as THREE.PerspectiveCamera
      // 沿相机朝向移动（含 Y 分量，飞向看的方向）
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
      if (fpsKeys.forward) cam.position.addScaledVector(forward, distance)
      if (fpsKeys.backward) cam.position.addScaledVector(forward, -distance)
      if (fpsKeys.right) cam.position.addScaledVector(right, distance)
      if (fpsKeys.left) cam.position.addScaledVector(right, -distance)
      if (fpsKeys.up) cam.position.y += distance
      if (fpsKeys.down) cam.position.y -= distance
      // 不穿地面
      if (cam.position.y < FPS_MIN_Y) cam.position.y = FPS_MIN_Y
    },
    setFPSKeys(keys) {
      Object.assign(fpsKeys, keys)
    },
  }
}
