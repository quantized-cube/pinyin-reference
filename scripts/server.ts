import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { execFile } from 'node:child_process';

const root = fileURLToPath(new URL('../../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types: Record<string,string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
export const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': (types[extname(path)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) { res.writeHead(error instanceof URIError ? 400 : 404).end('Not found'); }
});
server.on('error', (error) => { console.error('code' in error && error.code === 'EADDRINUSE' ? `Port ${port} is in use. Set PORT to another port.` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  const address=server.address();
  if(!address || typeof address==='string')throw new Error('Unexpected server address');
  const url=`http://127.0.0.1:${address.port}`;
  console.log(`Pinyin Reference: ${url}`);
  if(process.argv.includes('--open') && process.platform==='win32')execFile('explorer.exe',[url],{windowsHide:true},()=>{});
});
