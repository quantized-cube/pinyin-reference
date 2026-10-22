import type {PronunciationExample, ThirdToneContextId, ThirdToneFormId} from './types.js';

interface ThirdToneRecording extends PronunciationExample {
  readonly form: ThirdToneContextId;
  readonly url: string;
}

export const thirdToneRecordings: readonly ThirdToneRecording[] = [
  {text: '好吃', tokens: ['hao3', 'chi1'], target: 0, form: 'half', url: 'audio/third-tone/haochi.mp3'},
  {text: '老师', tokens: ['lao3', 'shi1'], target: 0, form: 'half', url: 'audio/third-tone/laoshi.mp3'},
  {text: '老板', tokens: ['lao3', 'ban3'], target: 0, form: 'sandhi', url: 'audio/third-tone/laoban.mp3'},
  {text: '水平', tokens: ['shui3', 'ping2'], target: 0, form: 'half', url: 'audio/third-tone/shuiping.mp3'},
  {text: '水果', tokens: ['shui3', 'guo3'], target: 0, form: 'sandhi', url: 'audio/third-tone/shuiguo.mp3'},
  {text: '准备', tokens: ['zhun3', 'bei4'], target: 0, form: 'half', url: 'audio/third-tone/zhunbei.mp3'},
  {text: '准许', tokens: ['zhun3', 'xu3'], target: 0, form: 'sandhi', url: 'audio/third-tone/zhunxu.mp3'},
];

// Bind a recording to the complete displayed example, not just its target syllable.
// A later change to the word, reading, target or form must not reuse the old audio.
export function thirdToneRecording(example: PronunciationExample, form: ThirdToneFormId): string | undefined {
  return thirdToneRecordings.find(recording =>
    recording.form === form && recording.text === example.text && recording.target === example.target &&
    recording.tokens.length === example.tokens.length && recording.tokens.every((token, i) => token === example.tokens[i]),
  )?.url;
}
