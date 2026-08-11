import * as THREE from 'three'
import type { DeviceSpec, DeviceType, SceneSpec } from './spec'

const ROOT_NAME = 'factory-root'

const DEVICE_PRESETS: Record<string, { size: [number, number, number]; color: number; label: string }> = {
  machine: { size: [2, 1.5, 1.5], color: 0x3b82f6, label: '机床' },
  shelf: { size: [2.4, 2.2, 0.8], color: 0xf59e0b, label: '货架' },
  pallet: { size: [2.5, 0.3, 2], color: 0x10b981, label: '托盘区' },
  agv: { size: [1.2, 0.4, 0.8], color: 0xef4444, label: 'AGV' },
}

export interface BuildResult {
  root: THREE.Group
  deviceObjects: Map<string, THREE.Object3D>
}

function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#111827'
    ctx.font = '24px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.4, 0.6, 1)
  return sprite
}

function createDevice(device: DeviceSpec): THREE.Group {
  const preset = DEVICE_PRESETS[device.type] ?? {
    size: [1.5, 1, 1] as [number, number, number],
    color: 0x9ca3af,
    label: device.type,
  }

  const group = new THREE.Group()
  group.name = `device:${device.id}`
  group.userData = { deviceId: device.id, deviceType: device.type }

  const [w, h, d] = preset.size
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: preset.color }),
  )
  mesh.position.y = h / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  const label = createLabelSprite(`${preset.label} (${device.id})`)
  label.position.set(0, h + 0.5, 0)
  group.add(label)

  group.position.set(device.x, 0, device.z)
  group.rotation.y = device.rotY

  return group
}

export function buildScene(scene: THREE.Scene, spec: SceneSpec): BuildResult {
  const oldRoot = scene.getObjectByName(ROOT_NAME)
  if (oldRoot) {
    scene.remove(oldRoot)
  }

  const root = new THREE.Group()
  root.name = ROOT_NAME

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.floor.w, spec.floor.d),
    new THREE.MeshStandardMaterial({ color: 0xf3f4f6, side: THREE.DoubleSide }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const grid = new THREE.GridHelper(spec.floor.w, Math.round(spec.floor.w), 0x94a3b8, 0xcbd5e1)
  grid.position.y = 0.001
  root.add(grid)

  for (const wall of spec.walls) {
    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(wall.len, wall.h ?? 3, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db }),
    )
    wallMesh.position.set(wall.x, (wall.h ?? 3) / 2, wall.z)
    wallMesh.rotation.y = wall.rotY
    wallMesh.castShadow = true
    wallMesh.receiveShadow = true
    root.add(wallMesh)
  }

  const deviceObjects = new Map<string, THREE.Object3D>()
  for (const device of spec.devices) {
    const obj = createDevice(device)
    root.add(obj)
    deviceObjects.set(device.id, obj)
  }

  scene.add(root)
  return { root, deviceObjects }
}

export function getDevicePresetLabel(type: DeviceType | string): string {
  return DEVICE_PRESETS[type]?.label ?? type
}
