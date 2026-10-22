import type {PronunciationExample, ThirdToneContextId, ThirdToneFormId} from './types.js';

interface ThirdToneRecording extends PronunciationExample {
  readonly form: ThirdToneContextId;
  readonly url: string;
}

export const thirdToneRecordings: readonly ThirdToneRecording[] = [
  {text: '好吃', tokens: ['hao3', 'chi1'], target: 0, form: 'half', url: 'audio/third-tone/haochi.mp3'},
];

// Bind a recording to the complete displayed example, not just its target syllable.
// A later change to the word, reading, target or form must not reuse the old audio.
export function thirdToneRecording(example: PronunciationExample, form: ThirdToneFormId): string | undefined {
  return thirdToneRecordings.find(recording =>
    recording.form === form && recording.text === example.text && recording.target === example.target &&
    recording.tokens.length === example.tokens.length && recording.tokens.every((token, i) => token === example.tokens[i]),
  )?.url;
}
