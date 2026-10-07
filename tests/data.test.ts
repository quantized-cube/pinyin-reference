import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initials,finals,syllables,syllableMap,spell,markTone,parseQuery,findSyllables,rulesFor,getSyllable} from '../src/data.js';
import {parseExampleCatalog} from '../src/examples.js';
import {required} from '../src/types.js';
const {examples,meta}=parseExampleCatalog(JSON.parse(await readFile(new URL('../../public/examples.json',import.meta.url),'utf8')));

test('inventory is unique and every cell references a known initial and final',()=>{
  assert.equal(initials.length,22);assert.equal(finals.length,40);assert.equal(syllables.length,413);
  assert.equal(new Set(syllables.map(s=>s.pinyin)).size,413);
  assert.equal(new Set(syllables.map(s=>s.initial+'|'+s.final)).size,413);
  for(const s of syllables){assert.ok(initials.some(i=>i.id===s.initial));assert.ok(finals.some(f=>f.id===s.final));assert.ok(s.ipa);}
});
test('orthographic fixtures cover dots, contractions and zero initials',()=>{
  const fixtures=[['x','üan','xuan'],['j','ün','jun'],['d','uen','dun'],['l','iou','liu'],['g','uei','gui'],['n','ü','nü'],['l','üe','lüe'],['','üan','yuan'],['','ün','yun'],['','i','yi'],['','iou','you'],['','uen','wen'],['','ueng','weng'],['','u','wu'],['','iong','yong']] as const;
  for(const [i,f,s] of fixtures)assert.equal(spell(i,f),s);
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
