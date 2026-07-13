#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const arg = (name, fallback) => { const i=args.indexOf(name); return i>=0 && args[i+1] ? args[i+1] : fallback }
const host = arg('--host','127.0.0.1')
const port = Number(arg('--port','4173'))
const root = path.resolve(arg('--root',process.env.HOME || process.cwd()))
const mode = arg('--mode','local')
const label = arg('--label', mode === 'remote' ? 'Remote workstation' : 'This Mac')
const dist = path.join(here,'dist')
const allowed = ['.nii','.nii.gz','.hdr','.img','.img.gz','.head','.brik','.brik.gz','.mgh','.mgz','.nrrd','.nhdr','.mif','.mha','.mhd','.raw','.v','.v16','.vmr','.npy','.npz','.fib','.src']
const isAllowed = n => { const l=n.toLowerCase(); return allowed.some(e=>l.endsWith(e)) }
const safe = rel => {
  const clean = String(rel || '').replace(/^\/+/, '')
  const resolved = path.resolve(root, clean)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('Path is outside the configured data root')
  return { resolved, clean: path.relative(root,resolved).split(path.sep).join('/') }
}
const json = (res,status,obj) => { const body=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body) }
const text = (res,status,msg) => {res.writeHead(status,{'content-type':'text/plain; charset=utf-8'});res.end(msg)}

const readJsonBody = async req => {
  const chunks=[]
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
const saveDirectoryListing = async rel => {
  const {resolved,clean}=safe(rel||'')
  const st=await fs.promises.stat(resolved)
  if(!st.isDirectory()) throw new Error('Not a directory')
  const ents=await fs.promises.readdir(resolved,{withFileTypes:true})
  const entries=ents.filter(e=>e.isDirectory()&&!e.name.startsWith('.')).map(e=>({name:e.name,path:path.posix.join(clean,e.name)}))
  entries.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}))
  return {path:clean,parent:clean?(path.posix.dirname(clean)==='.'?'':path.posix.dirname(clean)):null,entries}
}
const receiveFile = async (req,destination,overwrite) => {
  await fs.promises.mkdir(path.dirname(destination),{recursive:true})
  if(!overwrite){try{await fs.promises.access(destination);const error=new Error('File already exists');error.code='EEXIST';throw error}catch(error){if(error.code!=='ENOENT')throw error}}
  const temp=`${destination}.brainana-part-${process.pid}-${Date.now()}`
  try{
    await new Promise((resolve,reject)=>{const out=fs.createWriteStream(temp,{flags:'wx'});req.on('error',reject);out.on('error',reject);out.on('finish',resolve);req.pipe(out)})
    if(overwrite) await fs.promises.rm(destination,{force:true})
    await fs.promises.rename(temp,destination)
    return (await fs.promises.stat(destination)).size
  }catch(error){await fs.promises.rm(temp,{force:true}).catch(()=>{});throw error}
}

const mime = p => p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':p.endsWith('.svg')?'image/svg+xml':'application/octet-stream'

http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost')

    if(url.pathname==='/api/save-list'&&req.method==='GET') return json(res,200,await saveDirectoryListing(url.searchParams.get('path')||''))
    if(url.pathname==='/api/save-mkdir'&&req.method==='POST'){
      const body=await readJsonBody(req);const {resolved,clean}=safe(body.path||'')
      await fs.promises.mkdir(resolved,{recursive:false});return json(res,200,{path:clean})
    }
    if(url.pathname==='/api/save-file'&&req.method==='POST'){
      const {resolved,clean}=safe(url.searchParams.get('path')||'')
      if(!path.basename(resolved))return json(res,400,{error:'A filename is required'})
      try{const size=await receiveFile(req,resolved,url.searchParams.get('overwrite')==='1');return json(res,200,{path:clean,size})}
      catch(error){if(error&&error.code==='EEXIST')return json(res,409,{error:'File already exists'});throw error}
    }

    if(url.pathname==='/api/config') return json(res,200,{enabled:true,mode,label,rootName:path.basename(root)||root})
    if(url.pathname==='/api/list'){
      const {resolved,clean}=safe(url.searchParams.get('path')||'')
      const st=await fs.promises.stat(resolved);if(!st.isDirectory())return text(res,400,'Not a directory')
      const ents=await fs.promises.readdir(resolved,{withFileTypes:true})
      const entries=[]
      for(const ent of ents){
        if(ent.name.startsWith('.'))continue
        if(!ent.isDirectory()&&!isAllowed(ent.name))continue
        let size
        if(ent.isFile()){try{size=(await fs.promises.stat(path.join(resolved,ent.name))).size}catch{}}
        entries.push({name:ent.name,path:path.posix.join(clean,ent.name),directory:ent.isDirectory(),size})
      }
      entries.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}))
      const parent=clean?path.posix.dirname(clean)==='.'?'':path.posix.dirname(clean):null
      return json(res,200,{path:clean,parent,entries})
    }
    if(url.pathname==='/api/file'){
      const {resolved}=safe(url.searchParams.get('path')||'')
      if(!isAllowed(resolved))return text(res,415,'Unsupported file type')
      const st=await fs.promises.stat(resolved);if(!st.isFile())return text(res,400,'Not a file')
      res.writeHead(200,{'content-type':'application/octet-stream','content-length':st.size,'content-disposition':`attachment; filename="${path.basename(resolved).replaceAll('"','')}"`})
      return fs.createReadStream(resolved).pipe(res)
    }
    let rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)
    let file=path.resolve(dist,'.'+rel)
    if(!file.startsWith(dist+path.sep)&&file!==dist)return text(res,403,'Forbidden')
    try{const st=await fs.promises.stat(file);if(st.isDirectory())file=path.join(file,'index.html')}catch{file=path.join(dist,'index.html')}
    const st=await fs.promises.stat(file)
    res.writeHead(200,{'content-type':mime(file),'content-length':st.size,'cache-control':(file.endsWith('index.html')||file.includes('remote-export-'))?'no-store':'public, max-age=31536000, immutable'})
    fs.createReadStream(file).pipe(res)
  }catch(error){text(res,500,error instanceof Error?error.message:String(error))}
}).listen(port,host,()=>console.log(`Brainana Align serving ${root} at http://${host}:${port}`))
