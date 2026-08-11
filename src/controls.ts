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
  // SceneSpec 数据契约不记录设备高度，把 Y 轴平移锁定在地面，避免抬升后重建场景时高度丢失
  transform.minY = 0
  transform.maxY = 0
  // 平移模式下隐藏被锁定的绿色 Y 箭头（XY/YZ 平面手柄会随 showY=false 一并隐藏，保留 XZ 平面手柄）
  transform.showY = false
  // three >= 0.169 不再派发 'dragging-changed'，改用 mouseDown/mouseUp 在拖拽时禁用 OrbitControls
  transform.addEventListener('mouseDown', () => {
    orbit.enabled = false
  })
  transform.addEventListener('mouseUp', () => {
    orbit.enabled = true
  })
  // three >= 0.169 中 TransformControls 不再是 Object3D，需把 getHelper() 加入场景，否则 gizmo 不会被渲染
  scene.add(transform.getHelper())

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
      // SceneSpec 只支持绕竖直轴的朝向（rotY）：
      // 旋转模式只保留绿色 Y 环（showX/showZ 为 false 时 E 环也会随之隐藏），
      // 避免红/蓝环把设备翻倒，倾斜无法写入 rotY，重建后会被重置；
      // 平移模式恢复红/蓝箭头，继续隐藏被锁定的绿色 Y 箭头
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
  }
}
