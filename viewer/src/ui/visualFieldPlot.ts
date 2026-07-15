// Draws the retinotopy visual-field plot from sampled points + stats (viewer/src/data/visualField.ts).
// Concentric rings at 2/4/6/8/10° with degree labels, bold Upper/Lower/Left/Right cardinals, a
// covariance ellipse, neighbor dots, the median (diamond), a yellow line + dashed link from the
// center voxel to the median, and the selected voxel (gold). Ported from the previous build's look.
import { RINGS, ECC_MAX, type VfPoint, type VfStats } from '../data/visualField.ts'

export function drawVisualField(canvas: HTMLCanvasElement, points: VfPoint[], stats: VfStats): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const size = Math.min(canvas.clientWidth || 300, canvas.clientHeight || 300)
  canvas.width = size * dpr
  canvas.height = size * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)

  // Label-aware layout: keep the anatomical side labels fully inside the canvas; a slight leftward
  // center bias gives the longer "Right" label equal breathing room.
  ctx.font = '600 13px system-ui, sans-serif'
  const leftW = ctx.measureText('Left').width
  const rightW = ctx.measureText('Right').width
  const sideGap = 7
  const edgePad = 4
  const cx = size / 2 - Math.max(0, (rightW - leftW) / 4)
  const cy = size / 2
  const hRadius = Math.min(cx - leftW - sideGap - edgePad, size - cx - rightW - sideGap - edgePad)
  const radius = Math.max(20, Math.min(size * 0.44, hRadius))
  const pxPerDeg = radius / ECC_MAX
  const toPx = (x: number, y: number): [number, number] => [cx + x * pxPerDeg, cy - y * pxPerDeg]

  // eccentricity rings
  ctx.strokeStyle = 'rgba(190,182,166,0.34)'
  ctx.lineWidth = 1.5
  for (const r of RINGS) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * pxPerDeg, 0, 2 * Math.PI)
    ctx.stroke()
  }

  // horizontal + vertical meridian axes
  ctx.strokeStyle = 'rgba(212,204,188,0.62)'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(cx - radius, cy)
  ctx.lineTo(cx + radius, cy)
  ctx.moveTo(cx, cy - radius)
  ctx.lineTo(cx, cy + radius)
  ctx.stroke()

  // cardinal labels
  ctx.fillStyle = 'rgba(240,234,220,0.98)'
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.fillText('Upper', cx, cy - radius - 7)
  ctx.fillText('Lower', cx, cy + radius + 16)
  ctx.textAlign = 'right'
  ctx.fillText('Left', cx - radius - 8, cy + 4)
  ctx.textAlign = 'left'
  ctx.fillText('Right', cx + radius + 8, cy + 4)

  // degree labels along the upper vertical meridian
  ctx.fillStyle = 'rgba(230,224,210,0.92)'
  ctx.font = '600 10px system-ui, sans-serif'
  ctx.textAlign = 'left'
  for (const r of RINGS) ctx.fillText(`${r}°`, cx + 4, cy - r * pxPerDeg + 3)

  // small center tick cross
  ctx.strokeStyle = 'rgba(236,230,216,0.9)'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy)
  ctx.lineTo(cx + 4, cy)
  ctx.moveTo(cx, cy - 4)
  ctx.lineTo(cx, cy + 4)
  ctx.stroke()

  // covariance ellipse (fill + outline)
  if (stats.ellipse) {
    const [ex, ey] = toPx(stats.ellipse.cx, stats.ellipse.cy)
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(-stats.ellipse.angle)
    ctx.beginPath()
    ctx.ellipse(0, 0, Math.max(1, stats.ellipse.rx * pxPerDeg), Math.max(1, stats.ellipse.ry * pxPerDeg), 0, 0, 2 * Math.PI)
    ctx.fillStyle = 'rgba(230,161,58,0.16)'
    ctx.strokeStyle = 'rgba(244,200,119,0.85)'
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  const center = points.find((p) => p.center)

  // yellow line center→selected voxel, dashed link voxel→median
  if (center) {
    const [px, py] = toPx(center.x, center.y)
    ctx.strokeStyle = 'rgba(255,205,72,0.92)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(px, py)
    ctx.stroke()
    if (points.length) {
      const [mx, my] = toPx(stats.medianX, stats.medianY)
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(236,230,216,0.6)'
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(mx, my)
      ctx.stroke()
      ctx.restore()
    }
  }

  // neighbor sample dots
  ctx.fillStyle = 'rgba(230,161,58,0.80)'
  for (const p of points) {
    if (p.center) continue
    const [px, py] = toPx(p.x, p.y)
    ctx.beginPath()
    ctx.arc(px, py, 3.4, 0, 2 * Math.PI)
    ctx.fill()
  }

  // median (rotated-square outline)
  if (points.length) {
    const [mx, my] = toPx(stats.medianX, stats.medianY)
    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = 'rgba(240,234,220,0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(-4.25, -4.25, 8.5, 8.5)
    ctx.restore()
  }

  // selected voxel (gold with dark outline)
  if (center) {
    const [px, py] = toPx(center.x, center.y)
    ctx.beginPath()
    ctx.arc(px, py, 5.5, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffd04a'
    ctx.strokeStyle = '#1a1610'
    ctx.lineWidth = 2.5
    ctx.fill()
    ctx.stroke()
  }
}
