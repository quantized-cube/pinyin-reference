// This small bootstrap runs before the TypeScript tooling has been compiled.
// checkJs in tsconfig.tools.json checks it along with the TypeScript sources.
import { lstat, realpath, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @param {string} projectRoot */
export async function cleanOutputs(projectRoot) {
  const root = await realpath(projectRoot);
  // Validate every target before removing either output directory.
  const targets = [];
  for (const name of ['dist', '.build']) {
    const target = resolve(root, name);
    let info;
    try {
      info = await lstat(target);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink() || relative(root, await realpath(target)) !== name) {
      throw new Error(`Refusing to clean an unexpected output path: ${target}`);
    }
    targets.push(target);
  }
  for (const target of targets) await rm(target, { recursive: true, force: true });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await cleanOutputs(fileURLToPath(new URL('../', import.meta.url)));
}
