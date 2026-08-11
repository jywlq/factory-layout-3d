import type { SceneSpec } from './spec'

// 示例小工厂：30m x 20m，外墙 + 设备
export const defaultSpec: SceneSpec = {
  floor: { w: 30, d: 20 },
  walls: [
    { x: 0, z: -10, len: 30, h: 3, rotY: 0 },
    { x: 0, z: 10, len: 30, h: 3, rotY: 0 },
    { x: -15, z: 0, len: 20, h: 3, rotY: Math.PI / 2 },
    { x: 15, z: 0, len: 20, h: 3, rotY: Math.PI / 2 },
  ],
  devices: [
    { id: 'machine-1', type: 'machine', x: -8, z: -4, rotY: 0 },
    { id: 'machine-2', type: 'machine', x: -3, z: -4, rotY: 0 },
    { id: 'machine-3', type: 'machine', x: 2, z: -4, rotY: 0 },
    { id: 'machine-4', type: 'machine', x: 7, z: -4, rotY: 0 },
    { id: 'shelf-1', type: 'shelf', x: -10, z: 4, rotY: 0 },
    { id: 'shelf-2', type: 'shelf', x: 10, z: 4, rotY: 0 },
    { id: 'pallet-1', type: 'pallet', x: 0, z: 6, rotY: 0 },
  ],
}
