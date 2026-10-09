import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initials,finals,syllables,syllableMap,spell,markTone,parseQuery,findSyllables,rulesFor,getSyllable,getInitial} from '../src/data.js';
import {articulationFor,articulationTerms,aspirationPairs} from '../src/articulation.js';
import {parseExampleCatalog} from '../src/examples.js';
import {required} from '../src/types.js';
import {initialSections,finalSections,orderedFinals,matrixFinals,matrixFinalId} from '../src/layout.js';
const {examples,meta}=parseExampleCatalog(JSON.parse(await readFile(new URL('../../public/examples.json',import.meta.url),'utf8')));

test('inventory is unique and every cell references a known initial and final',()=>{
  assert.equal(initials.length,22);assert.equal(finals.length,40);assert.equal(syllables.length,413);
  assert.equal(new Set(syllables.map(s=>s.pinyin)).size,413);
  assert.equal(new Set(syllables.map(s=>s.initial+'|'+s.final)).size,413);
  for(const s of syllables){assert.ok(initials.some(i=>i.id===s.initial));assert.ok(finals.some(f=>f.id===s.final));assert.ok(s.ipa);}
});

test('display sections partition every initial and final once and begin with the common six vowels',()=>{
  const initialIds=initialSections.flatMap(section=>section.initials);
  assert.deepEqual(initialIds,initials.map(initial=>initial.id));
  const finalIds=finalSections.flatMap(section=>section.finals);
  assert.equal(finalIds.length,40);
  assert.deepEqual([...new Set(finalIds)].sort(),finals.map(final=>final.id).sort());
  assert.deepEqual(finalSections.map(section=>[section.id,section.finals.length]),[['simple',10],['compound',13],['nasal-n',8],['nasal-ng',8],['extra',1]]);
  assert.deepEqual(matrixFinals.slice(0,6).map(final=>final.id),['a','o','e','i','u','ü']);
  assert.deepEqual(orderedFinals.slice(10,18).map(final=>final.id),['ai','ei','uei','ao','ou','iou','ie','üe']);
});
test('orthographic fixtures cover dots, contractions and zero initials',()=>{
  const fixtures=[['x','üan','xuan'],['j','ün','jun'],['d','uen','dun'],['l','iou','liu'],['g','uei','gui'],['n','ü','nü'],['l','üe','lüe'],['','üan','yuan'],['','ün','yun'],['','i','yi'],['','iou','you'],['','uen','wen'],['','ueng','weng'],['','u','wu'],['','iong','yong']] as const;
  for(const [i,f,s] of fixtures)assert.equal(spell(i,f),s);
});
test('merging the i display column preserves every analytical final and creates no cell collisions',()=>{
  assert.equal(matrixFinals.length,38);
  const ids=matrixFinals.flatMap(column=>column.variants.map(final=>final.id));
  assert.deepEqual(ids.sort(),finals.map(final=>final.id).sort());
  assert.equal(new Set(syllables.map(s=>`${s.initial}|${matrixFinalId(s.final)}`)).size,syllables.length);
});
test('forbidden combinations never appear; contrasting finals stay distinct',()=>{
  for(const s of ['jua','jiou','bong','fian','biang','nüan','shong','ong','wun','juen'])assert.ok(!syllableMap.has(s),s);
  assert.equal(getSyllable('jun').final,'ün');assert.equal(getSyllable('dun').final,'uen');
  assert.equal(getSyllable('yuan').initial,'');assert.equal(getSyllable('xuan').ipa,'ɕɥɛn');
  assert.equal(getSyllable('zi').ipa,'tsɹ̩');assert.equal(getSyllable('zhi').ipa,'ʈʂɻ̩');assert.equal(getSyllable('ri').ipa,'ɻ̩');
  assert.match(rulesFor(getSyllable('jun')).join(' '),/ü → u/);
});
test('tone placement fixtures and keyboard aliases',()=>{
  for(const [s,t,result] of [['liu',4,'liù'],['gui',4,'guì'],['shui',3,'shuǐ'],['xuan',3,'xuǎn'],['lüe',4,'lüè'],['nü',3,'nǚ'],['ou',3,'ǒu'],['you',3,'yǒu'],['ma',5,'ma']] as const)assert.equal(markTone(s,t),result);
  assert.deepEqual(parseQuery(' NU:3 '),{text:'nü',tone:3});assert.deepEqual(parseQuery('nv3'),{text:'nü',tone:3});
  assert.deepEqual(parseQuery('ma0'),{text:'ma',tone:5});assert.deepEqual(parseQuery('NǙ'),{text:'nü',tone:3});
  assert.notEqual(parseQuery('ê').text,parseQuery('e').text);
});
test('every tone-marked inventory item round-trips without losing ü or ê',()=>{
  for(const s of syllables)for(const tone of [1,2,3,4] as const)assert.deepEqual(parseQuery(markTone(s.pinyin,tone)),{text:s.pinyin,tone},s.pinyin+tone);
});
test('search respects tones, IPA, final groups and exclusions',()=>{
  assert.ok(findSyllables('nǚ').some(s=>s.pinyin==='nü'));
  assert.ok(findSyllables('ɕ').every(s=>s.ipa.includes('ɕ')));
  assert.deepEqual(findSyllables('üan').map(s=>s.pinyin),['yuan','juan','quan','xuan']);
  assert.ok(findSyllables('',{group:'ü',initial:'j'}).every(s=>s.initial==='j'&&s.final.startsWith('ü')));
  assert.equal(findSyllables('not-a-syllable').length,0);
  assert.equal(findSyllables('chua',{rare:false}).some(s=>s.pinyin==='chua'),false);
});

test('exact pinyin ranks first while filters and partial matches still apply',()=>{
  for(const s of syllables)for(const query of [s.pinyin,s.pinyin+'3',markTone(s.pinyin,3)]){
    assert.equal(findSyllables(query)[0]?.pinyin,s.pinyin,query);
  }
  assert.ok(findSyllables('pa').some(s=>s.pinyin==='ba'));
  assert.equal(findSyllables('pa',{initial:'b'})[0]?.pinyin,'ba');
  assert.equal(findSyllables('pa',{initial:'x'}).length,0);
  assert.equal(findSyllables('chua',{rare:false}).some(s=>s.pinyin==='chua'),false);
});

test('the labial o explanation is limited to bo, po, mo and fo',()=>{
  for(const pinyin of ['bo','po','mo','fo'])assert.match(rulesFor(getSyllable(pinyin)).join(' '),/\[wo\]/);
  for(const pinyin of ['lo','o'])assert.doesNotMatch(rulesFor(getSyllable(pinyin)).join(' '),/bo \/ po \/ mo \/ fo/);
  assert.equal(getSyllable('lo').ipa,'lo');
});

test('articulation search distinguishes place, aspiration and voicing',()=>{
  for(const [query,expected] of [
    ['唇音',['b','p','m','f']], ['唇歯音',['f']], ['鼻音',['m','n']],
    ['無気音',['b','d','g','j','zh','z']], ['有気音',['p','t','k','q','ch','c']],
    ['有声音',['m','n','l','r']], ['捲舌音',['zh','ch','sh','r']],
    ['双唇音',['b','p','m']], ['舌尖音',['d','t','n','l']], ['舌尖中音',['d','t','n','l']],
    ['舌根音',['g','k','h']], ['軟口蓋音',['g','k','h']], ['舌面後音',['g','k','h']],
    ['舌面音',['j','q','x']], ['歯茎硬口蓋音',['j','q','x']], ['舌面前音',['j','q','x']],
    ['舌歯音',['z','c','s']], ['舌尖前音',['z','c','s']], ['平舌音',['z','c','s']],
    ['歯茎音',['d','t','n','l','z','c','s']], ['舌尖後音',['zh','ch','sh','r']],
  ] as const){
    assert.deepEqual([...new Set(findSyllables(query).map(s=>s.initial))],expected,query);
  }
  assert.ok(findSyllables('唇音',{initial:'p'}).every(s=>s.initial==='p'));
  assert.equal(findSyllables('有気音',{initial:'b'}).length,0);
});

test('aspiration pairs share place, manner and voicelessness; other manners have no aspiration label',()=>{
  for(const [a,b,sa,sb] of aspirationPairs){
    const unaspirated=required(articulationFor(a),a),aspirated=required(articulationFor(b),b);
    assert.equal(unaspirated.place,aspirated.place);
    assert.equal(unaspirated.manner,aspirated.manner);
    assert.equal(unaspirated.voicing,'voiceless');assert.equal(aspirated.voicing,'voiceless');
    assert.equal(unaspirated.aspiration,'unaspirated');assert.equal(aspirated.aspiration,'aspirated');
    assert.equal(getInitial(b).ipa,getInitial(a).ipa+'ʰ');
    assert.equal(getSyllable(sa).initial,a);assert.equal(getSyllable(sb).initial,b);
  }
  for(const initial of initials.filter(i=>i.id)){
    const profile=required(articulationFor(initial.id),initial.id);
    if(!['plosive','affricate'].includes(profile.manner))assert.equal(profile.aspiration,null,initial.id);
  }
  assert.equal(articulationFor(''),undefined);assert.deepEqual(articulationTerms(''),[]);
});
test('examples align text, numbered pinyin and target; neutral tones always have context',()=>{
  assert.equal(meta.license,'CC BY-SA 4.0');assert.match(meta.sha256,/^[a-f0-9]{64}$/);
  for(const [key,e] of Object.entries(examples)){
    assert.ok(e);
    assert.equal([...e.text].length,e.tokens.length,key);assert.equal(e.tokens[e.target],key);
    assert.ok(e.tokens.every(t=>/^[a-züê]+[1-5]$/.test(t)),key);
    if(key.endsWith('5'))assert.ok(e.tokens.length>1,key);
  }
  for(const s of syllables.filter(s=>!s.peripheral))assert.ok([1,2,3,4,5].some(t=>examples[s.pinyin+t]),s.pinyin);
  assert.equal(required(examples.ma5,'ma5').text,'妈妈');assert.equal(required(examples.ma5,'ma5').target,1);assert.equal(examples.xuan5,undefined);
});
