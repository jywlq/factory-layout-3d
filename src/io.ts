import type { SceneSpec } from './spec'

function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadSpec(spec: SceneSpec): void {
  downloadText('scene-spec.json', JSON.stringify(spec, null, 2), 'application/json')
}

export async function loadSpecFromFile(file: File): Promise<SceneSpec> {
  const text = await file.text()
  const data: unknown = JSON.parse(text)
  if (!isSceneSpec(data)) {
    throw new Error('SceneSpec 格式不正确')
  }
  return data
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSceneSpec(value: unknown): value is SceneSpec {
  if (!value || typeof value !== 'object') return false
  const obj = value as Partial<SceneSpec>
  if (!obj.floor || !isNumber(obj.floor.w) || !isNumber(obj.floor.d)) return false
  if (!Array.isArray(obj.walls) || !Array.isArray(obj.devices)) return false

  const wallsOk = obj.walls.every(
    (w) => isNumber(w.x) && isNumber(w.z) && isNumber(w.len) && isNumber(w.h) && isNumber(w.rotY),
  )
  const devicesOk = obj.devices.every(
    (d) => typeof d.id === 'string' && typeof d.type === 'string' && isNumber(d.x) && isNumber(d.z) && isNumber(d.rotY),
  )

  return wallsOk && devicesOk
}

export function exportPng(renderer: { domElement: HTMLCanvasElement }): void {
  const dataUrl = renderer.domElement.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'factory-layout.png'
  a.click()
}
