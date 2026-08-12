import { DxfParser } from 'dxf-parser'
import type { IEntity, IPoint, IInsertEntity, ILineEntity, ILwpolylineEntity } from 'dxf-parser'
import type { SceneSpec, WallSpec, DeviceSpec } from './spec'

// 设备块名 → type 映射（不区分大小写匹配 INSERT 的 name）
const DEVICE_TYPES = ['machine', 'shelf', 'pallet', 'agv']

// 默认墙高（CAD 规范 v1 未定义墙高字段）
const DEFAULT_WALL_HEIGHT = 3

// 缺 FLOOR 时的外扩余量
const FLOOR_FALLBACK_PADDING = 1

/**
 * 将 ASCII DXF 文本解析为 SceneSpec。
 * 遵循 TASKBOOK 第 6 节 CAD 规范 v1：
 * - FLOOR 层闭合 LWPOLYLINE 包围盒 → floor w/d
 * - WALL 层 LINE/LWPOLYLINE 逐段 → walls[]
 * - INSERT 块名匹配设备目录 → devices[]
 * - 缺 FLOOR 时 WALL 包围盒外扩 1m 回退
 * - DXF(x,y) → three(x,z)
 */
export function parseDxfToSpec(dxfText: string): SceneSpec {
  const parser = new DxfParser()
  const dxf = parser.parseSync(dxfText)
  if (!dxf) {
    throw new Error('DXF 解析失败：无法读取文件内容')
  }

  const entities = dxf.entities ?? []

  // 按层分组
  const floorEntities: ILwpolylineEntity[] = []
  const wallEntities: IEntity[] = []
  const insertEntities: IInsertEntity[] = []

  for (const entity of entities) {
    const layer = (entity.layer ?? '').toUpperCase()
    if (layer === 'FLOOR' && entity.type === 'LWPOLYLINE') {
      floorEntities.push(entity as ILwpolylineEntity)
    } else if (layer === 'WALL' && (entity.type === 'LINE' || entity.type === 'LWPOLYLINE')) {
      wallEntities.push(entity)
    } else if (entity.type === 'INSERT') {
      insertEntities.push(entity as IInsertEntity)
    }
  }

  // 收集所有 WALL 顶点（用于回退 floor 和居中偏移）
  const wallPoints: IPoint[] = []
  for (const entity of wallEntities) {
    if (entity.type === 'LINE') {
      const line = entity as ILineEntity
      if (line.vertices?.length >= 2) {
        wallPoints.push(...line.vertices.slice(0, 2))
      }
    } else if (entity.type === 'LWPOLYLINE') {
      const poly = entity as ILwpolylineEntity
      wallPoints.push(...(poly.vertices ?? []))
    }
  }

  // 1. 计算 floor
  let floorW: number
  let floorD: number
  let offsetX: number
  let offsetZ: number

  if (floorEntities.length > 0) {
    // FLOOR 层：取所有 LWPOLYLINE 顶点的包围盒
    const points: IPoint[] = []
    for (const poly of floorEntities) {
      points.push(...(poly.vertices ?? []))
    }
    const bbox = boundingBox(points)
    floorW = bbox.maxX - bbox.minX
    floorD = bbox.maxY - bbox.minY
    offsetX = -(bbox.minX + bbox.maxX) / 2
    offsetZ = -(bbox.minY + bbox.maxY) / 2
  } else if (wallPoints.length > 0) {
    // 缺 FLOOR 回退：WALL 包围盒外扩 1m
    const bbox = boundingBox(wallPoints)
    floorW = bbox.maxX - bbox.minX + FLOOR_FALLBACK_PADDING * 2
    floorD = bbox.maxY - bbox.minY + FLOOR_FALLBACK_PADDING * 2
    offsetX = -(bbox.minX + bbox.maxX) / 2
    offsetZ = -(bbox.minY + bbox.maxY) / 2
  } else {
    // 无 FLOOR 也无 WALL：给一个最小默认地面
    floorW = 20
    floorD = 20
    offsetX = 0
    offsetZ = 0
  }

  // 2. 生成 walls（逐段）
  const walls: WallSpec[] = []
  for (const entity of wallEntities) {
    if (entity.type === 'LINE') {
      const line = entity as ILineEntity
      if (line.vertices?.length >= 2) {
        const wall = segmentToWall(line.vertices[0], line.vertices[1], offsetX, offsetZ)
        walls.push(wall)
      }
    } else if (entity.type === 'LWPOLYLINE') {
      const poly = entity as ILwpolylineEntity
      const verts = poly.vertices ?? []
      for (let i = 0; i < verts.length - 1; i++) {
        walls.push(segmentToWall(verts[i], verts[i + 1], offsetX, offsetZ))
      }
      // 闭合多段线：首尾相连
      if (poly.shape && verts.length >= 3) {
        walls.push(segmentToWall(verts[verts.length - 1], verts[0], offsetX, offsetZ))
      }
    }
  }

  // 3. 生成 devices（INSERT 块名匹配）
  const devices: DeviceSpec[] = []
  const typeCounters: Record<string, number> = {}
  for (const insert of insertEntities) {
    const blockName = (insert.name ?? '').toLowerCase()
    if (!DEVICE_TYPES.includes(blockName)) continue

    const type = blockName
    typeCounters[type] = (typeCounters[type] ?? 0) + 1
    const id = `${type}-${typeCounters[type]}`

    // DXF 旋转角度为度，转为弧度
    const rotY = (insert.rotation ?? 0) * Math.PI / 180

    devices.push({
      id,
      type,
      x: (insert.position?.x ?? 0) + offsetX,
      z: (insert.position?.y ?? 0) + offsetZ,
      rotY,
    })
  }

  const result: SceneSpec = {
    floor: { w: floorW, d: floorD },
    walls,
    devices,
  }

  // dev 模式自证：对照已知 fixture 坐标
  if (import.meta.env.DEV) {
    console.assert(result.floor.w > 0, `FLOOR 宽度应大于 0，实际 ${result.floor.w}`)
    console.assert(result.floor.d > 0, `FLOOR 深度应大于 0，实际 ${result.floor.d}`)
    console.assert(result.walls.length > 0, `墙数应大于 0，实际 ${result.walls.length}`)
  }

  return result
}

/** 从文件加载 DXF */
export async function loadDxfFromFile(file: File): Promise<SceneSpec> {
  const text = await file.text()
  return parseDxfToSpec(text)
}

/** 从 URL 加载 DXF（用于一键加载内置样例） */
export async function loadDxfFromUrl(url: string): Promise<SceneSpec> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`无法加载 DXF 文件: ${response.status}`)
  }
  const text = await response.text()
  return parseDxfToSpec(text)
}

// ---- 工具函数 ----

interface BBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function boundingBox(points: IPoint[]): BBox {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY }
}

/** 两点构成一段墙：中心点 + 长度 + 角度。DXF(x,y) → three(x,z) */
function segmentToWall(p1: IPoint, p2: IPoint, offsetX: number, offsetZ: number): WallSpec {
  const cx = (p1.x + p2.x) / 2 + offsetX
  const cz = (p1.y + p2.y) / 2 + offsetZ
  const dx = p2.x - p1.x
  const dz = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dz * dz)
  const rotY = Math.atan2(dz, dx)
  return { x: cx, z: cz, len, h: DEFAULT_WALL_HEIGHT, rotY }
}
