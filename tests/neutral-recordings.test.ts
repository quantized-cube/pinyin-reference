import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {neutralRecording, neutralRecordings} from '../src/neutral-recordings.js';
import {neutralToneExamples} from '../src/neutral-tone.js';
import {parseExampleCatalog, detailExample} from '../src/examples.js';
import {resolveDetailPlayback} from '../src/detail-playback.js';
import {markTone, parseQuery, syllables} from '../src/data.js';
import type {PronunciationExample} from '../src/types.js';

const root = new URL('../../', import.meta.url);
const catalog = parseExampleCatalog(JSON.parse(await readFile(new URL('public/examples.json', root), 'utf8')));

test('all 111 neutral recordings match their displayed context, attribution, source reading and shipped bytes', async () => {
  const folder = new URL('public/audio/neutral/', root);
  const credits: {file:string;word:string;pinyin:string;tokens:string[];target:number;sha256:string;bytes:number;author:string;licenseUrl:string;sourcePage:string;retrieved:string;originalSha256?:string;originalBytes?:number;sourceIndexSha256?:string;sourceEntry?:{swac_text:string;swac_pron_phon:string;swac_lang:string}}[] = JSON.parse(await readFile(new URL('credits.json', folder), 'utf8'));
  const page = await readFile(new URL('credits.html', folder), 'utf8');
  assert.equal(neutralRecordings.length, 111);
  assert.equal(credits.length, 111);
  assert.equal(new Set(neutralRecordings.map(r=>r.url)).size, 111);
  assert.deepEqual((await readdir(folder)).filter(f=>f.endsWith('.mp3')).sort(), credits.map(c=>c.file).sort());
  const normalize = (value:string) => value.normalize('NFC').replace(/u:|v/g,'ü').replace(/[\s'’·-]/g,'');
  for (const recording of neutralRecordings) {
    const credit = credits.find(c=>'audio/neutral/'+c.file===recording.url);
    assert.ok(credit);
    const {text,tokens,target}=recording;
    const example={text,tokens,target};
    assert.deepEqual({text:credit.word,tokens:credit.tokens,target:credit.target},example);
    const selected=parseQuery(tokens[target]??'');
    assert.equal(selected.tone,5);
    assert.deepEqual(detailExample(selected.text,5,'full',catalog),example);
    assert.deepEqual(resolveDetailPlayback({selected:selected.text,tone:5,thirdToneForm:'full'},catalog,'ready'),
      {example,contextual:true,kind:'recording',url:recording.url});
    const pinyin=tokens.map(token=>{const p=parseQuery(token);return markTone(p.text,p.tone);}).join('');
    assert.equal(normalize(credit.pinyin),normalize(pinyin));
    assert.ok(credit.author.trim());
    assert.equal(new URL(credit.licenseUrl).hostname,'creativecommons.org');
    for (const value of [credit.word,credit.author,credit.sourcePage,credit.licenseUrl]) assert.ok(page.includes(value));
    const bytes=await readFile(new URL(credit.file,folder));
    assert.equal(bytes.length,credit.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),credit.sha256);
    assert.deepEqual(await readFile(new URL('dist/'+recording.url,root)),bytes);
    if (credit.retrieved==='2026-11-07') {
      assert.equal(credit.originalSha256,credit.sha256);
      assert.equal(credit.originalBytes,credit.bytes);
      assert.match(credit.sourceIndexSha256??'',/^[a-f0-9]{64}$/);
      assert.equal(credit.sourceEntry?.swac_text,text);
      assert.equal(credit.sourceEntry?.swac_lang,'cmn');
      assert.equal(normalize(credit.sourceEntry?.swac_pron_phon??''),normalize(pinyin));
    }
  }
  assert.equal(credits.filter(c=>c.retrieved==='2026-11-07').length,107);
  for (const guide of neutralToneExamples) assert.ok(neutralRecordings.some(r=>r.text===guide.text && r.url===guide.audio));
});

test('neutral playback covers 111 of the 228 selectable examples and keeps TTS for the other 117', () => {
  const counts={recording:0,speech:0};
  for (const s of syllables) {
    if (!catalog.contextualExamples[s.pinyin+'5']) continue;
    const playback=resolveDetailPlayback({selected:s.pinyin,tone:5,thirdToneForm:'sandhi'},catalog,'ready');
    assert.equal(playback.contextual,true);
    if (playback.kind==='unavailable') assert.fail(s.pinyin);
    counts[playback.kind]++;
  }
  assert.deepEqual(counts,{recording:111,speech:117});
  const example=catalog.contextualExamples.a5;
  assert.ok(example);
  assert.equal(neutralRecording(example),undefined);
  assert.equal(resolveDetailPlayback({selected:'a',tone:5,thirdToneForm:'full'},catalog,'ready').kind,'speech');
});

test('the recording follows the whole neutral example, never a substring or a different tone or target', () => {
  const example:PronunciationExample={text:'对不起',tokens:['dui4','bu5','qi3'],target:1};
  assert.equal(neutralRecording(example),'audio/neutral/bu5.mp3');
  for (const changed of [
    {...example,text:'看不起'}, {...example,tokens:['dui4','bu4','qi3']},
    {...example,tokens:['dui4','bu5','qi2']}, {...example,tokens:['dui4','bu5']},
    {...example,target:0}, {...example,target:2},
    {text:'不',tokens:['bu5'],target:0},
    {text:'奶奶的',tokens:['nai3','nai5','de5'],target:1},
    {text:'花骨朵',tokens:['hua1','gu1','duo5'],target:2},
    {text:'起来',tokens:['qi5','lai5'],target:0},
  ]) assert.equal(neutralRecording(changed),undefined);
  assert.deepEqual(catalog.contextualExamples.bu5,example);
  assert.deepEqual(catalog.contextualExamples.qi5,{text:'力气',tokens:['li4','qi5'],target:1});
  assert.deepEqual(catalog.contextualExamples.nai5,{text:'奶奶',tokens:['nai3','nai5'],target:1});
});

test('neutral recordings need a loaded matching catalog and do not replace other tones', () => {
  const state={selected:'ma',tone:5 as const,thirdToneForm:'full' as const};
  for (const status of ['loading','error','ready'] as const) {
    assert.equal(resolveDetailPlayback(state,undefined,status).kind,'unavailable');
  }
  const changed={...catalog,contextualExamples:{...catalog.contextualExamples,ma5:{text:'干吗',tokens:['gan4','ma5'],target:1}}};
  assert.deepEqual(resolveDetailPlayback(state,changed,'ready'),{example:changed.contextualExamples.ma5,contextual:true,kind:'speech',text:'干吗'});
  for (const tone of [1,2,3,4] as const) {
    const result=resolveDetailPlayback({...state,tone},catalog,'ready');
    assert.equal(result.contextual,false);
    assert.equal(result.kind,'recording');
    if (result.kind==='recording') assert.equal(result.url,`audio/syllables/ma${tone}.mp3`);
  }
});
