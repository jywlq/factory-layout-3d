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
  transform.addEventListener('dragging-changed', (event: { value: unknown }) => {
    orbit.enabled = !Boolean(event.value)
  })
  scene.add(transform as unknown as THREE.Object3D)

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
