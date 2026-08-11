export type DeviceType = 'machine' | 'shelf' | 'pallet' | 'agv'

export interface FloorSpec {
  w: number
  d: number
}

export interface WallSpec {
  x: number
  z: number
  len: number
  h: number
  rotY: number
}

export interface DeviceSpec {
  id: string
  type: DeviceType | string
  x: number
  z: number
  rotY: number
}

export interface SceneSpec {
  floor: FloorSpec
  walls: WallSpec[]
  devices: DeviceSpec[]
}

export { defaultSpec } from './defaultSpec'
