import {resolveDetailPlayback} from '../src/detail-playback.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {neutralToneExamples} from '../src/neutral-tone.js';
import {comparisonSyllableTokens, comparisonRecordingTokens, comparisonRecording} from '../src/comparison-recordings.js';
import {comparisonAudioHint, comparisonPresets, comparisonSequence} from '../src/comparison.js';
import {markTone, parseQuery, syllables} from '../src/data.js';
import {detailRecordingTokens, detailRecording} from '../src/detail-recordings.js';
import {parseExampleCatalog, detailExample} from '../src/examples.js';
import type {PronunciationExample} from '../src/types.js';

test('the four neutral-tone guide recordings retain their original files and attribution', async () => {
  const root = new URL('../../', import.meta.url);
  const credits: {file:string;word:string;sha256:string;author:string;licenseUrl:string;sourcePage:string}[] = JSON.parse(await readFile(new URL('public/audio/neutral/credits.json', root), 'utf8'));
  assert.equal(neutralToneExamples.length, 4);
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
interface Recording {
  token:string; sourceToken?:string; file?:string; sha256?:string; bytes?:number; duration?:number;
  unavailable?:string; metadataNote?:string; retrieved?:string;
  sourceId?:string; sourceFile?:string; sourceText?:string; sourcePinyin?:string;
  sourceMetadata?:Record<string,string>;
  ttsFallback?:PronunciationExample;
}
interface CollectionSource {
  kind:string; speaker:string; author:string; license:string; licenseUrl:string;
  sourcePage:string; indexUrl:string; downloadBaseUrl:string; metadataSpeaker:string; metadataLicense:string;
}
const manifest: {schemaVersion:number;source:{revision:string;directory:string;speaker:string;author:string;license:string;licenseTag:string;licenseUrl:string};additionalSources:Record<string,CollectionSource>;records:Recording[]} = JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
const catalog=parseExampleCatalog(JSON.parse(await readFile(new URL('public/examples.json',root),'utf8')));

test('the adopted scope includes 48 reviewed third tones, with yo1 explicitly unavailable',()=>{
  const expected=new Set<string>();
  for(const s of syllables)for(const tone of [1,2,3,4] as const)if(detailExample(s.pinyin,tone,'full',catalog))expected.add(s.pinyin+tone);
  assert.equal(expected.size,1210);
  assert.equal(manifest.records.length,1210);
  assert.deepEqual(new Set(manifest.records.map(r=>r.token)),expected);
  assert.equal(detailRecordingTokens.length,1190);
  assert.equal(manifest.records.filter(r=>r.unavailable).length,20);
  assert.deepEqual(manifest.records.filter(r=>r.unavailable&&!r.ttsFallback).map(r=>r.token),['yo1']);
  assert.deepEqual(new Set(manifest.records.filter(r=>r.file).map(r=>r.token)),new Set(detailRecordingTokens));
  const additions=manifest.records.filter(r=>r.retrieved==='2026-11-06');
  assert.equal(additions.length,48);
  for(const r of additions){
    assert.ok(r.token.endsWith('3'));
    assert.ok(catalog.isolatedExamples[r.token]?.note,r.token);
    assert.equal(detailRecording(r.token.slice(0,-1),3,'full'),'audio/syllables/'+r.file);
  }
  for(const pinyin of ['e','bo','wai'])assert.ok(detailRecording(pinyin,3,'full'));
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
    assert.ok(r.file&&r.sha256&&r.bytes&&r.duration);
    const {text,tone}=parseQuery(r.token);assert.ok(tone);
    assert.equal(r.file,r.token.replaceAll('ü','v')+'.mp3');
    assert.equal(detailRecording(text,tone,'full'),'audio/syllables/'+r.file);
    const data=await readFile(new URL(r.file,folder));
    assert.equal(data.length,r.bytes,r.token);
    assert.equal(createHash('sha256').update(data).digest('hex'),r.sha256,r.token);
    assert.deepEqual(await readFile(new URL('dist/audio/syllables/'+r.file,root)),data);
    if(r.sourceId){
      const collection=manifest.additionalSources[r.sourceId];
      assert.ok(collection);
      assert.equal(collection.kind,'shtooka');
      assert.ok(r.sourceFile&&r.sourceText&&r.sourcePinyin&&r.sourceMetadata);
      assert.equal(r.sourceToken,undefined);
      assert.equal(r.sourcePinyin,markTone(text,tone));
      assert.deepEqual(r.sourceMetadata,{
        swac_text:r.sourceText,swac_pron_phon:r.sourcePinyin,swac_lang:'cmn',
        swac_speak_name:collection.metadataSpeaker,swac_coll_license:collection.metadataLicense,
      });
      for(const text of [collection.speaker,collection.author,collection.licenseUrl,collection.sourcePage,collection.indexUrl,collection.downloadBaseUrl+r.sourceFile])assert.ok(page.includes(text),r.token);
      continue;
    }
    assert.equal(r.sourceToken,r.token==='ju4'?'jv4':r.token.replaceAll('ü','v'));
    const tags=data.toString('utf8');
    if(r.metadataNote)assert.equal(tags.includes('SWAC_'),false);
    else for(const tag of ['SWAC_TEXT\0'+r.sourceToken+'\0','SWAC_LANG\0cmn\0','SWAC_COLL_LICENSE\0'+source.licenseTag+'\0','SWAC_SPEAK_NAME\0'+source.speaker+'\0'])assert.ok(tags.includes(tag),r.token);
    assert.ok(page.includes(`https://github.com/hugolpz/audio-cmn/blob/${source.revision}/${source.directory}/cmn-${r.sourceToken}.mp3`));
  }
});

test('only the 64 accepted replacements use the reviewed collection sources and explicit file choices',()=>{
  const expected = [
    ...'bu4 guo4 bang4 guai4 bie1 dan4 da4 fen1 kang4 ti4 bo1 ceng2 ding1 fa2 gang1 huo2 jie4 na4 nen4 nie1 pao1 zha1 zhong4 zhu4 dai4 er4 fan1 kuang4 bi4 dian4 kuo4 ma2 mai4 yue1'.split(' '),
    ...'ceng4 cuo4 gong1 hu2 jiang4 jiao1 lang4 lei1 mao2 men4 mi2 mian4 nong4 o4 piao1 qin1 re4 san1 shou1 ti1 tian2 tu4 yao1 ying4 zhao4 zhe4 zheng1 zhi4 zhuang4'.split(' '),
    'yin1',
  ].sort();
  const replacements=manifest.records.filter(r=>r.sourceId);
  assert.deepEqual(replacements.map(r=>r.token).sort(),expected);
  assert.equal(replacements.filter(r=>r.sourceId==='cmn-caen-tan').length,51);
  assert.equal(replacements.filter(r=>r.sourceId==='cmn-balm-hsk1').length,13);
  assert.equal(replacements.find(r=>r.token==='san1')?.sourceFile,'cmn-76ccfc6b.mp3');
  assert.equal(replacements.find(r=>r.token==='o4')?.sourceFile,'cmn-35b1145d.mp3');
  assert.equal(replacements.find(r=>r.token==='yin1')?.sourceFile,'cmn-140b3b60.mp3');
  for(const r of replacements)assert.equal(r.retrieved,'2026-11-17');
  for(const token of comparisonRecordingTokens)assert.equal(manifest.records.find(r=>r.token===token)?.sourceId,token==='yin1'?'cmn-caen-tan':undefined);
});

test('all 15 comparisons reuse 26 recordings and the explicit ben TTS example',()=>{
  const tokens=new Set(comparisonPresets.flatMap(p=>p.syllables.map(s=>s+'1')));
  assert.equal(comparisonPresets.length,15);assert.equal(tokens.size,27);
  assert.deepEqual(new Set(comparisonSyllableTokens),tokens);
  assert.equal(comparisonRecordingTokens.length,26);
  for(const token of comparisonRecordingTokens){const pinyin=token.slice(0,-1);assert.ok(comparisonRecording(pinyin,1));assert.equal(comparisonRecording(pinyin,1),detailRecording(pinyin,1,'full'));}
  assert.equal(comparisonRecording('ben',1),undefined);
  assert.deepEqual(comparisonSequence(['ben','beng'],1,'alternate'),[
    {text:'奔',label:'A · bēn'},{url:'audio/syllables/beng1.mp3',label:'B · bēng'},
    {text:'奔',label:'A · bēn'},{url:'audio/syllables/beng1.mp3',label:'B · bēng'},
  ]);
  assert.equal(comparisonRecording('yin',1),'audio/syllables/yin1.mp3');
  assert.equal(comparisonAudioHint({speech:true,recording:true},['yin','ying'],1),'話者の録音を元の速度で再生します。');
  assert.equal(comparisonAudioHint({speech:true,recording:true},['ben','beng'],1),'bēn はTTS、bēng は録音で再生します。');
  assert.deepEqual(comparisonSequence(['yin','ying'],1,'alternate'),[
    {url:'audio/syllables/yin1.mp3',label:'A · yīn'},{url:'audio/syllables/ying1.mp3',label:'B · yīng'},
    {url:'audio/syllables/yin1.mp3',label:'A · yīn'},{url:'audio/syllables/ying1.mp3',label:'B · yīng'},
  ]);
  for(const p of comparisonPresets)assert.equal(comparisonSequence(p.syllables,1,'alternate')?.length,p.syllables.length*2);
  assert.equal(comparisonRecording('si',2),undefined);
  assert.equal(comparisonSequence(['si','ê'],1,'alternate'),undefined);
  assert.equal(comparisonSequence(['si','shi'],1,'C'),undefined);
  assert.equal(comparisonSequence(['si','shi'],1,'unknown'),undefined);
});

test('the 19 targets without accepted replacements use their catalog TTS examples even without the catalog',async()=>{
  const rejected=manifest.records.filter(r=>r.ttsFallback);
  const expected = [
    'fa4', 'o1', 'sen1', 'feng4', 'ka1', 'meng1', 'ben1', 'jue4', 'e1', 'miu4',
    'bo2', 'heng4', 'kan1', 'nu2', 'nüe4', 'rui2', 'zan1', 'zeng4', 'zhu2',
  ];
  assert.deepEqual(rejected.map(r=>r.token).sort(),expected.sort());
  for(const r of rejected){
    const {text,tone}=parseQuery(r.token);assert.ok(tone);
    const example=r.ttsFallback;assert.ok(example);
    assert.deepEqual(example,catalog.isolatedExamples[r.token]?.text===example.text?catalog.isolatedExamples[r.token]:catalog.contextualExamples[r.token]);
    assert.equal(detailRecording(text,tone,'full'),undefined);
    for(const prefix of ['public','dist'])assert.equal((await readdir(new URL(`${prefix}/audio/syllables/`,root))).includes(r.token.replaceAll('ü','v')+'.mp3'),false);
    for(const status of ['ready','loading','error'] as const){
      const p=resolveDetailPlayback({selected:text,tone,thirdToneForm:'full'},status==='ready'?catalog:undefined,status);
      assert.deepEqual(p,{kind:'speech',text:example.text,example,contextual:example.tokens.length>1});
    }
  }
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
  for(const [selected,tone] of [['yo',1],['ê',1],['eng',3],['a',2]] as const){
    const p=resolveDetailPlayback({selected,tone,thirdToneForm:'full'},catalog,'ready');
    assert.equal(p.kind,'unavailable');
    if(p.kind==='unavailable')assert.equal(p.reason,selected==='yo'?'recording-missing':'reading-unreviewed');
  }
  for(const form of ['half','sandhi'] as const){
    const state={selected:'hao',tone:3 as const,thirdToneForm:form};
    const p=resolveDetailPlayback(state,catalog,'ready');
    assert.equal(p.kind,'recording');assert.equal(p.contextual,true);
    if(p.kind==='recording')assert.equal(p.url,form==='half'?'audio/third-tone/haochi.mp3':'audio/third-tone/hao3-sandhi.mp3');
    assert.equal(resolveDetailPlayback(state,undefined,'error').kind,'unavailable');
  }
});
