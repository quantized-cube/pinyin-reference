import type {ToneId, ThirdToneFormId} from './types.js';

// These isolated readings share a written character, so TTS text cannot distinguish them.
export const detailRecordingTokens = ['fa1', 'fa4', 'ka3', 'qia3'] as const;
const recordings = new Map<string, string>(
  detailRecordingTokens.map(token => [token, `audio/detail/${token}.mp3`]),
);

export function detailRecording(pinyin: string, tone: ToneId, form: ThirdToneFormId): string | undefined {
  // An isolated third tone must never stand in for a contextual half tone or sandhi.
  if (tone === 3 && form !== 'full') return undefined;
  return recordings.get(`${pinyin}${tone}`);
}
