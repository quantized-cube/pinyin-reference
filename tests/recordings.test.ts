import {resolveDetailPlayback} from '../src/detail-playback.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {neutralToneExamples} from '../src/neutral-tone.js';
import {comparisonRecordingTokens, comparisonRecording} from '../src/comparison-recordings.js';
import {comparisonPresets, comparisonSequence} from '../src/comparison.js';
import {parseQuery, syllables} from '../src/data.js';
import {detailRecordingTokens, detailRecording} from '../src/detail-recordings.js';
import {parseExampleCatalog, detailExample} from '../src/examples.js';

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


const root=new URL('../../',import.meta.url),folder=new URL('public/audio/syllables/',root);
interface Recording {token:string;sourceToken?:string;file?:string;sha256?:string;bytes?:number;duration?:number;unavailable?:string;metadataNote?:string}
const manifest: {schemaVersion:number;source:{revision:string;directory:string;speaker:string;author:string;license:string;licenseTag:string;licenseUrl:string};records:Recording[]} = JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
const catalog=parseExampleCatalog(JSON.parse(await readFile(new URL('public/examples.json',root),'utf8')));

test('the adopted scope remains the existing 1162 readings, with yo1 explicitly unavailable',()=>{
  const expected=new Set<string>();
  for(const s of syllables)for(const tone of [1,2,3,4] as const)if(detailExample(s.pinyin,tone,'full',catalog))expected.add(s.pinyin+tone);
  assert.equal(expected.size,1162);
  assert.equal(manifest.records.length,1162);
  assert.deepEqual(new Set(manifest.records.map(r=>r.token)),expected);
  assert.equal(detailRecordingTokens.length,1161);
  assert.deepEqual(manifest.records.filter(r=>r.unavailable).map(r=>r.token),['yo1']);
  assert.deepEqual(new Set(manifest.records.filter(r=>r.file).map(r=>r.token)),new Set(detailRecordingTokens));
  for(const pinyin of ['e','bo','wai'])assert.equal(detailRecording(pinyin,3,'full'),undefined);
  assert.equal(detailRecording('a',2,'full'),undefined);
});

test('every shared recording preserves its pinned source, metadata and credits through the build',async()=>{
  const {source}=manifest;
  assert.equal(manifest.schemaVersion,1);
  assert.equal(source.revision,'59dbafbda8b172ffc3b8b295cd5938ae1b3de803');
  assert.equal(source.speaker,'Chen Wang 王琛');
  assert.equal(source.author,'Wang Chen, Lopez Hugo, Vion Nicolas');
  assert.equal(source.license,'CC BY-SA 3.0');
  assert.equal(source.licenseUrl,'https://creativecommons.org/licenses/by-sa/3.0/');
  const page=await readFile(new URL('credits.html',folder),'utf8');
  for(const text of [source.speaker,source.author,source.licenseUrl])assert.ok(page.includes(text));
  const records=manifest.records.filter(r=>r.file);
  assert.deepEqual((await readdir(folder)).filter(f=>f.endsWith('.mp3')).sort(),records.map(r=>r.file).sort());
  assert.deepEqual(records.filter(r=>r.metadataNote).map(r=>r.token),['peng3']);
  for(const r of records){
    assert.ok(r.file&&r.sourceToken&&r.sha256&&r.bytes&&r.duration);
    const {text,tone}=parseQuery(r.token);assert.ok(tone);
    assert.equal(r.file,r.token.replaceAll('ü','v')+'.mp3');
    assert.equal(r.sourceToken,r.token==='ju4'?'jv4':r.token.replaceAll('ü','v'));
    assert.equal(detailRecording(text,tone,'full'),'audio/syllables/'+r.file);
    const data=await readFile(new URL(r.file,folder));
    assert.equal(data.length,r.bytes,r.token);
    assert.equal(createHash('sha256').update(data).digest('hex'),r.sha256,r.token);
    assert.deepEqual(await readFile(new URL('dist/audio/syllables/'+r.file,root)),data);
    const tags=data.toString('utf8');
    if(r.metadataNote)assert.equal(tags.includes('SWAC_'),false);
    else for(const tag of ['SWAC_TEXT\0'+r.sourceToken+'\0','SWAC_LANG\0cmn\0','SWAC_COLL_LICENSE\0'+source.licenseTag+'\0','SWAC_SPEAK_NAME\0'+source.speaker+'\0'])assert.ok(tags.includes(tag),r.token);
    assert.ok(page.includes(`https://github.com/hugolpz/audio-cmn/blob/${source.revision}/${source.directory}/cmn-${r.sourceToken}.mp3`));
  }
});

test('all 15 comparisons reuse the same 27 first-tone files as detail playback',()=>{
  const tokens=new Set(comparisonPresets.flatMap(p=>p.syllables.map(s=>s+'1')));
  assert.equal(comparisonPresets.length,15);assert.equal(tokens.size,27);
  assert.deepEqual(new Set(comparisonRecordingTokens),tokens);
  for(const token of tokens){const pinyin=token.slice(0,-1);assert.ok(comparisonRecording(pinyin,1));assert.equal(comparisonRecording(pinyin,1),detailRecording(pinyin,1,'full'));}
  for(const p of comparisonPresets)assert.equal(comparisonSequence(p.syllables,1,'alternate')?.length,p.syllables.length*2);
  assert.equal(comparisonRecording('si',2),undefined);
  assert.equal(comparisonSequence(['si','ê'],1,'alternate'),undefined);
  assert.equal(comparisonSequence(['si','shi'],1,'C'),undefined);
  assert.equal(comparisonSequence(['si','shi'],1,'unknown'),undefined);
});

test('all recorded targets play without a catalog and never substitute for contextual tones',()=>{
  for(const token of detailRecordingTokens){
    const {text,tone}=parseQuery(token);assert.ok(tone);
    for(const status of ['loading','error','ready'] as const){
      const p=resolveDetailPlayback({selected:text,tone,thirdToneForm:'full'},undefined,status);
      assert.equal(p.kind,'recording',token);assert.equal(p.contextual,false);
    }
    assert.equal(detailRecording(text,3,'half'),undefined);
    assert.equal(detailRecording(text,3,'sandhi'),undefined);
    assert.equal(detailRecording(text,5,'full'),undefined);
  }
  for(const [selected,tone] of [['yo',1],['ê',1],['bo',3],['a',2]] as const){
    const p=resolveDetailPlayback({selected,tone,thirdToneForm:'full'},catalog,'ready');
    assert.equal(p.kind,'unavailable');
    if(p.kind==='unavailable')assert.equal(p.reason,selected==='yo'?'recording-missing':'reading-unreviewed');
  }
  for(const form of ['half','sandhi'] as const){
    const state={selected:'hao',tone:3 as const,thirdToneForm:form};
    const p=resolveDetailPlayback(state,catalog,'ready');
    assert.equal(p.kind,'speech');assert.equal(p.contextual,true);
    assert.equal(resolveDetailPlayback(state,undefined,'error').kind,'unavailable');
  }
});
