import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {neutralToneExamples} from '../src/neutral-tone.js';
import {comparisonRecordingTokens, comparisonRecording} from '../src/comparison-recordings.js';
import {comparisonPresets, comparisonSequence} from '../src/comparison.js';
import {markTone} from '../src/data.js';

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

test('all 15 presets are covered by the 27 unchanged first-tone recordings and their credits', async () => {
  const root = new URL('../../', import.meta.url);
  const folder = new URL('public/audio/comparison/', root);
  const credits: {file:string;token:string;pinyin:string;sha256:string;bytes:number;speaker:string;author:string;license:string;licenseUrl:string;sourcePage:string;sourceRevision:string}[] =
    JSON.parse(await readFile(new URL('credits.json', folder), 'utf8'));
  assert.equal(comparisonPresets.length, 15);
  assert.equal(credits.length, 27);
  const requiredTokens = new Set(comparisonPresets.flatMap(preset=>preset.syllables.map(pinyin=>`${pinyin}${preset.tone}`)));
  assert.deepEqual(new Set(comparisonRecordingTokens), requiredTokens);
  assert.deepEqual(new Set(credits.map(credit=>credit.token)), requiredTokens);
  assert.deepEqual((await readdir(folder)).filter(file=>file.endsWith('.mp3')).sort(), credits.map(credit=>credit.file).sort());
  const page = await readFile(new URL('credits.html', folder), 'utf8');
  for (const credit of credits) {
    assert.match(credit.token, /^[a-z]+1$/);
    assert.equal(credit.file, credit.token+'.mp3');
    const pinyin = credit.token.slice(0,-1);
    const audio = comparisonRecording(pinyin,1);
    assert.equal(audio, 'audio/comparison/'+credit.file);
    assert.equal(credit.pinyin, markTone(pinyin,1));
    const source = await readFile(new URL(credit.file, folder));
    assert.equal(source.length, credit.bytes);
    assert.equal(createHash('sha256').update(source).digest('hex'), credit.sha256);
    assert.deepEqual(await readFile(new URL('dist/'+audio, root)), source);
    // The preserved upstream ID3 TXXX metadata binds the audio to its numbered pinyin.
    const tags = source.toString('utf8');
    assert.ok(tags.includes('SWAC_TEXT\0'+credit.token+'\0'));
    assert.ok(tags.includes('SWAC_LANG\0cmn\0'));
    assert.ok(tags.includes('SWAC_COLL_LICENSE\0CC-BY-SA-3.0\0'));
    assert.equal(credit.speaker, 'Chen Wang 王琛');
    assert.ok(tags.includes('SWAC_SPEAK_NAME\0'+credit.speaker+'\0'));
    assert.equal(credit.author, 'Wang Chen, Lopez Hugo, Vion Nicolas');
    assert.equal(credit.license, 'CC BY-SA 3.0');
    assert.equal(credit.licenseUrl, 'https://creativecommons.org/licenses/by-sa/3.0/');
    assert.equal(credit.sourcePage, `https://github.com/hugolpz/audio-cmn/blob/${credit.sourceRevision}/64k/syllabs/cmn-${credit.file}`);
    assert.ok(page.includes(credit.sourcePage));
    assert.ok(page.includes(credit.author));
    assert.ok(page.includes(credit.licenseUrl));
  }
  for (const preset of comparisonPresets) {
    const sequence = comparisonSequence(preset.syllables,preset.tone,'alternate');
    assert.equal(sequence?.length, preset.syllables.length*2);
  }
});

test('unrecorded syllables and tones cannot silently fall back to a different recording', () => {
  assert.equal(comparisonRecording('si',2), undefined);
  assert.equal(comparisonRecording('ê',1), undefined);
  assert.equal(comparisonSequence(['si','shi'],2,'alternate'), undefined);
  assert.equal(comparisonSequence(['si','ê'],1,'alternate'), undefined);
  assert.equal(comparisonSequence(['si','shi'],1,'C'), undefined);
  assert.equal(comparisonSequence(['si','shi'],1,'unknown'), undefined);
  assert.equal(comparisonSequence(['si','ê'],1,'A')?.[0]?.url, 'audio/comparison/si1.mp3');
});
