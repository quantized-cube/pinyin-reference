import {syllableRecording, syllableSpeechExample} from './syllable-recordings.js';

// The fixed comparisons remain first-tone only; audio is shared with the detail view.
export const comparisonSyllableTokens = [
  'an1', 'ang1', 'ba1', 'ben1', 'beng1', 'chi1', 'ci1', 'da1', 'ge1',
  'guan1', 'guang1', 'ji1', 'ke1', 'pa1', 'qi1', 'shi1', 'si1', 'ta1',
  'wen1', 'weng1', 'xi1', 'xian1', 'xiang1', 'yin1', 'ying1', 'zhi1', 'zi1',
] as const;

const tokens = new Set<string>(comparisonSyllableTokens);
export const comparisonRecordingTokens = comparisonSyllableTokens.filter(token => syllableRecording(token.slice(0,-1),1));

export function comparisonRecording(pinyin: string, tone: number): string | undefined {
  return tokens.has(`${pinyin}${tone}`) ? syllableRecording(pinyin, tone) : undefined;
}

export function comparisonSpeechExample(pinyin: string, tone: number) {
  if (!tokens.has(`${pinyin}${tone}`)) return undefined;
  const example = syllableSpeechExample(pinyin, tone);
  return example?.tokens.length === 1 ? example : undefined;
}
