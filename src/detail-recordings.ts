import type {ToneId, ThirdToneFormId} from './types.js';
import {syllableRecording} from './syllable-recordings.js';

export {syllableRecordingTokens as detailRecordingTokens} from './syllable-recordings.js';

export function detailRecording(pinyin: string, tone: ToneId, form: ThirdToneFormId): string | undefined {
  // An isolated third tone must never stand in for a contextual half tone or sandhi.
  if (tone === 3 && form !== 'full') return undefined;
  return syllableRecording(pinyin, tone);
}
