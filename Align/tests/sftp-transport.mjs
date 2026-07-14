import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { SftpClient, withSftp, isDirectory } from '../source/sftpClient.mjs'
const here=path.dirname(fileURLToPath(import.meta.url)); const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),'brainana-sftp-test-'))
process.env.BRAINANA_FAKE_SFTP_ROOT=root
const executable=path.join(here,'fake-sftp-server.mjs'); const options={sshExecutable:executable,sshTarget:'fake',timeoutMs:5000}
await fs.promises.mkdir(path.join(root,'data')); await fs.promises.writeFile(path.join(root,'data','a.nii'),Buffer.from('abcdef'))
await withSftp(options,async sftp=>{
 const st=await sftp.stat('/data'); assert.equal(isDirectory(st),true)
 const entries=await sftp.list('/data'); assert.equal(entries.some(e=>e.name==='a.nii'&&e.attrs.size===6),true)
 const chunks=[]; for await(const c of sftp.readFile('/data/a.nii',2))chunks.push(c); assert.equal(Buffer.concat(chunks).toString(),'abcdef')
 await fs.promises.writeFile(path.join(root,'local.bin'),Buffer.from('replacement'))
 await sftp.uploadFile(path.join(root,'local.bin'),'/data/temp.bin',{exclusive:true}); assert.equal((await sftp.stat('/data/temp.bin')).size,11)
 await sftp.rename('/data/temp.bin','/data/final.bin'); assert.equal(await sftp.exists('/data/final.bin'),true)
 await sftp.mkdirp('/data/nested/path'); assert.equal(isDirectory(await sftp.stat('/data/nested/path')),true)
 await sftp.remove('/data/final.bin'); assert.equal(await sftp.exists('/data/final.bin'),false)
})
await fs.promises.rm(root,{recursive:true,force:true})
console.log('SFTP transport tests passed')
