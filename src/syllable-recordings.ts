import {syllableRecordingTokens, unavailableRecordingTokens} from './syllable-recording-index.js';

export {syllableRecordingTokens};
const recordings = new Map(syllableRecordingTokens.map(token => [token, `audio/syllables/${token.replaceAll('ü', 'v')}.mp3`]));
const unavailable = new Set(unavailableRecordingTokens);

export function syllableRecording(pinyin: string, tone: number): string | undefined {
  return recordings.get(`${pinyin}${tone}`);
}
export function isUnrecordedTarget(pinyin: string, tone: number): boolean {
  return unavailable.has(`${pinyin}${tone}`);
}
