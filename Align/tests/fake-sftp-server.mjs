#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
const ROOT=path.resolve(process.env.BRAINANA_FAKE_SFTP_ROOT||process.cwd())
const T={INIT:1,VERSION:2,OPEN:3,CLOSE:4,READ:5,WRITE:6,LSTAT:7,OPENDIR:11,READDIR:12,REMOVE:13,MKDIR:14,RMDIR:15,REALPATH:16,STAT:17,RENAME:18,STATUS:101,HANDLE:102,DATA:103,NAME:104,ATTRS:105}
const S={OK:0,EOF:1,NO_SUCH_FILE:2,PERMISSION:3,FAILURE:4,UNSUPPORTED:8}
const A={SIZE:1,PERMISSIONS:4,ACMODTIME:8}
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n>>>0);return b}; const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(n));return b}
const str=v=>{const b=Buffer.from(v);return Buffer.concat([u32(b.length),b])}; const pkt=parts=>{const b=Buffer.concat(parts);return Buffer.concat([u32(b.length),b])}
const readStr=(b,o)=>{const n=b.readUInt32BE(o);return [b.subarray(o+4,o+4+n),o+4+n]}
const safe=p=>{const x=path.resolve(ROOT,'.'+('/'+String(p).replace(/^\/+/,'')));if(x!==ROOT&&!x.startsWith(ROOT+path.sep))throw Object.assign(new Error('outside'),{code:'EACCES'});return x}
const attrs=st=>Buffer.concat([u32(A.SIZE|A.PERMISSIONS|A.ACMODTIME),u64(st.size),u32((st.isDirectory()?0o040000:0o100000)|(st.mode&0o777)),u32(Math.floor(st.atimeMs/1000)),u32(Math.floor(st.mtimeMs/1000))])
const handles=new Map();let next=1;let buffer=Buffer.alloc(0)
function send(parts){process.stdout.write(pkt(parts))}
function status(id,code,msg=''){send([Buffer.from([T.STATUS]),u32(id),u32(code),str(msg),str('')])}
function fail(id,e){status(id,e.code==='ENOENT'?S.NO_SUCH_FILE:e.code==='EACCES'?S.PERMISSION:S.FAILURE,e.message)}
async function handle(body){const type=body[0];if(type===T.INIT){send([Buffer.from([T.VERSION]),u32(3)]);return}const id=body.readUInt32BE(1);let o=5;try{
 if(type===T.STAT||type===T.LSTAT){let p;[p,o]=readStr(body,o);const st=await fs.promises.stat(safe(p.toString()));send([Buffer.from([T.ATTRS]),u32(id),attrs(st)]);return}
 if(type===T.OPENDIR){let p;[p,o]=readStr(body,o);const entries=await fs.promises.readdir(safe(p.toString()),{withFileTypes:true});const h=Buffer.from(String(next++));handles.set(h.toString('hex'),{kind:'dir',path:safe(p.toString()),entries,index:0});send([Buffer.from([T.HANDLE]),u32(id),str(h)]);return}
 if(type===T.READDIR){let h;[h,o]=readStr(body,o);const state=handles.get(h.toString('hex'));if(!state||state.kind!=='dir')throw new Error('bad handle');if(state.index>=state.entries.length){status(id,S.EOF);return}const batch=state.entries.slice(state.index,state.index+50);state.index+=batch.length;const parts=[Buffer.from([T.NAME]),u32(id),u32(batch.length)];for(const e of batch){const st=await fs.promises.stat(path.join(state.path,e.name));parts.push(str(e.name),str(`${e.isDirectory()?'d':'-'} ${e.name}`),attrs(st))}send(parts);return}
 if(type===T.OPEN){let p;[p,o]=readStr(body,o);const flags=body.readUInt32BE(o);const file=safe(p.toString());await fs.promises.mkdir(path.dirname(file),{recursive:true});let mode='r';if(flags&2){if((flags&32)&&fs.existsSync(file))throw Object.assign(new Error('exists'),{code:'EEXIST'});mode=(flags&16)?'w':'r+';if((flags&8)&&!fs.existsSync(file))mode='w+'}const fd=await fs.promises.open(file,mode);const h=Buffer.from(String(next++));handles.set(h.toString('hex'),{kind:'file',fd});send([Buffer.from([T.HANDLE]),u32(id),str(h)]);return}
 if(type===T.CLOSE){let h;[h,o]=readStr(body,o);const state=handles.get(h.toString('hex'));if(state?.fd)await state.fd.close();handles.delete(h.toString('hex'));status(id,S.OK);return}
 if(type===T.READ){let h;[h,o]=readStr(body,o);const off=Number(body.readBigUInt64BE(o));o+=8;const len=body.readUInt32BE(o);const state=handles.get(h.toString('hex'));const b=Buffer.alloc(len);const {bytesRead}=await state.fd.read(b,0,len,off);if(!bytesRead){status(id,S.EOF);return}send([Buffer.from([T.DATA]),u32(id),str(b.subarray(0,bytesRead))]);return}
 if(type===T.WRITE){let h;[h,o]=readStr(body,o);const off=Number(body.readBigUInt64BE(o));o+=8;let data;[data,o]=readStr(body,o);const state=handles.get(h.toString('hex'));await state.fd.write(data,0,data.length,off);status(id,S.OK);return}
 if(type===T.MKDIR){let p;[p,o]=readStr(body,o);await fs.promises.mkdir(safe(p.toString()));status(id,S.OK);return}
 if(type===T.REMOVE){let p;[p,o]=readStr(body,o);await fs.promises.unlink(safe(p.toString()));status(id,S.OK);return}
 if(type===T.RENAME){let a,b;[a,o]=readStr(body,o);[b,o]=readStr(body,o);await fs.promises.rename(safe(a.toString()),safe(b.toString()));status(id,S.OK);return}
 status(id,S.UNSUPPORTED,'unsupported')
}catch(e){fail(id,e)}}
process.stdin.on('data',d=>{buffer=Buffer.concat([buffer,d]);while(buffer.length>=4){const n=buffer.readUInt32BE(0);if(buffer.length<4+n)break;const b=buffer.subarray(4,4+n);buffer=buffer.subarray(4+n);handle(b)}})
