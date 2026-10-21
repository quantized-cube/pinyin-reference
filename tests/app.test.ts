import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { required } from '../src/types.js';
import { parseExampleCatalog } from '../src/examples.js';

const html = await readFile(new URL('../../public/index.html', import.meta.url), 'utf8');
const catalog: unknown = JSON.parse(await readFile(new URL('../../public/examples.json', import.meta.url), 'utf8'));
const local: SpeechSynthesisVoice = {
  voiceURI: 'local', name: 'Local Mandarin', lang: 'zh-CN', localService: true, default: true,
};
const preferred: SpeechSynthesisVoice = {
  ...local, voiceURI: 'preferred', name: 'Online Mandarin', localService: false, default: false,
};
class Utterance {
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(readonly text: string) {}
}

interface ExampleResponse {ok: boolean; status?: number; json: () => Promise<unknown>}
async function setup(t: TestContext, initialVoices = [local], options: {
  mobile?: boolean; storedIpa?: string; hash?: string; fetchExamples?: () => Promise<ExampleResponse>;
  speechSupported?: boolean; recordingsSupported?: boolean;
} = {}) {
  const errors: unknown[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  // No resource loading or embedded scripts: only local built modules are evaluated.
  const dom = new JSDOM(html, { url: 'https://pinyin.test/'+(options.hash??''), runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  t.after(() => { window.close(); assert.deepEqual(errors, []); });
  let voices = initialVoices;
  let cancellations = 0;
  const requests: Utterance[] = [];
  const recordings: RecordedAudio[] = [];
  const recordingPlays: {src: string; rate: number}[] = [];
  let rejectRecording = false;
  class RecordedAudio {
    playbackRate = 1;
    paused = true;
    onplaying: (() => void) | null = null;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public src = '') { recordings.push(this); }
    play(): Promise<void> {
      recordingPlays.push({src:this.src,rate:this.playbackRate});
      if (rejectRecording) return Promise.reject(new Error('Playback blocked'));
      this.paused = false;
      return Promise.resolve();
    }
    pause(): void { this.paused = true; }
  }
  const synthesis = new window.EventTarget();
  Object.assign(synthesis, {
    getVoices: () => voices,
    cancel: () => { cancellations++; },
    speak: (utterance: Utterance) => requests.push(utterance),
  });
  Object.assign(window, {
    speechSynthesis: options.speechSupported===false?undefined:synthesis,
    SpeechSynthesisUtterance: Utterance,
    Audio: options.recordingsSupported===false?undefined:RecordedAudio,
    matchMedia: () => ({ matches: options.mobile??false }),
    fetch: async (url: string) => {
      assert.equal(url, 'examples.json?v=2');
      return options.fetchExamples ? options.fetchExamples() : { ok: true, json: async () => catalog };
    },
  });
  window.localStorage.setItem('pinyin.voice', preferred.voiceURI);
  if(options.storedIpa!==undefined)window.localStorage.setItem('pinyin.ipa',options.storedIpa);
  const context = dom.getInternalVMContext();
  const modules = new Map<string, Promise<SourceTextModule>>();
  function load(url: URL): Promise<SourceTextModule> {
    let module = modules.get(url.href);
    if (!module) {
      module = readFile(url, 'utf8').then(source => new SourceTextModule(source, { context, identifier: url.href }));
      modules.set(url.href, module);
    }
    return module;
  }
  const app = await load(new URL('../../dist/app.js', import.meta.url));
  await app.link((specifier, parent) => load(new URL(specifier, parent.identifier)));
  await app.evaluate();
  // Finish the local fetch/json promises before exercising the loaded screen.
  await new Promise<void>(resolve => setImmediate(resolve));
  const $ = <T extends Element = HTMLElement>(selector: string): T => required(window.document.querySelector<T>(selector), selector);
  const input = (query: string) => {
    $<HTMLInputElement>('#search').value = query;
    $('#search').dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const key = (selector: string, value: string) => $(selector).dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true }));
  const setVoices = (next: SpeechSynthesisVoice[], notify = true) => {
    voices = next;
    if (notify) synthesis.dispatchEvent(new window.Event('voiceschanged'));
  };
  return {
    $, input, key, setVoices, window,
    lastRequest: () => required(requests.at(-1), 'speech request'),
    requestCount: () => requests.length,
    cancellations: () => cancellations,
    lastRecording: () => required(recordings.at(-1), 'recording'),
    recordingPlays,
    recordingCount: () => recordings.length,
    blockRecordings: (blocked: boolean) => { rejectRecording = blocked; },
  };
}

test('search Enter keeps the exact pinyin instead of an earlier IPA substring match', async t => {
  const s = await setup(t);
  for (const [query, expected] of [['pa3', 'pǎ'], ['ta3', 'tǎ'], ['ka3', 'kǎ'], ['xu3', 'xǔ'], ['sa3', 'sǎ']]) {
    s.input(required(query, 'query'));
    assert.equal(s.$('#detail h2').textContent, expected);
    s.key('#search', 'Enter');
    assert.equal(s.$('#detail h2').textContent, expected);
  }
});

test('final search Enter uses visible cards without hidden matrix initial or rare filters', async t => {
  const s = await setup(t);
  s.$<HTMLSelectElement>('#initial-filter').value = 'b';
  s.$('#initial-filter').dispatchEvent(new s.window.Event('change', { bubbles: true }));
  s.$('#show-rare').click();
  s.$('[data-tab="finals"]').click();
  assert.equal(s.window.document.querySelector('#initial-filter'), null);
  assert.equal(s.window.document.querySelector('#show-rare'), null);
  for (const [query, pinyin, tone] of [['ün3', 'yun', '3'], ['ê2', 'ê', '2']] as const) {
    s.input(query);
    assert.equal(s.$('.sound-card').dataset.pick, pinyin);
    s.key('#search', 'Enter');
    assert.equal(new URLSearchParams(s.window.location.hash.slice(1)).get('s'), pinyin);
    assert.equal(s.$('.tone[aria-pressed="true"]').dataset.tone, tone);
  }
  s.input('');
  s.$('[data-tab="matrix"]').click();
  assert.equal(s.$<HTMLSelectElement>('#initial-filter').value, 'b');
  assert.equal(s.$<HTMLInputElement>('#show-rare').checked, false);
  s.input('ün');
  assert.equal(s.window.document.querySelector('[data-syllable]'), null);
  const before = s.window.location.hash;
  s.key('#search', 'Enter');
  assert.equal(s.window.location.hash, before);
});

test('initial search Enter uses the visible example despite hidden matrix and final filters', async t => {
  const s = await setup(t);
  s.$('[data-group="u"]').click();
  s.$<HTMLSelectElement>('#initial-filter').value = 'b';
  s.$('#initial-filter').dispatchEvent(new s.window.Event('change', { bubbles: true }));
  s.$('[data-tab="initials"]').click();
  s.input('x');
  assert.equal(s.$('.sound-card').dataset.pick, 'xi');
  s.key('#search', 'Enter');
  assert.equal(s.$('#detail h2').textContent, 'xī');
});

test('Enter with no visible list result does not select a match from another reference view', async t => {
  const s = await setup(t);
  s.$<HTMLSelectElement>('#search-mode').value = 'ipa';
  s.$('#search-mode').dispatchEvent(new s.window.Event('change', { bubbles: true }));
  for (const [tab, query] of [['initials', 'ɑŋ'], ['finals', 'p']] as const) {
    s.$(`[data-tab="${tab}"]`).click();
    s.input(query);
    assert.equal(s.window.document.querySelector('.sound-card'), null);
    const before = s.$('#detail h2').textContent;
    s.key('#search', 'Enter');
    assert.equal(s.$('#detail h2').textContent, before);
  }
});

test('marked rule examples select their displayed tones; unmarked examples retain the current tone', async t => {
  const s = await setup(t);
  s.$('[data-tab="rules"]').click();
  for (const label of ['liù', 'guì', 'nǚ']) {
    s.input('ma1');
    const button = required([...s.window.document.querySelectorAll<HTMLButtonElement>('.rule-examples button')]
      .find(item => item.textContent === label), label);
    button.click();
    assert.equal(s.$('#detail h2').textContent, label);
  }
  s.$('.quick-links [data-pick="liu"]').click();
  assert.equal(s.$('#detail h2').textContent, 'liǔ');
});

test('the saved voice returns after a partial voice list without a user selection', async t => {
  const s = await setup(t);
  assert.equal(s.$<HTMLSelectElement>('#voice').value, local.voiceURI);
  s.setVoices([local, preferred]);
  assert.equal(s.$<HTMLSelectElement>('#voice').value, preferred.voiceURI);
  assert.equal(s.window.localStorage.getItem('pinyin.voice'), preferred.voiceURI);
  s.$('#play').click();
  assert.equal(s.lastRequest().voice, preferred);
  s.lastRequest().onend?.();
});

test('neutral-tone recordings preserve their timing regardless of TTS settings and keep the selected syllable', async t => {
  const s = await setup(t, [local, preferred]);
  s.$<HTMLInputElement>('#rate').value = '0.75';
  s.$('#rate').dispatchEvent(new s.window.Event('input', {bubbles:true}));
  s.$('[data-tab="rules"]').click();
  const guide = s.$<HTMLDetailsElement>('.neutral-tone-guide');
  assert.equal(guide.open, false);
  s.$('.neutral-tone-guide>summary').click();
  assert.equal(guide.open, true);
  assert.match(guide.closest('.rule-card')?.querySelector('h3')?.textContent??'', /4つの声調と軽声/);
  assert.equal(s.$<HTMLDetailsElement>('.neutral-tone-notes').open, false);
  const before = s.window.location.hash;
  for (const [tone, word, file] of [[1,'妈妈','mama'],[2,'爷爷','yeye'],[3,'奶奶','nainai'],[4,'爸爸','baba']] as const) {
    const button = s.$<HTMLButtonElement>(`[data-neutral-tone-play="${tone}"]`);
    assert.equal(button.disabled, false);
    button.click();
    const recording = s.lastRecording();
    assert.equal(recording.src, `audio/neutral/${file}.mp3`);
    assert.equal(recording.playbackRate, 1);
    assert.equal(s.requestCount(), 0);
    recording.onplaying?.();
    assert.ok(s.$('#neutral-tone-status').textContent?.includes(word));
    recording.onended?.();
    assert.equal(s.window.location.hash, before);
    assert.equal(guide.open, true);
    assert.equal(s.$<HTMLDetailsElement>('.neutral-tone-notes').open, false);
  }
});

test('neutral-tone recordings work without TTS or a catalog and ignore stale events after errors and cancellation', async t => {
  const s = await setup(t, [], {speechSupported:false,fetchExamples:async()=>({ok:false,status:503,json:async()=>null})});
  s.$('[data-tab="rules"]').click();
  s.$('[data-neutral-tone-play="1"]').click();
  const first = s.lastRecording();
  first.onerror?.();
  assert.match(s.$('#neutral-tone-status').textContent??'', /録音を読み込めません/);
  assert.equal(s.$<HTMLDetailsElement>('#voice-help').open, false);
  s.$('[data-neutral-tone-play="2"]').click();
  const second = s.lastRecording();
  second.onplaying?.();
  first.onended?.();
  assert.ok(s.$('#neutral-tone-status').textContent?.includes('爷爷'));
  s.$('#neutral-tone-stop').click();
  assert.equal(second.paused, true);
  second.onended?.();
  assert.equal(s.$('#neutral-tone-status').textContent, '再生を停止しました。');
  s.$('[data-neutral-tone-play="3"]').click();
  const third = s.lastRecording();
  s.$('[data-tab="matrix"]').click();
  assert.equal(third.paused, true);
  third.onplaying?.();
  assert.doesNotMatch(s.$('#voice-status').textContent??'', /奶奶/);
  assert.equal(s.requestCount(), 0);
});

test('recording playback replaces TTS and recordings, handles rejected play promises and never falls back to TTS', async t => {
  const s = await setup(t);
  s.$('#play').click();
  const speech = s.lastRequest();
  s.$('[data-tab="rules"]').click();
  const beforeRecording = s.cancellations();
  s.$('[data-neutral-tone-play="1"]').click();
  assert.ok(s.cancellations()>beforeRecording);
  const first = s.lastRecording();
  s.$('[data-neutral-tone-play="2"]').click();
  const second = s.lastRecording();
  assert.equal(first.paused, true);
  second.onplaying?.();
  first.onended?.();
  speech.onstart?.();
  assert.ok(s.$('#neutral-tone-status').textContent?.includes('爷爷'));
  s.$('#play').click();
  assert.equal(second.paused, true);
  const beforeFailure = s.requestCount();
  s.blockRecordings(true);
  s.$('[data-neutral-tone-play="3"]').click();
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.match(s.$('#neutral-tone-status').textContent??'', /録音を再生できません/);
  assert.equal(s.$<HTMLDetailsElement>('#voice-help').open, false);
  assert.equal(s.requestCount(), beforeFailure);
  s.blockRecordings(false);
  s.$('[data-neutral-tone-play="4"]').click();
  s.lastRecording().onplaying?.();
  assert.ok(s.$('#neutral-tone-status').textContent?.includes('爸爸'));
  s.lastRecording().onended?.();
});

test('TTS and recording statuses stay in their own sections, including after voice refreshes and playback changes', async t => {
  const s = await setup(t);
  s.$('[data-tab="rules"]').click();
  const recordingHint = s.$('#neutral-tone-status').textContent;
  const speechHint = s.$('#voice-status').textContent;

  s.$('#play').click();
  s.lastRequest().onerror?.({error:'language-unavailable'});
  const speechError = s.$('#voice-status').textContent;
  assert.match(speechError??'', /普通話の音声を追加/);
  assert.equal(s.$('#neutral-tone-status').textContent, recordingHint);
  assert.equal(s.$<HTMLButtonElement>('[data-neutral-tone-play="1"]').disabled, false);
  s.setVoices([local]);
  assert.equal(s.$('#voice-status').textContent, speechError);
  assert.equal(s.$('#neutral-tone-status').textContent, recordingHint);

  s.$<HTMLDetailsElement>('#voice-help').open = false;
  s.$('[data-neutral-tone-play="1"]').click();
  s.lastRecording().onplaying?.();
  assert.match(s.$('#neutral-tone-status').textContent??'', /妈妈.*録音を再生中/);
  assert.equal(s.$('#voice-status').textContent, speechHint);
  s.lastRecording().onerror?.();
  const recordingError = s.$('#neutral-tone-status').textContent;
  assert.match(recordingError??'', /録音を読み込めません/);
  assert.equal(s.$('#voice-status').textContent, speechHint);
  assert.equal(s.$<HTMLDetailsElement>('#voice-help').open, false);
  s.window.dispatchEvent(new s.window.Event('focus'));
  assert.equal(s.$('#neutral-tone-status').textContent, recordingError);
  assert.equal(s.$('#voice-status').textContent, speechHint);

  s.$('#play').click();
  s.lastRequest().onstart?.();
  assert.match(s.$('#voice-status').textContent??'', /再生中/);
  assert.equal(s.$('#neutral-tone-status').textContent, recordingHint);
  s.lastRequest().onend?.();
});

test('a deliberate voice change replaces the saved choice even while another voice is loading', async t => {
  const alternative = { ...local, voiceURI: 'alternative', name: 'Alternative Mandarin' };
  const s = await setup(t, [local, alternative]);
  s.$<HTMLSelectElement>('#voice').value = alternative.voiceURI;
  s.$('#voice').dispatchEvent(new s.window.Event('change', { bubbles: true }));
  s.setVoices([local, alternative, preferred]);
  assert.equal(s.$<HTMLSelectElement>('#voice').value, alternative.voiceURI);
  assert.equal(s.window.localStorage.getItem('pinyin.voice'), alternative.voiceURI);
  s.$('#play').click();
  assert.equal(s.lastRequest().voice, alternative);
  s.lastRequest().onend?.();
});

test('a play tap restores a saved voice loaded without a voiceschanged event', async t => {
  const s = await setup(t);
  s.setVoices([local, preferred], false);
  s.$('#play').click();
  assert.equal(s.lastRequest().voice, preferred);
  assert.equal(s.$<HTMLSelectElement>('#voice').value, preferred.voiceURI);
  s.lastRequest().onend?.();
});

test('an empty voice list still permits Chinese playback and later restores the preferred voice', async t => {
  const s = await setup(t, []);
  assert.equal(s.$<HTMLButtonElement>('#play').disabled, false);
  s.$('#play').click();
  assert.equal(s.lastRequest().lang, 'zh-CN');
  assert.equal(s.lastRequest().voice, null);
  s.lastRequest().onend?.();
  s.setVoices([local]);
  s.setVoices([local, preferred]);
  assert.equal(s.$<HTMLSelectElement>('#voice').value, preferred.voiceURI);
});

test('Escape announces stopped playback, including from search, and ignores stale callbacks', async t => {
  const s = await setup(t);
  for (const target of ['body', '#search']) {
    s.input('hao3');
    s.$('#play').click();
    const request = s.lastRequest();
    request.onstart?.();
    assert.match(s.$('#voice-status').textContent ?? '', /再生中/);
    const before = s.cancellations();
    s.key(target, 'Escape');
    assert.ok(s.cancellations() > before);
    assert.equal(s.$('#voice-status').textContent, '再生を停止しました。');
    request.onerror?.({ error: 'interrupted' });
    request.onend?.();
    assert.equal(s.$('#voice-status').textContent, '再生を停止しました。');
    if (target === '#search') assert.equal(s.$<HTMLInputElement>('#search').value, '');
  }
});

test('matrix shows articulation row groups and final column groups without losing syllables', async t => {
  const s = await setup(t);
  const doc = s.window.document;
  assert.equal(doc.querySelectorAll('[data-syllable]').length,413);
  assert.deepEqual([...doc.querySelectorAll('[data-initial-section]')].map(el=>el.getAttribute('data-initial-section')),
    ['zero','labial','alveolar','velar','alveolopalatal','retroflex','sibilant']);
  assert.match(s.$('[data-initial-section="labial"] .initial-group-title').textContent ?? '',/唇音/);
  assert.match(s.$('[data-initial-section="velar"] .initial-group-title').textContent ?? '',/軟口蓋音/);
  assert.deepEqual([...doc.querySelectorAll('.final-heading th')].slice(0,6).map(el=>el.getAttribute('data-final')),['a','o','e','i','u','ü']);
  const spans=[...doc.querySelectorAll<HTMLTableCellElement>('.final-section-row th[scope="colgroup"]')].map(el=>el.colSpan);
  assert.deepEqual(spans,[8,13,8,8,1]);
  assert.equal(s.$<HTMLTableCellElement>('.initial-group-row th').colSpan,39);
  assert.match(s.$('.final-heading [data-final="uei"]').textContent ?? '',/uei \(ui\)/);
});

test('search and filters remove empty group headings and recompute column spans', async t => {
  const s = await setup(t);
  const doc = s.window.document;
  s.input('唇音');
  assert.equal(doc.querySelectorAll('[data-initial-section]').length,1);
  assert.equal(s.$('[data-initial-section]').getAttribute('data-initial-section'),'labial');
  s.input('üan');
  assert.equal(doc.querySelectorAll('[data-syllable]').length,4);
  assert.equal(doc.querySelectorAll('.final-heading th').length,1);
  assert.equal(s.$<HTMLTableCellElement>('.final-section-row th[scope="colgroup"]').colSpan,1);
  assert.match(s.$('.final-section-row th[scope="colgroup"]').textContent ?? '',/鼻韻母 · -n/);
  for (const header of doc.querySelectorAll<HTMLTableCellElement>('.initial-group-row th')) assert.equal(header.colSpan,2);
  s.input('');
  s.$<HTMLSelectElement>('#initial-filter').value='g';
  s.$('#initial-filter').dispatchEvent(new s.window.Event('change',{bubbles:true}));
  assert.equal(doc.querySelectorAll('[data-initial-section]').length,1);
  assert.equal(s.$('[data-initial-section]').getAttribute('data-initial-section'),'velar');
  s.input('not-a-syllable');
  assert.equal(doc.querySelectorAll('[data-initial-section]').length,0);
  assert.ok(s.$('.empty-state'));
});

test('keyboard movement crosses articulation headings and follows the reordered vowel columns', async t => {
  const s = await setup(t);
  s.$('[data-syllable="fa"]').focus();
  s.key('[data-syllable="fa"]','ArrowDown');
  assert.equal(s.window.document.activeElement?.getAttribute('data-syllable'),'da');
  s.key('[data-syllable="da"]','ArrowUp');
  assert.equal(s.window.document.activeElement?.getAttribute('data-syllable'),'fa');
  s.$('[data-syllable="bi"]').focus();
  s.key('[data-syllable="bi"]','ArrowRight');
  assert.equal(s.window.document.activeElement?.getAttribute('data-syllable'),'bu');
  s.key('[data-syllable="bu"]','Home');
  assert.equal(s.window.document.activeElement?.getAttribute('data-syllable'),'ba');
  s.$('[data-syllable="xi"]').focus();
  s.key('[data-syllable="xi"]','ArrowDown');
  assert.equal(s.window.document.activeElement?.getAttribute('data-syllable'),'zhi');
  s.$('[data-syllable="ri"]').focus();
  s.key('[data-syllable="ri"]','ArrowDown');
  assert.equal(s.window.document.activeElement?.getAttribute('data-syllable'),'zi');
  assert.equal(s.window.document.querySelectorAll('[data-syllable][tabindex="0"]').length,1);
});

test('textbook and phonetic names agree in matrix, initial cards, details and alias search', async t => {
  const s = await setup(t);
  for (const [section,query,label,sample,initials] of [
    ['alveolar','舌尖中音','舌尖音（歯茎音）','da',['d','t','n','l']],
    ['velar','舌根音','舌根音（軟口蓋音）','ga',['g','k','h']],
    ['alveolopalatal','舌面前音','舌面音（歯茎硬口蓋音）','ji',['j','q','x']],
    ['retroflex','捲舌音','そり舌音（舌尖後音）','zhi',['zh','ch','sh','r']],
    ['sibilant','舌歯音','舌歯音（歯茎音）','zi',['z','c','s']],
  ] as const) {
    s.$('[data-tab="matrix"]').click();
    s.input(query);
    assert.equal(s.window.document.querySelectorAll('[data-initial-section]').length,1);
    assert.equal(s.$('[data-initial-section]').getAttribute('data-initial-section'),section);
    assert.ok(s.$('.initial-group-title').textContent?.startsWith(label));
    s.$(`[data-syllable="${sample}"]`).click();
    assert.equal(s.$('.initial-articulation .articulation-badges>span').textContent,label);
    s.$('[data-tab="initials"]').click();
    const cards=[...s.window.document.querySelectorAll('.sound-card')];
    assert.deepEqual(cards.map(card=>card.querySelector('.card-symbol')?.textContent),initials);
    assert.ok(cards.every(card=>card.querySelector('.articulation-badges>span')?.textContent===label));
  }
  assert.match(s.$('.articulation-guide').textContent ?? '',/広い用法/);
  s.input('歯茎音');
  assert.deepEqual([...s.window.document.querySelectorAll('.sound-card .card-symbol')].map(el=>el.textContent),['d','t','n','l','z','c','s']);
});

test('final cards use the same teaching order and omit empty sections when filtered', async t => {
  const s = await setup(t);
  const expected=[...s.window.document.querySelectorAll('.final-heading th')].map(el=>el.getAttribute('data-final'));
  s.$('[data-tab="finals"]').click();
  const cardIds=[...s.window.document.querySelectorAll('.sound-card')].map(el=>el.getAttribute('data-final'));
  assert.equal(cardIds.length,40);
  assert.deepEqual(cardIds.filter(id=>id!=='-i(z)'&&id!=='-i(zh)'),expected);
  assert.equal(s.window.document.querySelectorAll('[data-final-section]').length,5);
  s.$('[data-group="ü"]').click();
  assert.deepEqual([...s.window.document.querySelectorAll('.sound-card')].map(el=>el.getAttribute('data-final')),['ü','üe','ün','üan']);
  assert.equal(s.window.document.querySelectorAll('[data-final-section]').length,3);
});

test('final cards group all simple finals, distinguish adjacent i sounds and explain supplemental yo', async t => {
  const s = await setup(t);
  s.$('[data-tab="finals"]').click();
  const ids=(section:string)=>[...s.window.document.querySelectorAll(`[data-final-section="${section}"] .sound-card`)]
    .map(el=>el.getAttribute('data-final'));
  assert.deepEqual(ids('simple'),['a','o','e','i','-i(z)','-i(zh)','u','ü','ê','er']);
  assert.deepEqual(ids('extra'),['io']);
  assert.match(s.$('[data-final-section="extra"] h3').textContent ?? '',/補足の音節/);
  for (const [id,label,pinyin,ipa] of [
    ['i','yi・mi系','yi','i'], ['-i(z)','zi系','zi','ɹ̩'], ['-i(zh)','zhi系','zhi','ɻ̩'],
  ]) {
    const card=s.$(`.sound-card[data-final="${id}"]`);
    assert.equal(card.querySelector('.card-symbol')?.textContent,'i');
    assert.equal(card.querySelector('.card-context')?.textContent,`（${label}）`);
    card.click();
    assert.equal(new URLSearchParams(s.window.location.hash.slice(1)).get('s'),pinyin);
    assert.equal(s.$('.decomposition>div:last-child .ipa').textContent,`[${ipa}]`);
  }
  const yo=s.$('.sound-card[data-final="io"]');
  assert.equal(yo.querySelector('.card-symbol')?.textContent,'yo');
  assert.match(yo.querySelector('.card-spelling')?.textContent ?? '',/分析上の韻母：io/);
  yo.click();
  assert.equal(new URLSearchParams(s.window.location.hash.slice(1)).get('s'),'yo');
  s.$('[data-group="special"]').click();
  assert.deepEqual(ids('simple'),['-i(z)','-i(zh)','ê','er']);
  assert.deepEqual(ids('extra'),['io']);
  s.input('ê');
  assert.deepEqual(ids('simple'),['ê']);
  assert.deepEqual(ids('extra'),[]);
  s.input('yo');
  assert.deepEqual(ids('simple'),[]);
  assert.deepEqual(ids('extra'),['io']);
});

test('one i header lists all three sounds while cells and details keep the correct pronunciation', async t => {
  const s = await setup(t);
  assert.equal(s.window.document.querySelectorAll('.final-heading th').length,38);
  assert.equal(s.$('.final-heading [data-final="i"] small').textContent,'[i / ɹ̩ / ɻ̩]');
  assert.equal(s.window.document.querySelectorAll('.final-heading [data-final^="-i"]').length,0);
  assert.equal(s.$<HTMLInputElement>('#show-ipa').checked,true);
  const column=s.$('[data-syllable="yi"]').getAttribute('data-col');
  for (const [pinyin,ipa,rime,context] of [
    ['yi','i','i',''], ['mi','mi','i',''], ['ji','tɕi','i',''],
    ['zi','tsɹ̩','ɹ̩','zi・ci・si 系'], ['ci','tsʰɹ̩','ɹ̩','zi・ci・si 系'], ['si','sɹ̩','ɹ̩','zi・ci・si 系'],
    ['zhi','ʈʂɻ̩','ɻ̩','zhi・chi・shi・ri 系'], ['chi','ʈʂʰɻ̩','ɻ̩','zhi・chi・shi・ri 系'],
    ['shi','ʂɻ̩','ɻ̩','zhi・chi・shi・ri 系'], ['ri','ɻ̩','ɻ̩','zhi・chi・shi・ri 系'],
  ] as const) {
    const cell=s.$(`[data-syllable="${pinyin}"]`);
    assert.equal(cell.getAttribute('data-col'),column);
    assert.ok(cell.parentElement?.getAttribute('headers')?.split(' ').includes('final-i'));
    assert.equal(cell.querySelector('.cell-ipa')?.textContent,`[${ipa}]`);
    cell.click();
    assert.equal(s.$('.decomposition>div:last-child strong').textContent,'i');
    assert.equal(s.$('.decomposition>div:last-child .ipa').textContent,`[${rime}]`);
    assert.ok(s.$('.decomposition>div:last-child').textContent?.includes(context));
  }
  s.$('#show-ipa').click();
  assert.equal(s.window.document.querySelectorAll('.cell-ipa').length,0);
  assert.equal(s.$('.final-heading [data-final="i"] small').textContent,'[i / ɹ̩ / ɻ̩]');
});

test('merged i searches and filters show only matching syllables without extra columns', async t => {
  const s = await setup(t);
  const shown=()=>[...s.window.document.querySelectorAll('[data-syllable]')].map(el=>el.getAttribute('data-syllable'));
  s.$<HTMLSelectElement>('#search-mode').value='ipa';
  s.$('#search-mode').dispatchEvent(new s.window.Event('change',{bubbles:true}));
  for (const [query,expected] of [['ɹ̩',['zi','ci','si']],['ɻ̩',['zhi','chi','shi','ri']]] as const) {
    s.input(query);
    assert.deepEqual(shown(),expected);
    assert.equal(s.window.document.querySelectorAll('.final-heading th').length,1);
    assert.equal(s.$('.final-heading th').getAttribute('data-final'),'i');
    assert.equal(s.$<HTMLTableCellElement>('.final-section-row th[scope="colgroup"]').colSpan,1);
  }
  s.input('');
  s.$('[data-group="special"]').click();
  assert.ok(shown().includes('zi')&&shown().includes('zhi'));
  assert.ok(!shown().includes('yi'));
  s.$('[data-group="i"]').click();
  assert.ok(shown().includes('yi'));
  assert.ok(!shown().includes('zi')&&!shown().includes('zhi'));
  s.$('[data-group="all"]').click();
  s.$<HTMLSelectElement>('#initial-filter').value='zh';
  s.$('#initial-filter').dispatchEvent(new s.window.Event('change',{bubbles:true}));
  assert.ok(shown().includes('zhi'));
  assert.ok(shown().every(pinyin=>pinyin?.startsWith('zh')));
});


test('search modes keep pinyin pa separate from IPA pa across matrix and cards', async t => {
  const s=await setup(t);
  s.input('pa');
  assert.ok(s.window.document.querySelector('[data-syllable="pa"]'));
  assert.equal(s.window.document.querySelector('[data-syllable="ba"]'),null);
  s.$<HTMLSelectElement>('#search-mode').value='ipa';
  s.$('#search-mode').dispatchEvent(new s.window.Event('change',{bubbles:true}));
  assert.ok(s.window.document.querySelector('[data-syllable="ba"]'));
  assert.equal(s.window.document.querySelector('[data-syllable="pa"]'),null);
  s.key('#search','Enter');
  assert.equal(s.$('#detail h2').textContent,'bā');
  s.$('[data-tab="initials"]').click();s.input('p');
  const picks=()=>[...s.window.document.querySelectorAll('.sound-card')].map(el=>el.getAttribute('data-pick'));
  assert.deepEqual(picks(),['ba','pa']);
  s.$<HTMLSelectElement>('#search-mode').value='pinyin';
  s.$('#search-mode').dispatchEvent(new s.window.Event('change',{bubbles:true}));
  assert.deepEqual(picks(),['pa']);
  s.$('[data-tab="finals"]').click();s.input('ɤ');
  assert.equal(s.window.document.querySelectorAll('.sound-card').length,0);
  s.$<HTMLSelectElement>('#search-mode').value='ipa';
  s.$('#search-mode').dispatchEvent(new s.window.Event('change',{bubbles:true}));
  assert.equal(s.$('.sound-card').getAttribute('data-final'),'e');
});

test('IPA starts on desktop, off on mobile, and the stored choice overrides both', async t => {
  for(const [mobile,storedIpa,expected] of [[false,undefined,true],[true,undefined,false],[false,'false',false],[true,'true',true]] as const){
    const s=await setup(t,[local],{mobile,storedIpa});
    assert.equal(s.$<HTMLInputElement>('#show-ipa').checked,expected);
    assert.equal(s.window.document.querySelectorAll('.cell-ipa').length,expected?413:0);
    s.$('#show-ipa').click();
    assert.equal(s.window.localStorage.getItem('pinyin.ipa'),String(!expected));
    s.$('[data-tab="finals"]').click();s.$('[data-tab="matrix"]').click();
    assert.equal(s.$<HTMLInputElement>('#show-ipa').checked,!expected);
  }
});

test('third tone starts collapsed, preserves an explicit selection and restores linked forms', async t => {
  const s=await setup(t);s.input('hao3');
  assert.equal(s.$<HTMLDetailsElement>('.third-tone-panel').open,false);
  assert.equal(s.window.document.querySelector('.example-realization'),null);
  s.$<HTMLDetailsElement>('.third-tone-panel').open=true;
  s.$('[data-third-tone-form="half"]').click();
  assert.equal(s.$<HTMLDetailsElement>('.third-tone-panel').open,true);
  assert.match(s.window.location.hash,/form=half/);
  assert.match(s.$('.detail-ipa').textContent??'',/˨˩/);
  s.$('[data-tab="rules"]').click();
  assert.equal(s.$<HTMLDetailsElement>('.third-tone-guide').open,false);
  const linked=await setup(t,[local],{hash:'#s=hao&t=3&form=sandhi'});
  assert.equal(linked.$<HTMLDetailsElement>('.third-tone-panel').open,true);
  assert.match(linked.$('.detail-ipa').textContent??'',/˧˥/);
});

test('fixed comparison presets play first-tone recordings and display the shared example characters', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  assert.equal(s.$<HTMLInputElement>('#search').disabled,true);
  assert.equal(s.window.document.querySelectorAll('[data-compare-preset]').length,15);
  assert.equal(s.window.document.querySelector('#reference-body select'),null);
  assert.match(s.$('#reference-body .section-heading').textContent??'',/第1声で聞き比べます/);
  const cases=[['an-ang','安','肮','an','ang'],['en-eng','奔','崩','ben','beng'],['ian-iang','先','香','xian','xiang'],['in-ing','音','英','yin','ying'],['uan-uang','关','光','guan','guang'],['uen-ueng','温','翁','wen','weng'],['b-p','八','趴','ba','pa'],['d-t','搭','他','da','ta'],['g-k','歌','科','ge','ke'],['j-q','鸡','七','ji','qi'],['zh-ch','知','吃','zhi','chi'],['z-c','资','疵','zi','ci']] as const;
  for(const [preset,a,b,first,second] of cases){
    s.$(`[data-compare-preset="${preset}"]`).click();
    for(const [side,text,pinyin] of [['A',a,first],['B',b,second]]){
      assert.equal(s.$<HTMLButtonElement>(`[data-compare-play="${side}"]`).disabled,false);
      assert.equal(s.$(`[data-side="${side}"] .compare-example`).textContent,text);
      s.$(`[data-compare-play="${side}"]`).click();
      assert.equal(s.lastRecording().src,`audio/comparison/${pinyin}1.mp3`);
      assert.equal(s.lastRecording().playbackRate,1);
      s.lastRecording().onended?.();
    }
  }
  assert.equal(s.requestCount(),0);
  s.$('[data-tab="matrix"]').click();assert.equal(s.$<HTMLInputElement>('#search').disabled,false);
});

test('three-sound presets show and play every example and return to a two-sound preset', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  const cases=[
    ['si-shi-xi',['思','诗','西']],
    ['zi-zhi-ji',['资','知','鸡']],
    ['ci-chi-qi',['疵','吃','七']],
  ] as const;
  for(const [preset,words] of cases){
    s.$(`[data-compare-preset="${preset}"]`).click();
    assert.equal(s.window.document.querySelectorAll('.compare-card').length,3);
    assert.equal(s.window.document.querySelector('#reference-body select'),null);
    assert.equal(s.$(`[data-compare-preset="${preset}"]`).getAttribute('aria-pressed'),'true');
    for(const [index,side] of ['A','B','C'].entries()){
      assert.equal(s.$(`[data-side="${side}"] .compare-example`).textContent,words[index]);
      assert.equal(s.$<HTMLButtonElement>(`[data-compare-play="${side}"]`).disabled,false);
      s.$(`[data-compare-play="${side}"]`).click();
      assert.equal(s.lastRecording().src,`audio/comparison/${preset.split('-')[index]}1.mp3`);
      s.lastRecording().onended?.();
    }
  }
  assert.equal(s.$('[data-side="A"] .compare-initial').textContent,'声母 c [tsʰ]');
  s.$('[data-side="C"] [data-pick]').click();
  assert.equal(s.$('#detail h2').textContent,'qī');
  s.$('[data-compare-preset="an-ang"]').click();
  assert.equal(s.window.document.querySelectorAll('.compare-card').length,2);
  assert.equal(s.window.document.querySelector('[data-side="C"]'),null);
  assert.equal(s.$('[data-compare-play="alternate"] small').textContent,'A → B → A → B');
});

test('recorded playback repeats each pair or triple twice at original speed on one audio element', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  for(const [preset,expected] of [['an-ang',['an','ang','an','ang']],['si-shi-xi',['si','shi','xi','si','shi','xi']]] as const){
    s.$(`[data-compare-preset="${preset}"]`).click();
    const start=s.recordingPlays.length, elements=s.recordingCount();
    s.$('[data-compare-play="alternate"]').click();
    for(const [index,pinyin] of expected.entries()){
      assert.equal(s.recordingPlays.length,start+index+1);
      const audio=s.lastRecording();
      assert.equal(audio.src,`audio/comparison/${pinyin}1.mp3`);
      assert.equal(audio.playbackRate,1);
      audio.onplaying?.();assert.match(s.$('#compare-status').textContent??'',/録音を再生中/);
      // Duplicate or late terminal callbacks from this item cannot skip the next sound.
      const ended=audio.onended, error=audio.onerror;
      ended?.();ended?.();error?.();
      await new Promise(resolve=>setTimeout(resolve,450));
      ended?.();error?.();
    }
    assert.equal(s.recordingCount(),elements+1);
    assert.equal(s.recordingPlays.length,start+expected.length);
    assert.equal(s.$('#compare-status').textContent,'再生しました。');
  }
  assert.equal(s.requestCount(),0);
});

test('changing fixed presets cancels queued playback across two- and three-sound comparisons', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  for(const preset of ['an-ang','zi-zhi-ji','ci-chi-qi']){
    s.$('[data-compare-preset="si-shi-xi"]').click();
    s.$('[data-compare-play="alternate"]').click();
    const first=s.lastRecording(), count=s.recordingPlays.length;
    first.onended?.(); // The next sound is queued, but must not play after a change.
    s.$(`[data-compare-preset="${preset}"]`).click();
    assert.equal(first.paused,true);
    first.onended?.();first.onerror?.();
    await new Promise(resolve=>setTimeout(resolve,450));
    assert.equal(s.recordingPlays.length,count);
    assert.doesNotMatch(s.$('#compare-status').textContent??'',/再生中|interrupted/);
    assert.equal(s.$(`[data-compare-preset="${preset}"]`).getAttribute('aria-pressed'),'true');
  }
});

test('detail tone changes do not alter the selected first-tone comparison', async t => {
  const s=await setup(t,[local],{hash:'#s=yan&t=3'});
  s.$('[data-tab="compare"]').click();
  s.$('[data-compare-preset="uan-uang"]').click();
  assert.equal(s.$('#detail h2').textContent,'yǎn');
  s.$('[data-side="A"] [data-pick]').click();
  assert.equal(s.$('#detail h2').textContent,'guān');
  s.$('[data-tone="3"]').click();
  assert.equal(s.$('#detail h2').textContent,'guǎn');
  s.$('[data-tab="matrix"]').click();
  s.$('[data-tab="compare"]').click();
  assert.equal(s.$('[data-compare-preset="uan-uang"]').getAttribute('aria-pressed'),'true');
  assert.equal(s.$('[data-side="A"] h3').textContent,'guān');
  assert.equal(s.$('[data-side="A"] .compare-ipa').textContent,'[kwan˥]');
  assert.match(s.$('#comparison-selection-note').textContent??'',/第1声/);
  s.$('[data-compare-play="A"]').click();
  assert.equal(s.lastRecording().src,'audio/comparison/guan1.mp3');
  s.lastRecording().onended?.();
});

test('a missing example character does not prevent playback of its first-tone recording', async t => {
  const parsed=parseExampleCatalog(catalog);
  const {xi1: removed,...isolatedExamples}=parsed.isolatedExamples;
  assert.ok(removed);
  assert.ok(isolatedExamples.xi2);
  const s=await setup(t,[local],{fetchExamples:async()=>({ok:true,json:async()=>({...parsed,isolatedExamples})})});
  s.$('[data-tab="compare"]').click();
  s.$('[data-compare-preset="si-shi-xi"]').click();
  s.setVoices([local,preferred]);
  for(const side of ['A','B','C','alternate'])assert.equal(s.$<HTMLButtonElement>(`[data-compare-play="${side}"]`).disabled,false);
  assert.match(s.$('[data-side="C"]').textContent??'',/例字は未収録/);
  s.$('[data-compare-play="alternate"]').click();
  assert.equal(s.requestCount(),0);
  s.$('[data-compare-play="C"]').click();
  assert.equal(s.lastRecording().src,'audio/comparison/xi1.mp3');
  s.lastRecording().onended?.();
});

test('changing comparison or leaving its tab cancels playback and stale events', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  s.$('[data-compare-play="alternate"]').click();
  const first=s.lastRecording();first.onplaying?.();
  assert.match(s.$('#compare-status').textContent??'',/A.*ān/);
  s.$('[data-compare-preset="en-eng"]').click();
  assert.equal(first.paused,true);
  first.onended?.();first.onerror?.();
  assert.doesNotMatch(s.$('#compare-status').textContent??'',/再生中|interrupted/);
  s.$('[data-compare-play="A"]').click();
  const second=s.lastRecording();s.$('[data-tab="vowels"]').click();
  assert.equal(second.paused,true);
  second.onplaying?.();assert.doesNotMatch(s.$('#voice-status').textContent??'',/再生中/);
});

test('comparisons work without TTS or the character catalog and keep audio statuses separate', async t => {
  const s=await setup(t,[],{speechSupported:false,fetchExamples:async()=>({ok:false,status:503,json:async()=>null})});
  s.$('[data-tab="compare"]').click();
  assert.equal(s.$<HTMLButtonElement>('[data-compare-play="alternate"]').disabled,false);
  assert.match(s.$('[data-side="A"]').textContent??'',/例字を読み込めません/);
  const detailStatus=s.$('#voice-status').textContent;
  s.$('[data-compare-play="A"]').click();
  const audio=s.lastRecording();audio.onplaying?.();
  assert.match(s.$('#compare-status').textContent??'',/A.*ān.*録音/);
  assert.equal(s.$('#voice-status').textContent,detailStatus);
  s.setVoices([]);
  assert.match(s.$('#compare-status').textContent??'',/録音を再生中/);
  audio.onended?.();
  s.$('[data-tab="rules"]').click();
  assert.doesNotMatch(s.$('#neutral-tone-status').textContent??'',/再生しました/);
  s.$('[data-neutral-tone-play="1"]').click();
  const neutral=s.lastRecording();neutral.onplaying?.();
  s.$('[data-tab="compare"]').click();
  assert.equal(neutral.paused,true);
  neutral.onerror?.();
  assert.equal(s.$('#compare-status').textContent,'話者の録音を元の速度で再生します。');
  assert.equal(s.requestCount(),0);
});

test('recording failures abort comparison sequences without a TTS fallback, and allow retry', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  s.$('[data-compare-play="alternate"]').click();
  s.lastRecording().onended?.();
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.equal(s.lastRecording().src,'audio/comparison/ang1.mp3');
  const failed=s.lastRecording();
  failed.onerror?.();failed.onended?.();
  const message=s.$('#compare-status').textContent;
  assert.match(message??'',/録音を読み込めません/);
  s.setVoices([local,preferred]);
  assert.equal(s.$('#compare-status').textContent,message);
  await new Promise(resolve=>setTimeout(resolve,450));
  assert.equal(s.recordingPlays.length,2);
  assert.equal(failed.paused,true);
  assert.equal(s.$<HTMLDetailsElement>('#voice-help').open,false);
  s.blockRecordings(true);
  s.$('[data-compare-play="alternate"]').click();
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.match(s.$('#compare-status').textContent??'',/録音を再生できません/);
  s.blockRecordings(false);
  s.$('[data-compare-play="A"]').click();s.lastRecording().onended?.();
  assert.equal(s.$('#compare-status').textContent,'再生しました。');
  assert.equal(s.requestCount(),0);
});

test('stop and detail TTS playback both cancel a comparison during the gap between sounds', async t => {
  const s=await setup(t);s.$('[data-tab="compare"]').click();
  for(const selector of ['#compare-stop','#play']){
    s.$('[data-compare-play="alternate"]').click();
    const audio=s.lastRecording(), count=s.recordingPlays.length;
    audio.onended?.();
    s.$(selector).click();
    assert.equal(audio.paused,true);
    audio.onended?.();audio.onerror?.();
    await new Promise(resolve=>setTimeout(resolve,450));
    assert.equal(s.recordingPlays.length,count);
    if(selector==='#play'){
      s.lastRequest().onstart?.();
      assert.doesNotMatch(s.$('#compare-status').textContent??'',/再生中/);
      s.lastRequest().onend?.();
    }
  }
});

test('unsupported recorded playback is clearly disabled even when TTS is available', async t => {
  const s=await setup(t,[local],{recordingsSupported:false});
  s.$('[data-tab="compare"]').click();
  for(const side of ['A','B','alternate'])assert.equal(s.$<HTMLButtonElement>(`[data-compare-play="${side}"]`).disabled,true);
  assert.match(s.$('#compare-status').textContent??'',/録音の再生に対応していません/);
  s.$('[data-compare-play="alternate"]').click();
  assert.equal(s.requestCount(),0);
  assert.equal(s.recordingCount(),0);
});

test('vowel map supports Japanese overlay and opens the correct syllable details', async t => {
  const s=await setup(t);s.$('[data-tab="vowels"]').click();
  assert.equal(s.window.document.querySelectorAll('.vowel-point').length,7);
  assert.equal(s.$<HTMLInputElement>('#japanese-vowels').checked,true);
  assert.equal(s.window.document.querySelectorAll('.japanese-vowel').length,5);
  s.$('#japanese-vowels').click();
  assert.equal(s.window.document.querySelectorAll('.japanese-vowel').length,0);
  s.$('#japanese-vowels').click();
  assert.equal(s.window.document.querySelectorAll('.japanese-vowel').length,5);
  assert.match(s.$('.vowel-japanese-note').textContent??'',/ɯ̟/);
  for(const [pick,reading] of [['yi','yī'],['yu','yū'],['e','ē']] as const){
    s.$(`.vowel-point[data-pick="${pick}"]`).click();
    assert.equal(s.$('#detail h2').textContent,reading);
  }
  s.$('[data-tab="finals"]').click();s.$('[data-tab="vowels"]').click();
  assert.equal(s.$<HTMLInputElement>('#japanese-vowels').checked,true);
});

test('example retry updates both views and rapid retries cannot start overlapping requests', async t => {
  const pending: {resolve: (response: ExampleResponse) => void; reject: (error: Error) => void}[] = [];
  const s = await setup(t, [local], {
    hash: '#s=yan&t=3',
    fetchExamples: () => new Promise((resolve, reject) => pending.push({resolve, reject})),
  });
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  s.$('[data-tab="compare"]').click();
  assert.equal(pending.length, 1);
  assert.equal(s.$<HTMLButtonElement>('#play').disabled, true);
  assert.equal(s.$<HTMLButtonElement>('[data-compare-play="A"]').disabled, false);
  required(pending[0], 'initial request').reject(new Error('offline'));
  await flush();
  const detailRetry = s.$('#detail #retry-examples');
  const compareRetry = s.$('#reference-body #retry-examples');
  compareRetry.click();
  detailRetry.click();
  compareRetry.click();
  assert.equal(pending.length, 2);
  assert.equal(s.window.document.querySelector('#retry-examples'), null);
  assert.match(s.$('#detail .example').textContent ?? '', /読み込み中/);
  assert.match(s.$('[data-side="A"]').textContent ?? '', /読み込み中/);
  assert.equal(s.$<HTMLButtonElement>('#play').disabled, true);
  assert.equal(s.$<HTMLButtonElement>('[data-compare-play="A"]').disabled, false);
  s.$('[data-tab="matrix"]').click();
  s.$('[data-tab="compare"]').click();
  assert.equal(pending.length, 2);
  required(pending[1], 'retry request').resolve({ok:true, json:async () => catalog});
  await flush();
  assert.equal(s.$('.example-word').textContent, '眼');
  assert.equal(s.$('[data-side="A"] .compare-example').textContent, '安');
  assert.equal(s.$<HTMLButtonElement>('#play').disabled, false);
  assert.equal(s.$<HTMLButtonElement>('[data-compare-play="A"]').disabled, false);
});

test('HTTP and invalid-catalog failures can be retried from the detail view', async t => {
  for (const response of [
    {ok:false, status:503, json:async () => catalog},
    {ok:true, json:async () => ({schemaVersion:1})},
  ]) {
    let calls = 0;
    const s = await setup(t, [local], {fetchExamples:async () => ++calls===1 ? response : {ok:true, json:async () => catalog}});
    assert.equal(s.$<HTMLButtonElement>('#play').disabled, true);
    assert.match(s.$('#voice-status').textContent ?? '', /読み込めませんでした/);
    s.$('#detail #retry-examples').click();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.equal(s.$<HTMLButtonElement>('#play').disabled, false);
    assert.equal(s.window.document.querySelector('#retry-examples'), null);
  }
});


test('slash from a non-searchable tab opens the matrix search',async t=>{
  const s=await setup(t);s.$('[data-tab="vowels"]').click();
  s.key('body','/');
  assert.equal(s.$('[data-tab="matrix"]').getAttribute('aria-current'),'page');
  assert.equal(s.$<HTMLInputElement>('#search').disabled,false);
  assert.equal(s.window.document.activeElement,s.$('#search'));
});

test('third-tone detail keeps its approved characters and contextual playback rules', async t => {
  const s = await setup(t);
  for (const [pinyin, word] of [
    ['yan', '眼'], ['yin', '引'], ['ying', '影'], ['li', '理'], ['hao', '好'], ['gei', '给'], ['shuai', '甩'],
    ['er', '耳'], ['kou', '口'], ['wu', '五'], ['liang', '两'], ['qing', '请'], ['xie', '写'], ['xue', '雪'],
    ['nuan', '暖'], ['ruan', '软'], ['ken', '肯'], ['jiong', '窘'], ['fou', '否'], ['lia', '俩'], ['dei', '得'],
  ]) {
    s.$('[data-tab="matrix"]').click();
    s.input(pinyin + '3');
    assert.equal(s.$('.example-word').textContent, word);
    assert.equal(s.$<HTMLButtonElement>('#play').disabled, false);
    s.$('#play').click();
    assert.equal(s.lastRequest().text, word);
    s.lastRequest().onend?.();
  }
  s.$('[data-tab="matrix"]').click();
  s.input('yan3');
  s.$('[data-third-tone-form="half"]').click();
  assert.equal(s.$<HTMLButtonElement>('#play').disabled, true);
  assert.equal(s.window.document.querySelector('.example-word'), null);
  s.input('jing5');
  assert.equal(s.$('.example-word').textContent, '眼睛');
  s.$('#play').click();
  assert.equal(s.lastRequest().text, '眼睛');
  s.lastRequest().onend?.();
});

test('detail prefers shared first-tone characters and labels multi-syllable fallback playback', async t => {
  const s = await setup(t);
  s.input('an1');
  assert.equal(s.$('.example-word').textContent, '安');
  s.$('#play').click();
  assert.equal(s.lastRequest().text, '安');
  s.lastRequest().onend?.();
  s.input('an4');
  assert.match(s.$('.example small').textContent ?? '', /例語全体を再生/);
  assert.equal(s.$('#play span').textContent, '例語を聞く');
  s.$('#play').click();
  assert.equal(s.lastRequest().text, s.$('.example-word').textContent);
  s.lastRequest().onend?.();
});

test('reviewed basic readings replace contextual fallbacks without changing the requested tone', async t => {
  const s = await setup(t);
  for(const [token,word,reading] of [
    ['bao1','包','bāo'],['bei1','杯','bēi'],['cha2','茶','chá'],['chuang2','床','chuáng'],
    ['ai4','爱','ài'],['fan4','饭','fàn'],['duo1','多','duō'],['niu2','牛','niú'],['er4','二','èr'],
    ['kan4','看','kàn'],
  ]){
    s.input(required(token,'token'));
    assert.equal(s.$('#detail h2').textContent,reading);
    assert.equal(s.$('.example-word').textContent,word);
    assert.equal(s.$('.example-pinyin').textContent,reading);
    assert.match(s.$('.example small').textContent??'',/例字を再生/);
    assert.equal(s.$<HTMLButtonElement>('#play').disabled,false);
    s.$('#play').click();assert.equal(s.lastRequest().text,word);
    s.lastRequest().onend?.();
  }
});

test('recorded detail examples play the selected isolated reading instead of ambiguous text or contextual words', async t => {
  const s=await setup(t);
  s.setVoices([local,preferred]);
  s.$<HTMLInputElement>('#rate').value='0.6';
  s.$('#rate').dispatchEvent(new s.window.Event('input',{bubbles:true}));
  for(const [token,word,reading] of [['fa1','发','fā'],['fa2','罚','fá'],['fa4','发','fà'],['ka3','卡','kǎ'],['qia3','卡','qiǎ']] as const){
    s.input(token);
    assert.equal(s.$('#detail h2').textContent,reading);
    assert.equal(s.$('.example-word').textContent,word);
    assert.equal(s.$('.example-pinyin').textContent,reading);
    assert.match(s.$('.example small').textContent??'',/録音で再生/);
    assert.equal(s.$('#play span').textContent,'録音を聞く');
    assert.equal(s.$<HTMLButtonElement>('#play').disabled,false);
    assert.equal(s.window.document.querySelector('.voice-settings,#voice-help'),null);
    assert.equal(s.$('.audio-footnote a').getAttribute('href'),'audio/detail/credits.html');
    s.$('#play').click();
    const audio=s.lastRecording();
    assert.equal(audio.src,`audio/detail/${token}.mp3`);
    assert.equal(audio.playbackRate,1);
    audio.onplaying?.();
    assert.match(s.$('#voice-status').textContent??'',new RegExp(reading+'.*録音を再生中'));
    audio.onended?.();
    assert.equal(s.$('#voice-status').textContent,'再生しました。');
  }
  assert.equal(s.requestCount(),0);
  s.input('ma1');
  assert.equal(s.$<HTMLInputElement>('#rate').value,'0.6');
  assert.equal(s.$<HTMLSelectElement>('#voice').value,preferred.voiceURI);
  s.$('#play').click();
  assert.equal(s.lastRequest().text,'妈');
  s.lastRequest().onend?.();
});

test('detail recordings work without TTS and are disabled if recorded playback is unavailable', async t => {
  for(const recordingsSupported of [true,false]){
    const s=await setup(t,[],{hash:'#s=fa&t=4',speechSupported:!recordingsSupported,recordingsSupported});
    assert.equal(s.$<HTMLButtonElement>('#play').disabled,!recordingsSupported);
    s.setVoices([local,preferred]);
    assert.equal(s.$<HTMLButtonElement>('#play').disabled,!recordingsSupported);
    s.$('#play').click();
    if(recordingsSupported){
      assert.equal(s.lastRecording().src,'audio/detail/fa4.mp3');
      s.lastRecording().onended?.();
    }else{
      assert.match(s.$('#voice-status').textContent??'',/録音の再生に対応していません/);
      assert.equal(s.recordingCount(),0);
    }
    assert.equal(s.requestCount(),0);
  }
});

test('detail recording failures can be retried without falling back to ambiguous TTS', async t => {
  const s=await setup(t,[local],{hash:'#s=ka&t=3'});
  s.$('#play').click();
  const failed=s.lastRecording();
  failed.onerror?.();failed.onended?.();
  assert.equal(failed.paused,true);
  assert.match(s.$('#voice-status').textContent??'',/録音を読み込めません/);
  s.setVoices([local,preferred]);
  assert.match(s.$('#voice-status').textContent??'',/録音を読み込めません/);
  s.blockRecordings(true);
  s.$('#play').click();
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.match(s.$('#voice-status').textContent??'',/録音を再生できません/);
  assert.equal(s.window.document.querySelector('#voice-help'),null);
  s.blockRecordings(false);
  s.$('#play').click();s.lastRecording().onended?.();
  assert.equal(s.$('#voice-status').textContent,'再生しました。');
  assert.equal(s.requestCount(),0);
});

test('isolated third-tone recordings stop on form changes and cannot replace contextual examples', async t => {
  const s=await setup(t);
  for(const pinyin of ['ka','qia']){
    s.input(pinyin+'3');
    s.$('#play').click();
    const audio=s.lastRecording(),count=s.recordingCount();
    for(const form of ['half','sandhi']){
      s.$(`[data-third-tone-form="${form}"]`).click();
      assert.equal(audio.paused,true);
      audio.onplaying?.();audio.onerror?.();audio.onended?.();
      assert.doesNotMatch(s.$('#voice-status').textContent??'',/再生中|読み込めません/);
      assert.equal(s.$<HTMLButtonElement>('#play').disabled,true);
      s.$('#play').click();
      assert.equal(s.recordingCount(),count);
      assert.equal(s.window.document.querySelector('.example-word'),null);
    }
    s.$('[data-third-tone-form="full"]').click();
    assert.equal(s.$<HTMLButtonElement>('#play').disabled,false);
    s.$('#play').click();
    assert.equal(s.lastRecording().src,`audio/detail/${pinyin}3.mp3`);
    s.$('#stop').click();
    assert.equal(s.lastRecording().paused,true);
    s.lastRecording().onplaying?.();s.lastRecording().onended?.();
    assert.equal(s.$('#voice-status').textContent,'再生を停止しました。');
  }
  assert.equal(s.requestCount(),0);
});

test('changing detail readings cancels playback and ignores callbacks from the old recording', async t => {
  const s=await setup(t,[local],{hash:'#s=fa&t=1'});
  s.$('#play').click();
  const first=s.lastRecording();
  s.$('[data-tone="4"]').click();
  assert.equal(first.paused,true);
  s.$('#play').click();
  const second=s.lastRecording();second.onplaying?.();
  first.onerror?.();first.onended?.();first.onplaying?.();
  assert.match(s.$('#voice-status').textContent??'',/fà.*録音を再生中/);
  s.input('ma1');
  assert.equal(second.paused,true);
  s.$('#play').click();s.lastRequest().onstart?.();
  second.onerror?.();second.onended?.();second.onplaying?.();
  assert.match(s.$('#voice-status').textContent??'',/妈.*再生中/);
  s.lastRequest().onend?.();
});

test('detail recordings have separate status messages from comparison and neutral recordings', async t => {
  const s=await setup(t,[local],{hash:'#s=fa&t=1'});
  for(const [tab,play,status] of [
    ['compare','[data-compare-play="A"]','#compare-status'],
    ['rules','[data-neutral-tone-play="1"]','#neutral-tone-status'],
  ]){
    s.$(`[data-tab="${tab}"]`).click();
    const defaultDetail=s.$('#voice-status').textContent;
    s.$(required(play,'play')).click();
    const other=s.lastRecording();other.onplaying?.();
    assert.match(s.$(required(status,'status')).textContent??'',/録音を再生中/);
    assert.equal(s.$('#voice-status').textContent,defaultDetail);
    s.$('#play').click();s.lastRecording().onplaying?.();
    assert.equal(other.paused,true);
    other.onerror?.();other.onended?.();
    assert.match(s.$('#voice-status').textContent??'',/fā.*録音を再生中/);
    assert.equal(s.$(required(status,'status')).textContent,'話者の録音を元の速度で再生します。');
    s.lastRecording().onended?.();
  }
});

test('a detail recording remains disabled until its example catalog is available', async t => {
  let calls=0;
  const s=await setup(t,[local],{hash:'#s=qia&t=3',fetchExamples:async()=>++calls===1?{ok:false,status:503,json:async()=>null}:{ok:true,json:async()=>catalog}});
  assert.equal(s.$<HTMLButtonElement>('#play').disabled,true);
  assert.match(s.$('#voice-status').textContent??'',/読み込めませんでした/);
  s.$('#retry-examples').click();
  assert.equal(s.$<HTMLButtonElement>('#play').disabled,true);
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(s.$<HTMLButtonElement>('#play').disabled,false);
  assert.equal(s.$('.example-word').textContent,'卡');
  s.$('#play').click();
  assert.equal(s.lastRecording().src,'audio/detail/qia3.mp3');
  s.lastRecording().onended?.();
  assert.equal(s.requestCount(),0);
});
