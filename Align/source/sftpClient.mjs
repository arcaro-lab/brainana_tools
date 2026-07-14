import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

const FXP = { INIT:1, VERSION:2, OPEN:3, CLOSE:4, READ:5, WRITE:6, LSTAT:7, OPENDIR:11, READDIR:12, REMOVE:13, MKDIR:14, RMDIR:15, REALPATH:16, STAT:17, RENAME:18, STATUS:101, HANDLE:102, DATA:103, NAME:104, ATTRS:105 }
const STATUS = { OK:0, EOF:1, NO_SUCH_FILE:2, PERMISSION_DENIED:3, FAILURE:4, BAD_MESSAGE:5, NO_CONNECTION:6, CONNECTION_LOST:7, OP_UNSUPPORTED:8 }
const OPEN = { READ:1, WRITE:2, APPEND:4, CREAT:8, TRUNC:16, EXCL:32 }
const ATTR = { SIZE:1, UIDGID:2, PERMISSIONS:4, ACMODTIME:8, EXTENDED:0x80000000 }
const u32 = value => { const b=Buffer.alloc(4); b.writeUInt32BE(value>>>0); return b }
const u64 = value => { const b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(value)); return b }
const str = value => { const b=Buffer.from(value); return Buffer.concat([u32(b.length), b]) }
const packet = parts => { const body=Buffer.concat(parts); return Buffer.concat([u32(body.length), body]) }
function readString(buffer, offset){ const n=buffer.readUInt32BE(offset); return [buffer.subarray(offset+4, offset+4+n), offset+4+n] }
function readAttrs(buffer, offset){
  const flags=buffer.readUInt32BE(offset); offset+=4; const attrs={ flags }
  if(flags&ATTR.SIZE){ attrs.size=Number(buffer.readBigUInt64BE(offset)); offset+=8 }
  if(flags&ATTR.UIDGID){ attrs.uid=buffer.readUInt32BE(offset); attrs.gid=buffer.readUInt32BE(offset+4); offset+=8 }
  if(flags&ATTR.PERMISSIONS){ attrs.permissions=buffer.readUInt32BE(offset); offset+=4 }
  if(flags&ATTR.ACMODTIME){ attrs.atime=buffer.readUInt32BE(offset); attrs.mtime=buffer.readUInt32BE(offset+4); offset+=8 }
  if(flags&ATTR.EXTENDED){ const count=buffer.readUInt32BE(offset); offset+=4; attrs.extended=[]; for(let i=0;i<count;i++){ let a; [a,offset]=readString(buffer,offset); let v; [v,offset]=readString(buffer,offset); attrs.extended.push([a.toString(),v.toString()]) } }
  return [attrs,offset]
}
function statusError(code, message, operation){ const error=new Error(message||`SFTP ${operation} failed (${code})`); error.sftpCode=code; if(code===STATUS.NO_SUCH_FILE) error.code='ENOENT'; else if(code===STATUS.PERMISSION_DENIED) error.code='EACCES'; else if(code===STATUS.OP_UNSUPPORTED) error.code='ENOTSUP'; else error.code='EIO'; return error }

export class SftpClient extends EventEmitter {
  constructor({ sshExecutable, sshTarget, controlSocket='', timeoutMs=120000, spawnProcess=spawn }){
    super(); this.nextId=1; this.pending=new Map(); this.buffer=Buffer.alloc(0); this.timeoutMs=timeoutMs
    const args=[...(controlSocket?['-S',controlSocket]:[]),'-o','BatchMode=yes','-s',sshTarget,'sftp']
    this.child=spawnProcess(sshExecutable,args,{stdio:['pipe','pipe','pipe']}); this.stderr=''
    this.child.stderr.on('data',d=>{this.stderr+=d; this.emit('stderr',String(d))})
    this.child.stdout.on('data',d=>this.#consume(d)); this.child.on('error',e=>this.#failAll(e)); this.child.on('close',c=>this.#failAll(new Error(this.stderr.trim()||`SFTP transport closed (${c})`)))
  }
  async init(){
    const promise=new Promise((resolve,reject)=>{ this.versionWait={resolve,reject}; this.child.stdin.write(packet([Buffer.from([FXP.INIT]),u32(3)])) })
    const version=await this.#timed(promise,'initialize'); if(version<3) throw new Error(`Unsupported SFTP version ${version}`); return this
  }
  #timed(promise, operation){ let timer; return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`SFTP ${operation} timed out`)),this.timeoutMs)})]).finally(()=>clearTimeout(timer)) }
  #consume(data){ this.buffer=Buffer.concat([this.buffer,data]); while(this.buffer.length>=4){ const length=this.buffer.readUInt32BE(0); if(this.buffer.length<4+length)return; const body=this.buffer.subarray(4,4+length); this.buffer=this.buffer.subarray(4+length); this.#message(body) } }
  #message(body){ const type=body[0]; if(type===FXP.VERSION){ const version=body.readUInt32BE(1); this.versionWait?.resolve(version); this.versionWait=null; return } const id=body.readUInt32BE(1); const p=this.pending.get(id); if(!p)return; this.pending.delete(id); p.resolve({type,body:body.subarray(5)}) }
  #failAll(error){ this.versionWait?.reject(error); this.versionWait=null; for(const p of this.pending.values())p.reject(error); this.pending.clear() }
  async #request(type, parts, operation){ const id=this.nextId++; const promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject})); this.child.stdin.write(packet([Buffer.from([type]),u32(id),...parts])); const response=await this.#timed(promise,operation); if(response.type===FXP.STATUS){ const code=response.body.readUInt32BE(0); let msg=Buffer.alloc(0); if(response.body.length>=8)[msg]=readString(response.body,4); if(code!==STATUS.OK)throw statusError(code,msg.toString(),operation) } return response }
  async stat(filename){ const r=await this.#request(FXP.STAT,[str(filename)],'stat'); if(r.type!==FXP.ATTRS)throw new Error('Unexpected SFTP stat response'); return readAttrs(r.body,0)[0] }
  async exists(filename){ try{await this.stat(filename); return true}catch(e){if(e.code==='ENOENT')return false; throw e} }
  async open(filename,pflags){ const r=await this.#request(FXP.OPEN,[str(filename),u32(pflags),u32(0)],'open'); if(r.type!==FXP.HANDLE)throw new Error('Unexpected SFTP open response'); return readString(r.body,0)[0] }
  async closeHandle(handle){ await this.#request(FXP.CLOSE,[str(handle)],'close') }
  async opendir(filename){ const r=await this.#request(FXP.OPENDIR,[str(filename)],'opendir'); if(r.type!==FXP.HANDLE)throw new Error('Unexpected SFTP opendir response'); return readString(r.body,0)[0] }
  async readdir(handle){ try{ const r=await this.#request(FXP.READDIR,[str(handle)],'readdir'); if(r.type!==FXP.NAME)throw new Error('Unexpected SFTP readdir response'); let off=0; const count=r.body.readUInt32BE(off); off+=4; const items=[]; for(let i=0;i<count;i++){let name,longname; [name,off]=readString(r.body,off); [longname,off]=readString(r.body,off); let attrs; [attrs,off]=readAttrs(r.body,off); items.push({name:name.toString(),longname:longname.toString(),attrs})} return items }catch(e){if(e.sftpCode===STATUS.EOF)return []; throw e} }
  async list(filename){ const handle=await this.opendir(filename); const out=[]; try{while(true){const batch=await this.readdir(handle); if(!batch.length)break; out.push(...batch)}}finally{await this.closeHandle(handle).catch(()=>{})} return out }
  async mkdir(filename){ await this.#request(FXP.MKDIR,[str(filename),u32(0)],'mkdir') }
  async mkdirp(filename){ const parts=filename.split('/').filter(Boolean); let current=filename.startsWith('/')?'/':''; for(const part of parts){ current=current==='/'?`/${part}`:current?`${current}/${part}`:part; try{await this.mkdir(current)}catch(e){if(e.code!=='EIO' && e.code!=='EACCES')throw e; const a=await this.stat(current); if(!isDirectory(a))throw e} } }
  async remove(filename){ await this.#request(FXP.REMOVE,[str(filename)],'remove') }
  async rename(from,to){ await this.#request(FXP.RENAME,[str(from),str(to)],'rename') }
  async readChunk(handle,offset,length){ try{const r=await this.#request(FXP.READ,[str(handle),u64(offset),u32(length)],'read'); if(r.type!==FXP.DATA)throw new Error('Unexpected SFTP read response'); return readString(r.body,0)[0]}catch(e){if(e.sftpCode===STATUS.EOF)return null; throw e} }
  async *readFile(filename,chunkSize=1024*1024){ const handle=await this.open(filename,OPEN.READ); let offset=0; try{while(true){const data=await this.readChunk(handle,offset,chunkSize); if(!data||!data.length)break; offset+=data.length; yield data}}finally{await this.closeHandle(handle).catch(()=>{})} }
  async writeChunk(handle,offset,data){ await this.#request(FXP.WRITE,[str(handle),u64(offset),str(data)],'write') }
  async uploadFile(local,remote,{exclusive=false,chunkSize=1024*1024}={}){ const flags=OPEN.WRITE|OPEN.CREAT|OPEN.TRUNC|(exclusive?OPEN.EXCL:0); const handle=await this.open(remote,flags); let offset=0; try{const stream=fs.createReadStream(local,{highWaterMark:chunkSize}); for await(const chunk of stream){await this.writeChunk(handle,offset,chunk); offset+=chunk.length}}finally{await this.closeHandle(handle).catch(()=>{})} return offset }
  async end(){ if(!this.child.killed){this.child.stdin.end(); this.child.kill('SIGTERM')} }
}
export const isDirectory = attrs => Boolean((attrs.permissions??0)&0o040000)
export async function withSftp(options,fn){ const client=await new SftpClient(options).init(); try{return await fn(client)}finally{await client.end()} }
export { FXP, STATUS, OPEN, ATTR, readAttrs }
