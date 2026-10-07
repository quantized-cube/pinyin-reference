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
  for (const lang of ['zh-CN', 'zh_CN', 'zh-TW', 'zh-SG', 'zh-Hans-CN', 'cmn-CN']) assert.ok(isMandarinVoice({ lang, name: 'test' }), lang);
  for (const lang of ['en-US', 'ja-JP', 'zh-HK', 'yue-HK']) assert.ok(!isMandarinVoice({ lang, name: 'test' }), lang);
  assert.ok(!isMandarinVoice({ lang: 'zh', name: 'Cantonese' }));
});
test('speech sends Chinese text, selected voice and speed; stale callbacks cannot replace new state', () => {
  const s = setup();
  assert.equal(s.speaker.speak('妈妈', voice.voiceURI, .85), true);
  const first = s.lastRequest();
  assert.equal(first.text, '妈妈'); assert.equal(first.voice.lang, 'zh-CN');
  assert.equal(first.voice, voice); assert.equal(first.rate, .85);
  first.onStart(); assert.equal(s.lastStatus()[1], 'playing');
  s.speaker.speak('宣', voice.voiceURI, 1);
  const count = s.statuses.length;
  first.onError('interrupted'); first.onEnd();
  assert.equal(s.statuses.length, count);
  s.lastRequest().onEnd(); assert.equal(s.lastStatus()[1], 'idle');
  s.speaker.stop(); assert.ok(s.cancelCount() >= 3);
});
test('unavailable voices and synthesis errors are visible and never fall back to English', () => {
  const missing = setup([]);
  assert.equal(missing.speaker.speak('妈', ''), false);
  assert.equal(missing.lastStatus()[1], 'error'); assert.equal(missing.requests.length, 0);
  const failure = setup(); failure.speaker.speak('妈', voice.voiceURI);
  failure.lastRequest().onError('network'); assert.match(failure.lastStatus()[0], /network/);
  failure.speaker.stop();
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
