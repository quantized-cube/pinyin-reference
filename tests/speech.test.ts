import test from 'node:test';
import assert from 'node:assert/strict';
import { Speaker, isMandarinVoice } from '../src/speech.js';
import type { SpeechEngine, SpeechRequest, SpeechStatus } from '../src/speech.js';
import { required } from '../src/types.js';

const voice: SpeechSynthesisVoice = {
  lang: 'zh-CN', name: 'Mandarin', voiceURI: 'zh-CN-test', localService: true, default: true,
};
function setup(voices: SpeechSynthesisVoice[] = [voice], supported = true) {
  const requests: SpeechRequest[] = [];
  const statuses: [string, SpeechStatus][] = [];
  let cancelCount = 0;
  let voicesChanged: (() => void) | undefined;
  const engine: SpeechEngine = {
    supported,
    getVoices: () => voices,
    cancel: () => { cancelCount++; },
    speak: request => { requests.push(request); },
    onVoicesChanged: callback => { voicesChanged = callback; },
  };
  const speaker = new Speaker({ engine, onStatus: (message, status) => statuses.push([message, status]) });
  return {
    speaker, requests, statuses, engine,
    lastRequest: () => required(requests.at(-1), 'speech request'),
    lastStatus: () => required(statuses.at(-1), 'speech status'),
    cancelCount: () => cancelCount,
    notifyVoicesChanged: () => required(voicesChanged, 'voice change listener')(),
  };
}

test('Mandarin voice filter excludes Cantonese and unrelated languages', () => {
  for (const lang of ['zh', 'zh-CN', 'zh_CN', 'zh-TW', 'zh-SG', 'zh-Hans-CN', 'cmn-CN', 'zh-CN-x-local']) assert.ok(isMandarinVoice({ lang, name: 'test' }), lang);
  for (const lang of ['en-US', 'ja-JP', 'zh-HK', 'zh-Hant-HK', 'yue-HK']) assert.ok(!isMandarinVoice({ lang, name: 'test' }), lang);
  assert.ok(!isMandarinVoice({ lang: 'zh', name: 'Cantonese' }));
});
test('speech sends Chinese text, selected voice and speed; stale callbacks cannot replace new state', () => {
  const s = setup();
  assert.equal(s.speaker.speak('妈妈', voice.voiceURI, .85), true);
  const first = s.lastRequest();
  assert.equal(first.text, '妈妈'); assert.equal(first.lang, 'zh-CN');
  assert.equal(first.voice, voice); assert.equal(first.rate, .85);
  first.onStart(); assert.equal(s.lastStatus()[1], 'playing');
  s.speaker.speak('宣', voice.voiceURI, 1);
  const count = s.statuses.length;
  first.onError('interrupted'); first.onEnd();
  assert.equal(s.statuses.length, count);
  s.lastRequest().onEnd(); assert.equal(s.lastStatus()[1], 'idle');
  s.speaker.stop(); assert.ok(s.cancelCount() >= 3);
});
test('missing Mandarin voices still request zh-CN, never an enumerated English or Cantonese voice', () => {
  for (const voices of [[], [{ ...voice, lang: 'en-US' }], [{ ...voice, lang: 'zh-HK' }]]) {
    const missing = setup(voices);
    assert.equal(missing.speaker.speak('妈', voice.voiceURI), true);
    assert.equal(missing.lastRequest().voice, undefined);
    assert.equal(missing.lastRequest().lang, 'zh-CN');
    missing.lastRequest().onEnd();
  }
});
test('synthesis failures give actionable help that voice refresh does not erase', () => {
  for (const error of ['language-unavailable', 'voice-unavailable', 'synthesis-unavailable']) {
    const missing = setup([]);
    missing.speaker.speak('妈', '');
    missing.lastRequest().onError(error);
    assert.equal(missing.lastStatus()[1], 'error');
    assert.match(missing.lastStatus()[0], /普通話の音声を追加/);
    missing.notifyVoicesChanged();
    assert.equal(missing.speaker.message, missing.lastStatus()[0]);
  }
  const failure = setup(); failure.speaker.speak('妈', voice.voiceURI);
  failure.lastRequest().onError('network'); assert.match(failure.lastStatus()[0], /network/);
  failure.speaker.stop();
});
test('a tap discovers voices loaded without a voiceschanged event and uses the saved choice', () => {
  const s = setup([]);
  const selected = { ...voice, voiceURI: 'preferred', name: 'Preferred voice' };
  s.engine.getVoices = () => [voice, selected];
  s.speaker.speak('宣', selected.voiceURI);
  assert.equal(s.lastRequest().voice, selected);
  s.lastRequest().onEnd();
});
test('native adapter leaves voice unset but explicitly passes zh-CN when the list is empty', () => {
  const originals = new Map(['speechSynthesis', 'SpeechSynthesisUtterance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let captured: SpeechSynthesisUtterance | undefined;
  class Utterance {
    voice = null;
    lang = '';
    constructor(readonly text: string) {}
  }
  try {
    Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [], addEventListener: () => {}, cancel: () => {},
      speak: (utterance: SpeechSynthesisUtterance) => { captured = utterance; },
    } });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    const speaker = new Speaker();
    assert.equal(speaker.speak('好吃', '', .85), true);
    const utterance = required(captured, 'native utterance');
    assert.equal(utterance.text, '好吃');
    assert.equal(utterance.voice, null);
    assert.equal(utterance.lang, 'zh-CN');
    assert.equal(utterance.rate, .85);
    utterance.onend?.({} as SpeechSynthesisEvent);
    assert.equal(speaker.message, '再生しました。');
    speaker.stop(false);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
test('voiceschanged event refreshes asynchronously loaded voices', () => {
  const s = setup([]); assert.equal(s.speaker.voices.length, 0);
  s.engine.getVoices = () => [voice]; s.notifyVoicesChanged();
  assert.equal(s.speaker.voices.length, 1);
});
test('unsupported speech and synchronous failures do not leave a pending request', () => {
  const unavailable = setup([voice], false);
  assert.equal(unavailable.speaker.speak('妈', ''), false);
  assert.equal(unavailable.lastStatus()[1], 'error'); assert.equal(unavailable.requests.length, 0);
  const s = setup(); s.engine.speak = () => { throw new Error('engine unavailable'); };
  assert.equal(s.speaker.speak('妈', voice.voiceURI), false);
  assert.equal(s.lastStatus()[1], 'error');
});
