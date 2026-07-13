import fs from 'node:fs'
const src=fs.readFileSync(new URL('../source/src/main.ts', import.meta.url),'utf8')
const html=(src.match(/optimization-window-layer/g)||[]).length
if(html<1) throw new Error('Dedicated optimization-window layer template missing')
for(const plane of ['sagittal','coronal','axial']) if(!src.includes(plane)) throw new Error(`Missing plane ${plane}`)
if(!src.includes("view.windowLayer.classList.toggle('active', active)")) throw new Error('Shared layer activation missing')
if(!src.includes('if (!constraint) return true')) throw new Error('Unrestricted undefined-window behavior missing')
if(!src.includes('while(points.length<1000 && stride>1)')) throw new Error('Adaptive constrained sampling missing')
if(src.includes('optimization windows do not intersect in 3D')) throw new Error('Obsolete 3D-intersection path present')
console.log('optimization-window static validation passed')
