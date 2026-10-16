import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {neutralToneExamples} from '../src/neutral-tone.js';

test('every neutral-tone recording is shipped unchanged with its attribution and license', async () => {
  const root = new URL('../../', import.meta.url);
  const credits: {file:string;word:string;sha256:string;author:string;licenseUrl:string;sourcePage:string}[] = JSON.parse(await readFile(new URL('public/audio/neutral/credits.json', root), 'utf8'));
  assert.equal(credits.length, neutralToneExamples.length);
  for (const example of neutralToneExamples) {
    const credit = credits.find(item=>item.word===example.text);
    assert.ok(credit);
    assert.equal(example.audio, 'audio/neutral/'+credit.file);
    const source = await readFile(new URL('public/'+example.audio, root));
    const built = await readFile(new URL('dist/'+example.audio, root));
    assert.deepEqual(built, source);
    assert.equal(createHash('sha256').update(source).digest('hex'), credit.sha256);
    assert.ok(credit.author.length>0);
    assert.equal(new URL(credit.licenseUrl).hostname, 'creativecommons.org');
    assert.equal(new URL(credit.sourcePage).hostname, 'commons.wikimedia.org');
  }
});
