export type Vec3 = [number, number, number]
export type Mat4 = number[][]

const centroid = (pts: Vec3[]): Vec3 => {
  const c: Vec3 = [0, 0, 0]
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2] }
  return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length]
}

function normalize4(q: number[]): number[] {
  const n = Math.hypot(...q) || 1
  return q.map(v => v / n)
}

function largestEigenvectorSymmetric4(a: number[][]): number[] {
  let q = normalize4([1, 0.3, -0.2, 0.1])
  for (let it = 0; it < 100; it++) {
    const next = normalize4(a.map(row => row.reduce((s, v, j) => s + v * q[j], 0)))
    const d = Math.min(
      Math.hypot(...next.map((v, i) => v - q[i])),
      Math.hypot(...next.map((v, i) => v + q[i]))
    )
    q = next
    if (d < 1e-12) break
  }
  return q
}

function quaternionToRotation(qIn: number[]): number[][] {
  const [w, x, y, z] = normalize4(qIn)
  return [
    [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
    [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
    [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)]
  ]
}

export function applyMat4(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0][0]*p[0] + m[0][1]*p[1] + m[0][2]*p[2] + m[0][3],
    m[1][0]*p[0] + m[1][1]*p[1] + m[1][2]*p[2] + m[1][3],
    m[2][0]*p[0] + m[2][1]*p[1] + m[2][2]*p[2] + m[2][3]
  ]
}

export function invertRigid(m: Mat4): Mat4 {
  const r = m.slice(0,3).map(row => row.slice(0,3))
  const rt = [[r[0][0],r[1][0],r[2][0]],[r[0][1],r[1][1],r[2][1]],[r[0][2],r[1][2],r[2][2]]]
  const t: Vec3 = [m[0][3],m[1][3],m[2][3]]
  const ti: Vec3 = [-(rt[0][0]*t[0]+rt[0][1]*t[1]+rt[0][2]*t[2]),-(rt[1][0]*t[0]+rt[1][1]*t[1]+rt[1][2]*t[2]),-(rt[2][0]*t[0]+rt[2][1]*t[1]+rt[2][2]*t[2])]
  return [[...rt[0],ti[0]],[...rt[1],ti[1]],[...rt[2],ti[2]],[0,0,0,1]]
}

export function fitRigid(source: Vec3[], target: Vec3[]) {
  if (source.length !== target.length || source.length < 3) throw new Error('At least three complete landmark pairs are required')
  const cs = centroid(source), ct = centroid(target)
  let sxx=0,sxy=0,sxz=0,syx=0,syy=0,syz=0,szx=0,szy=0,szz=0
  for (let i=0;i<source.length;i++) {
    const x=[source[i][0]-cs[0],source[i][1]-cs[1],source[i][2]-cs[2]]
    const y=[target[i][0]-ct[0],target[i][1]-ct[1],target[i][2]-ct[2]]
    sxx+=x[0]*y[0]; sxy+=x[0]*y[1]; sxz+=x[0]*y[2]
    syx+=x[1]*y[0]; syy+=x[1]*y[1]; syz+=x[1]*y[2]
    szx+=x[2]*y[0]; szy+=x[2]*y[1]; szz+=x[2]*y[2]
  }
  const trace=sxx+syy+szz
  const n=[
    [trace, syz-szy, szx-sxz, sxy-syx],
    [syz-szy, sxx-syy-szz, sxy+syx, szx+sxz],
    [szx-sxz, sxy+syx, -sxx+syy-szz, syz+szy],
    [sxy-syx, szx+sxz, syz+szy, -sxx-syy+szz]
  ]
  const r=quaternionToRotation(largestEigenvectorSymmetric4(n))
  const rc: Vec3=[r[0][0]*cs[0]+r[0][1]*cs[1]+r[0][2]*cs[2],r[1][0]*cs[0]+r[1][1]*cs[1]+r[1][2]*cs[2],r[2][0]*cs[0]+r[2][1]*cs[1]+r[2][2]*cs[2]]
  const t: Vec3=[ct[0]-rc[0],ct[1]-rc[1],ct[2]-rc[2]]
  const matrix: Mat4=[[...r[0],t[0]],[...r[1],t[1]],[...r[2],t[2]],[0,0,0,1]]
  const residuals=source.map((p,i)=>{const q=applyMat4(matrix,p);return Math.hypot(q[0]-target[i][0],q[1]-target[i][1],q[2]-target[i][2])})
  const rms=Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/residuals.length)
  return {matrix,inverse:invertRigid(matrix),residuals,rms}
}


export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  return Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) =>
    a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c] + a[r][3] * b[3][c]
  ))
}

export function rigidDelta(params: [number, number, number, number, number, number], center: Vec3): Mat4 {
  const [tx, ty, tz, rxDeg, ryDeg, rzDeg] = params
  const rx = rxDeg * Math.PI / 180
  const ry = ryDeg * Math.PI / 180
  const rz = rzDeg * Math.PI / 180
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  const Rx: Mat4 = [[1,0,0,0],[0,cx,-sx,0],[0,sx,cx,0],[0,0,0,1]]
  const Ry: Mat4 = [[cy,0,sy,0],[0,1,0,0],[-sy,0,cy,0],[0,0,0,1]]
  const Rz: Mat4 = [[cz,-sz,0,0],[sz,cz,0,0],[0,0,1,0],[0,0,0,1]]
  const Tneg: Mat4 = [[1,0,0,-center[0]],[0,1,0,-center[1]],[0,0,1,-center[2]],[0,0,0,1]]
  const Tpos: Mat4 = [[1,0,0,center[0] + tx],[0,1,0,center[1] + ty],[0,0,1,center[2] + tz],[0,0,0,1]]
  return multiplyMat4(Tpos, multiplyMat4(Rz, multiplyMat4(Ry, multiplyMat4(Rx, Tneg))))
}
