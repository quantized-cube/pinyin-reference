import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {thirdToneRecording, thirdToneRecordings} from '../src/third-tone-recordings.js';
import {parseExampleCatalog, detailExample} from '../src/examples.js';
import {resolveDetailPlayback} from '../src/detail-playback.js';
import {parseQuery} from '../src/data.js';
import type {PronunciationExample} from '../src/types.js';

const root = new URL('../../', import.meta.url);
const catalog = parseExampleCatalog(JSON.parse(await readFile(new URL('public/examples.json', root), 'utf8')));

test('contextual recordings ship exact examples, unchanged audio and separate attribution', async () => {
  const folder = new URL('public/audio/third-tone/', root);
  const credits: {file:string;word:string;tokens:string[];target:number;form:string;sha256:string;bytes:number;author:string;licenseUrl:string;sourcePage:string}[] = JSON.parse(await readFile(new URL('credits.json', folder), 'utf8'));
  const page = await readFile(new URL('credits.html', folder), 'utf8');
  assert.equal(thirdToneRecordings.length, 3);
  assert.equal(credits.length, thirdToneRecordings.length);
  assert.deepEqual((await readdir(folder)).filter(f => f.endsWith('.mp3')).sort(), credits.map(c => c.file).sort());
  for (const recording of thirdToneRecordings) {
    const credit = credits.find(c => 'audio/third-tone/' + c.file === recording.url);
    assert.ok(credit);
    const {text, tokens, target, form} = recording;
    assert.deepEqual({text:credit.word, tokens:credit.tokens, target:credit.target, form:credit.form}, {text, tokens, target, form});
    const syllable = parseQuery(tokens[target] ?? '');
    assert.equal(syllable.tone, 3);
    assert.deepEqual(detailExample(syllable.text, 3, form, catalog), {text, tokens, target});
    assert.ok(credit.author.trim());
    assert.match(credit.licenseUrl, /^https:\/\/creativecommons\.org\/licenses\//);
    for (const value of [credit.word, credit.author, credit.licenseUrl, credit.sourcePage]) assert.ok(page.includes(value));
    const audio = await readFile(new URL(credit.file, folder));
    assert.equal(audio.length, credit.bytes);
    assert.equal(createHash('sha256').update(audio).digest('hex'), credit.sha256);
    assert.deepEqual(await readFile(new URL('dist/' + recording.url, root)), audio);
  }
});

test('lao uses the isolated recording or the exact complete word for each third-tone form', () => {
  for (const [form, word, tokens, url] of [
    ['full', '老', ['lao3'], 'audio/syllables/lao3.mp3'],
    ['half', '老师', ['lao3','shi1'], 'audio/third-tone/laoshi.mp3'],
    ['sandhi', '老板', ['lao3','ban3'], 'audio/third-tone/laoban.mp3'],
  ] as const) {
    const playback = resolveDetailPlayback({selected:'lao', tone:3, thirdToneForm:form}, catalog, 'ready');
    assert.equal(playback.kind, 'recording');
    if (playback.kind !== 'recording') throw new Error('Expected a recording');
    assert.equal(playback.url, url);
    assert.equal(playback.contextual, form !== 'full');
    const example = playback.example;
    assert.ok(example);
    assert.deepEqual(example, {text:word, tokens, target:0});
    if (form !== 'full') {
      assert.equal(thirdToneRecording({...example, tokens:['lao2', tokens[1]]}, form), undefined);
      assert.equal(thirdToneRecording(example, form === 'half' ? 'sandhi' : 'half'), undefined);
    }
  }
});

test('contextual audio never follows a changed word, reading, target or pronunciation form', () => {
  const example: PronunciationExample = {text:'好吃', tokens:['hao3','chi1'], target:0};
  assert.equal(thirdToneRecording(example, 'half'), 'audio/third-tone/haochi.mp3');
  for (const changed of [
    {...example, text:'好喝'},
    {...example, tokens:['hao4','chi1']},
    {...example, tokens:['hao3','chi2']},
    {...example, tokens:['hao3','chi1','ma5']},
    {...example, target:1},
  ]) assert.equal(thirdToneRecording(changed, 'half'), undefined);
  for (const form of ['full','sandhi'] as const) assert.equal(thirdToneRecording(example, form), undefined);
});

test('only the exact loaded contextual example selects a recording', () => {
  const state = {selected:'hao', tone:3 as const, thirdToneForm:'half' as const};
  const selected = resolveDetailPlayback(state, catalog, 'ready');
  assert.equal(selected.kind, 'recording');
  assert.equal(selected.example?.text, '好吃');
  assert.equal(selected.contextual, true);
  for (const status of ['loading','error','ready'] as const) {
    assert.equal(resolveDetailPlayback(state, undefined, status).kind, 'unavailable');
  }
  const other = {...catalog, thirdToneExamples:{...catalog.thirdToneExamples,
    hao3:{...catalog.thirdToneExamples.hao3, half:{text:'好喝', tokens:['hao3','he1'], target:0}},
  }};
  assert.deepEqual(resolveDetailPlayback(state, other, 'ready'), {
    example:other.thirdToneExamples.hao3.half, contextual:true, kind:'speech', text:'好喝',
  });
  assert.equal(resolveDetailPlayback({...state, thirdToneForm:'full'}, catalog, 'ready').contextual, false);
  assert.equal(resolveDetailPlayback({...state, thirdToneForm:'sandhi'}, catalog, 'ready').kind, 'speech');
  assert.equal(resolveDetailPlayback({...state, selected:'ma', tone:5}, catalog, 'ready').kind, 'speech');
});
