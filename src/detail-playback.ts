import type {AppState, ExampleCatalog, ExampleState, PronunciationExample} from './types.js';
import {detailExample} from './examples.js';
import {detailRecording} from './detail-recordings.js';
import {isUnrecordedTarget} from './syllable-recordings.js';

type UnavailableReason = 'recording-missing' | 'reading-unreviewed' | 'example-loading' | 'example-error' | 'example-missing';
export type DetailPlayback = {readonly example: PronunciationExample | undefined; readonly contextual: boolean} & (
  {readonly kind: 'recording'; readonly url: string} |
  {readonly kind: 'speech'; readonly text: string} |
  {readonly kind: 'unavailable'; readonly reason: UnavailableReason}
);

// One decision drives the button, label, status and click handler. The approved
// recording index is independent of the optional, asynchronously loaded examples.
export function resolveDetailPlayback(
  state: Pick<AppState, 'selected' | 'tone' | 'thirdToneForm'>,
  catalog: ExampleCatalog | undefined,
  exampleState: ExampleState,
): DetailPlayback {
  const {selected, tone, thirdToneForm} = state;
  const example = detailExample(selected, tone, thirdToneForm, catalog);
  const contextual = tone === 5 || (tone === 3 && thirdToneForm !== 'full');
  const base = {example, contextual};
  if (!contextual) {
    const url = detailRecording(selected, tone, thirdToneForm);
    if (url) return {...base, kind: 'recording', url};
    return {...base, kind: 'unavailable', reason: isUnrecordedTarget(selected, tone) ? 'recording-missing' : 'reading-unreviewed'};
  }
  if (example) return {...base, kind: 'speech', text: example.text};
  return {...base, kind: 'unavailable', reason: exampleState === 'loading' ? 'example-loading' : exampleState === 'error' ? 'example-error' : 'example-missing'};
}

export function unavailablePlaybackMessage(reason: UnavailableReason): string {
  switch (reason) {
    case 'recording-missing': return 'この単独音の録音は未収録です。';
    case 'reading-unreviewed': return 'この音節・声調の録音は未収録です。';
    case 'example-loading': return '例語を読み込み中…';
    case 'example-error': return '例語データを読み込めませんでした。';
    case 'example-missing': return 'この発音形の例語は未収録です。';
  }
}
