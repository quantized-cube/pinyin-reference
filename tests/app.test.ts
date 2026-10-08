import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { required } from '../src/types.js';

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

async function setup(t: TestContext, initialVoices = [local]) {
  const errors: unknown[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  // No resource loading or embedded scripts: only local built modules are evaluated.
  const dom = new JSDOM(html, { url: 'https://pinyin.test/', runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  t.after(() => { window.close(); assert.deepEqual(errors, []); });
  let voices = initialVoices;
  let cancellations = 0;
  const requests: Utterance[] = [];
  const synthesis = new window.EventTarget();
  Object.assign(synthesis, {
    getVoices: () => voices,
    cancel: () => { cancellations++; },
    speak: (utterance: Utterance) => requests.push(utterance),
  });
  Object.assign(window, {
    speechSynthesis: synthesis,
    SpeechSynthesisUtterance: Utterance,
    matchMedia: () => ({ matches: false }),
    fetch: async (url: string) => {
      assert.equal(url, 'examples.json');
      return { ok: true, json: async () => catalog };
    },
  });
  window.localStorage.setItem('pinyin.voice', preferred.voiceURI);
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
    cancellations: () => cancellations,
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
