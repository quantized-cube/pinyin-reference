import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function discoverTests(directory: string): Promise<string[]> {
  const tests: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) tests.push(...await discoverTests(path));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) tests.push(path);
  }
  return tests.sort();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const files = await discoverTests(fileURLToPath(new URL('../tests/', import.meta.url)));
  if (!files.length) throw new Error('No compiled test files found');
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--test', ...files], {
    stdio: 'inherit', windowsHide: true,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
