import { cp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
execFileSync(process.execPath, [join(projectRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], {
  cwd: projectRoot, stdio: 'inherit', windowsHide: true,
});
await mkdir(join(projectRoot, 'dist'), { recursive: true });
await cp(join(projectRoot, 'public'), join(projectRoot, 'dist'), { recursive: true });
console.log('Built TypeScript and copied static assets to dist/.');
