/// <reference types="vite/client" />
interface FileSystemDirectoryHandle { name: string; getFileHandle(name:string, options?:{create?:boolean}):Promise<FileSystemFileHandle> }
interface FileSystemFileHandle { createWritable():Promise<FileSystemWritableFileStream> }
interface FileSystemWritableFileStream { write(data:Blob):Promise<void>; close():Promise<void> }
interface Window { showDirectoryPicker?: (options?:{mode?:'read'|'readwrite'})=>Promise<FileSystemDirectoryHandle> }
