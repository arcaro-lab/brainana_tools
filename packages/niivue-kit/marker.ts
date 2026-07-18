// Amber "yellow pin" marker — a small mesh added to the RENDER instance at a surface vertex.
// The node (vertex index) is chosen once against a reference surface (see MultiView.nearestNode)
// and reused across every displayed surface, so the pin tracks the same anatomical vertex on
// pial / white / inflated / sphere. The pin is a slim, vertically-elongated ellipsoid oriented
// along the surface normal and lifted outward so it rests ON the surface rather than half-buried.
import { Niivue, NVMesh } from '@niivue/niivue'

const MARKER_NAME = 'selected-location'
const MARKER_RGBA = new Uint8Array([255, 196, 0, 255]) // amber, matches v1.2.25
// A small pin, slightly elongated along the surface normal so it reads as a marker.
const R_RADIAL = 0.55 // half-width across the surface
const R_HEIGHT = 0.9 // half-length along the surface normal

function uvSphere(stacks: number, slices: number, scale = 1): { pts: Float32Array; tris: Uint32Array } {
  const rRadial = R_RADIAL * scale
  const rHeight = R_HEIGHT * scale
  const pts: number[] = []
  const tris: number[] = []
  for (let i = 0; i <= stacks; i++) {
    const phi = (Math.PI * i) / stacks
    for (let j = 0; j <= slices; j++) {
      const theta = (2 * Math.PI * j) / slices
      // Unit ellipsoid scaled thin on x/z and tall on y (the local elongation axis).
      pts.push(rRadial * Math.sin(phi) * Math.cos(theta), rHeight * Math.cos(phi), rRadial * Math.sin(phi) * Math.sin(theta))
    }
  }
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * (slices + 1) + j
      const b = a + slices + 1
      // Wound so the face normals point OUTWARD. NiiVue derives per-vertex normals straight from this
      // winding (NVMesh.generateNormals) and back-face-culls, so the reversed order (a, b, a+1) would
      // give inward normals — culling the camera-facing cap and inverting the shading, which renders
      // as a dark hole in the middle of the pin at larger sizes.
      tris.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  return { pts: new Float32Array(pts), tris: new Uint32Array(tris) }
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2])
  return len > 1e-6 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0]
}

// Rotate a point built along local +Y so its long axis aligns with unit normal n
// (Rodrigues rotation taking +Y → n; symmetric about the long axis so any twist is fine).
function alignYToNormal(p: [number, number, number], n: [number, number, number]): [number, number, number] {
  const c = n[1] // dot([0,1,0], n)
  if (c > 0.9999) return p
  if (c < -0.9999) return [p[0], -p[1], -p[2]] // 180° flip
  const vx = n[2] // cross([0,1,0], n) = [n.z, 0, -n.x]
  const vy = 0
  const vz = -n[0]
  const c1: [number, number, number] = [vy * p[2] - vz * p[1], vz * p[0] - vx * p[2], vx * p[1] - vy * p[0]]
  const c2: [number, number, number] = [vy * c1[2] - vz * c1[1], vz * c1[0] - vx * c1[2], vx * c1[1] - vy * c1[0]]
  const k = 1 / (1 + c)
  return [p[0] + c1[0] + k * c2[0], p[1] + c1[1] + k * c2[1], p[2] + c1[2] + k * c2[2]]
}

export class Marker {
  #nv: Niivue
  #scale = 1
  #base = uvSphere(10, 14, 1)
  #visible = true

  constructor(nv: Niivue) {
    this.#nv = nv
  }

  // Resize the pin (multiplier on its base dimensions). Rebuilds the base geometry; the caller
  // re-places the marker (via setWorld) to redraw at the new size.
  setSize(scale: number): void {
    this.#scale = Math.max(0.2, Math.min(5, scale))
    this.#base = uvSphere(10, 14, this.#scale)
  }

  // Distance the pin's CENTRE is pushed outward from the picked vertex along the surface normal
  // (see setWorld). Hit-testing must project this lifted centre — not the bare vertex — or the pin
  // reads as offset from wherever it can be grabbed.
  liftAmount(): number {
    return R_HEIGHT * this.#scale
  }

  #existing(): NVMesh | undefined {
    return (this.#nv.meshes as NVMesh[]).find((m) => m.name === MARKER_NAME)
  }

  clear(): void {
    const m = this.#existing()
    if (m) this.#nv.removeMesh(m)
  }

  // Hide/show without recomputing geometry.
  setVisible(visible: boolean): void {
    this.#visible = visible
    const m = this.#existing()
    if (m) {
      m.visible = visible
      this.#nv.drawScene()
    }
  }

  // Place the marker at a world coordinate, oriented along (and lifted out from) the surface
  // normal so it rests on top of the surface. `normal` should point outward from the surface.
  setWorld(xyz: [number, number, number] | null, normal: [number, number, number] | null = null): void {
    this.clear()
    if (!xyz) {
      this.#nv.drawScene()
      return
    }
    const n = normalize(normal ?? [0, 1, 0])
    // Lift the CENTRE out by the pin's (scaled) half-height so its base rests at the picked vertex
    // and the whole body sits ON the surface — otherwise, especially at larger sizes/zoom, most of
    // the ellipsoid is buried and only its emerging rim shows (the "crescent" bug).
    const lift = R_HEIGHT * this.#scale
    const cx = xyz[0] + n[0] * lift
    const cy = xyz[1] + n[1] * lift
    const cz = xyz[2] + n[2] * lift
    const src = this.#base.pts
    const pts = new Float32Array(src.length)
    for (let i = 0; i < src.length; i += 3) {
      const rp = alignYToNormal([src[i], src[i + 1], src[i + 2]], n)
      pts[i] = rp[0] + cx
      pts[i + 1] = rp[1] + cy
      pts[i + 2] = rp[2] + cz
    }
    const gl = (this.#nv as unknown as { gl: WebGL2RenderingContext }).gl
    const mesh = new NVMesh(pts, this.#base.tris, MARKER_NAME, MARKER_RGBA, 1, true, gl)
    mesh.visible = this.#visible
    this.#nv.addMesh(mesh)
    this.#nv.drawScene()
  }
}
