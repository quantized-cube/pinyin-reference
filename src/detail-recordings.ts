import type {ToneId, ThirdToneFormId} from './types.js';

// Recordings distinguish polyphonic examples and provide an isolated fá for tone practice.
export const detailRecordingTokens = ['fa1', 'fa2', 'fa4', 'ka3', 'qia3'] as const;
const recordings = new Map<string, string>(
  detailRecordingTokens.map(token => [token, `audio/detail/${token}.mp3`]),
);

export function detailRecording(pinyin: string, tone: ToneId, form: ThirdToneFormId): string | undefined {
  // An isolated third tone must never stand in for a contextual half tone or sandhi.
  if (tone === 3 && form !== 'full') return undefined;
  return recordings.get(`${pinyin}${tone}`);
}
