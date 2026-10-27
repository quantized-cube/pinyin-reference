import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getSyllable,parseQuery} from '../src/data.js';
import {erhuaGroups} from '../src/erhua.js';
import {erhuaComparisons,erhuaSequence} from '../src/erhua-recordings.js';

const root = new URL('../../', import.meta.url);

test('erhua recordings ship the credited complete words with matching assets and readings', async () => {
  const folder = new URL('public/audio/erhua/', root);
  const credits: {file:string;word:string;pinyin:string;author:string;licenseUrl:string;sourcePage:string;sourceRevision?:string;sourceIndexSha256?:string;before:{word:string;pinyin:string;url:string};sha256:string;originalSha256:string;bytes:number;duration:number}[] = JSON.parse(await readFile(new URL('credits.json', folder), 'utf8'));
  const page = await readFile(new URL('credits.html', folder), 'utf8');
  assert.equal(erhuaComparisons.length, 9);
  assert.equal(new Set(erhuaComparisons.map(item => item.id)).size, 9);
  assert.equal(credits.length, erhuaComparisons.length);
  assert.deepEqual((await readdir(folder)).filter(file => file.endsWith('.mp3')).sort(), credits.map(c => c.file).sort());
  for (const item of erhuaComparisons) {
    const credit = credits.find(c => 'audio/erhua/' + c.file === item.after.audio);
    assert.ok(credit);
    assert.equal(credit.word, item.after.text);
    assert.equal(credit.pinyin, item.after.pinyin);
    assert.ok(credit.author.trim());
    assert.ok(['https://creativecommons.org/licenses/by/2.0/fr/','https://creativecommons.org/licenses/by-sa/3.0/us/'].includes(credit.licenseUrl));
    if(credit.sourceRevision)assert.match(credit.sourceRevision, /oldid=\d+$/);
    else assert.match(credit.sourceIndexSha256??'', /^[a-f0-9]{64}$/);
    assert.deepEqual(credit.before.word,item.before.text);
    assert.equal(credit.before.pinyin,item.before.pinyin);
    assert.equal(credit.before.url,item.before.audio);
    assert.deepEqual(await readFile(new URL('public/'+item.before.audio,root)),await readFile(new URL('dist/'+item.before.audio,root)));
    assert.match(credit.originalSha256, /^[a-f0-9]{64}$/);
    assert.ok(credit.duration > 0 && credit.duration < 5);
    for (const value of [item.after.text, item.after.pinyin, credit.author, credit.sourcePage, credit.licenseUrl]) assert.ok(page.includes(value));
    const audio = await readFile(new URL(credit.file, folder));
    assert.equal(audio.length, credit.bytes);
    assert.equal(createHash('sha256').update(audio).digest('hex'), credit.sha256);
    assert.deepEqual(await readFile(new URL('dist/' + item.after.audio, root)), audio);
  }
});


test('erhua comparisons match their table final and lexical tone, and sequence only the chosen row', () => {
  const finals=erhuaGroups.flatMap(group=>group.rows.map(row=>row.final));
  assert.equal(new Set(erhuaComparisons.map(pair=>pair.final)).size,erhuaComparisons.length);
  for(const pair of erhuaComparisons){
    assert.ok(finals.includes(pair.final));
    const before=parseQuery(pair.before.pinyin),after=parseQuery(pair.after.pinyin.slice(0,-1));
    assert.equal(before.text,after.text);
    assert.equal(before.tone,after.tone);
    assert.equal(getSyllable(before.text).final,pair.final);
    assert.equal(pair.after.text,pair.before.text+'儿');
    assert.deepEqual(erhuaSequence(pair.id,'both')?.map(item=>item.url),[pair.before.audio,pair.after.audio]);
    assert.deepEqual(erhuaSequence(pair.id,'before')?.map(item=>item.url),[pair.before.audio]);
    assert.deepEqual(erhuaSequence(pair.id,'after')?.map(item=>item.url),[pair.after.audio]);
    assert.equal(erhuaSequence(pair.id,'unknown'),undefined);
  }
  assert.equal(erhuaSequence('missing','both'),undefined);
});
