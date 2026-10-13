import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanOutputs} from '../scripts/clean.mjs';
import {discoverTests} from '../scripts/test.js';

async function fixture(t: TestContext): Promise<string> {
  const work = resolve(fileURLToPath(new URL('../../work/', import.meta.url)));
  await mkdir(work, {recursive:true});
  const root = await mkdtemp(join(work, 'tooling-test-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), work);
    await rm(root, {recursive:true, force:true});
  });
  return root;
}

test('test discovery includes new and nested test files without a package script edit', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'nested'));
  for (const file of ['new.test.js', 'nested/another.test.js', 'helper.js', 'new.test.js.map', 'source.test.ts']) {
    await writeFile(join(root, file), 'fixture');
  }
  assert.deepEqual(await discoverTests(root), [join(root, 'nested/another.test.js'), join(root, 'new.test.js')].sort());
});

test('clean build removes stale runtime and test outputs while preserving source files', async t => {
  const root = await fixture(t);
  for (const name of ['dist', '.build', 'src']) await mkdir(join(root, name));
  await writeFile(join(root, 'dist', 'renamed.css'), 'old asset');
  await writeFile(join(root, '.build', 'removed.test.js'), 'old test');
  await writeFile(join(root, 'src', 'kept.ts'), 'source');
  await cleanOutputs(root);
  assert.deepEqual(await readdir(root), ['src']);
  assert.equal(await readFile(join(root, 'src', 'kept.ts'), 'utf8'), 'source');
  await cleanOutputs(root); // A fresh checkout has no outputs to remove.
});

test('clean build rejects linked output directories before deleting any target', async t => {
  const root = await fixture(t);
  const project = join(root, 'project'), outside = join(root, 'outside');
  await mkdir(join(project, 'dist'), {recursive:true});
  await mkdir(outside);
  await writeFile(join(project, 'dist', 'kept.js'), 'previous build');
  await writeFile(join(outside, 'kept.txt'), 'outside output');
  await symlink(outside, join(project, '.build'), process.platform==='win32'?'junction':'dir');
  await assert.rejects(cleanOutputs(project), /unexpected output path/);
  assert.equal(await readFile(join(project, 'dist', 'kept.js'), 'utf8'), 'previous build');
  assert.equal(await readFile(join(outside, 'kept.txt'), 'utf8'), 'outside output');
});
