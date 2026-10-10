export type SpeechStatus = 'idle' | 'pending' | 'playing' | 'error';
export interface SpeechRequest {
  readonly text: string;
  readonly voice: SpeechSynthesisVoice | undefined;
  readonly lang: string;
  readonly rate: number;
  readonly onStart: () => void;
  readonly onEnd: () => void;
  readonly onError: (error: string) => void;
}
export interface SpeechEngine {
  readonly supported: boolean;
  getVoices(): SpeechSynthesisVoice[];
  onVoicesChanged(callback: () => void): void;
  speak(request: SpeechRequest): void;
  cancel(): void;
}

class BrowserSpeechEngine implements SpeechEngine {
  private readonly synth: SpeechSynthesis | undefined = globalThis.speechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  get supported(): boolean { return !!this.synth && typeof globalThis.SpeechSynthesisUtterance === 'function'; }
  getVoices(): SpeechSynthesisVoice[] { return this.synth?.getVoices() ?? []; }
  onVoicesChanged(callback: () => void): void { this.synth?.addEventListener('voiceschanged', callback); }
  cancel(): void { this.synth?.cancel(); this.utterance = null; }
  speak(request: SpeechRequest): void {
    if (!this.synth || !this.supported) throw new Error('Speech synthesis is unavailable');
    const utterance = new SpeechSynthesisUtterance(request.text);
    // Retain the native utterance until completion or cancellation.
    this.utterance = utterance;
    if (request.voice) utterance.voice = request.voice;
    utterance.lang = request.lang;
    utterance.rate = request.rate;
    utterance.onstart = request.onStart;
    utterance.onend = () => {
      if (this.utterance === utterance) this.utterance = null;
      request.onEnd();
    };
    utterance.onerror = event => {
      if (this.utterance === utterance) this.utterance = null;
      request.onError(event.error);
    };
    this.synth.speak(utterance);
  }
}

export function isMandarinVoice(voice: Pick<SpeechSynthesisVoice, 'lang' | 'name'>): boolean {
  const lang = voice.lang.toLowerCase().replaceAll('_', '-');
  return /^(zh(?:$|-(?:cn|sg|tw|hans|hant)(?:-|$))|cmn(?:-|$))/.test(lang)
    && !/cantonese|廣東|广东|粵語|粤语|hong kong/i.test(voice.name)
    && !/-hk\b/.test(lang);
}

function speechErrorMessage(error: string): string {
  if (['language-unavailable', 'voice-unavailable', 'synthesis-unavailable'].includes(error)) {
    return '中国語音声を利用できません。「音声が出ないとき」の手順で普通話の音声を追加し、再試行してください。';
  }
  if (error === 'not-allowed') return '再生が許可されませんでした。画面の再生ボタンをもう一度押してください。';
  if (error === 'network') return '音声の通信に失敗しました。接続を確認して再試行してください（network）。';
  return `音声を再生できませんでした（${error || 'unknown'}）。「音声が出ないとき」を確認してください。`;
}

interface SpeakerOptions {
  engine?: SpeechEngine;
  onStatus?: (message: string, status: SpeechStatus) => void;
  onVoices?: (voices: readonly SpeechSynthesisVoice[]) => void;
}

export class Speaker {
  voices: readonly SpeechSynthesisVoice[] = [];
  message: string | null = null;
  private serial = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly engine: SpeechEngine;
  private readonly onStatus: (message: string, status: SpeechStatus) => void;
  private readonly onVoices: (voices: readonly SpeechSynthesisVoice[]) => void;

  constructor({ engine = new BrowserSpeechEngine(), onStatus = () => {}, onVoices = () => {} }: SpeakerOptions = {}) {
    this.engine = engine;
    this.onStatus = onStatus;
    this.onVoices = onVoices;
    this.engine.onVoicesChanged(this.refresh);
    this.refresh();
  }
  readonly refresh = (): void => {
    this.voices = this.engine.getVoices().filter(isMandarinVoice).sort((a, b) =>
      Number(!/zh[-_]CN/i.test(a.lang)) - Number(!/zh[-_]CN/i.test(b.lang)) || a.name.localeCompare(b.name));
    this.onVoices(this.voices);
  };
  get supported(): boolean { return this.engine.supported; }
  private report(message: string, status: SpeechStatus): void {
    this.message = message;
    this.onStatus(message, status);
  }
  stop(announce = true): void {
    this.serial++;
    clearTimeout(this.timer);
    this.engine.cancel();
    this.message = null;
    if (announce) this.report('再生を停止しました。', 'idle');
  }
  speak(text: string, voiceURI: string, rate = 1): boolean {
    return this.speakSequence([{text}], voiceURI, rate);
  }
  speakSequence(items: readonly {text: string; label?: string}[], voiceURI: string, rate = 1): boolean {
    this.stop(false);
    if (!items.length) return false;
    if (!this.supported) {
      this.report('このブラウザは音声合成に対応していません。', 'error');
      return false;
    }
    this.refresh();
    const voice = this.voices.find(v => v.voiceURI === voiceURI) ?? this.voices[0];
    const id = this.serial;
    // Snapshot the sequence and settings; a later user action invalidates its generation.
    const sequence = items.map(item => ({...item}));
    const play = (index: number): boolean => {
      const item = sequence[index];
      if (id !== this.serial || !item) return false;
      let finished = false;
      const current = () => id === this.serial && !finished;
      const label = item.label ? `${item.label} · ` : '';
      this.report(label + (voice ? '音声を準備中…' : '中国語（中国本土）を指定して音声を準備中…'), 'pending');
      this.timer = setTimeout(() => {
        if (!current()) return;
        this.stop(false);
        this.report('音声の開始を確認できませんでした。「音声が出ないとき」を確認し、もう一度再生してください。', 'error');
      }, 15000);
      try {
        this.engine.speak({
          text:item.text, voice, lang:voice?.lang ?? 'zh-CN', rate:Math.max(.6, Math.min(1.2, Number(rate) || 1)),
          onStart: () => {
            if (!current()) return;
            clearTimeout(this.timer);
            this.report(`${label}「${item.text}」を再生中…`, 'playing');
          },
          onEnd: () => {
            if (!current()) return;
            finished = true;
            clearTimeout(this.timer);
            if (index + 1 < sequence.length) {
              this.report('次の音を準備中…', 'pending');
              this.timer = setTimeout(() => { play(index + 1); }, 400);
            } else this.report('再生しました。', 'idle');
          },
          onError: error => {
            if (!current()) return;
            finished = true;
            clearTimeout(this.timer);
            this.report(speechErrorMessage(error), 'error');
          },
        });
        return true;
      } catch {
        if (id !== this.serial) return false;
        finished = true;
        clearTimeout(this.timer);
        this.report('音声の開始に失敗しました。「音声が出ないとき」を確認してください。', 'error');
        return false;
      }
    };
    return play(0);
  }
}
