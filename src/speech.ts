export type SpeechStatus = 'idle' | 'pending' | 'playing' | 'error';
export interface SpeechRequest {
  readonly text: string;
  readonly voice: SpeechSynthesisVoice;
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
    utterance.voice = request.voice;
    utterance.lang = request.voice.lang;
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
  return /^(zh($|-cn$|-sg$|-tw$|-hans(?:-|$)|-hant(?:-|$))|cmn(?:-|$))/.test(lang)
    && !/cantonese|廣東|广东|粵語|粤语|hong kong/i.test(voice.name)
    && !/-hk\b/.test(lang);
}

interface SpeakerOptions {
  engine?: SpeechEngine;
  onStatus?: (message: string, status: SpeechStatus) => void;
  onVoices?: (voices: readonly SpeechSynthesisVoice[]) => void;
}

export class Speaker {
  voices: readonly SpeechSynthesisVoice[] = [];
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
  stop(announce = true): void {
    this.serial++;
    clearTimeout(this.timer);
    this.engine.cancel();
    if (announce) this.onStatus('再生を停止しました。', 'idle');
  }
  speak(text: string, voiceURI: string, rate = 1): boolean {
    this.stop(false);
    if (!this.supported) {
      this.onStatus('このブラウザは音声合成に対応していません。', 'error');
      return false;
    }
    const voice = this.voices.find(v => v.voiceURI === voiceURI) ?? this.voices[0];
    if (!voice) {
      this.onStatus('中国語の音声が見つかりません。端末の言語・音声設定をご確認ください。', 'error');
      return false;
    }
    const id = this.serial;
    this.onStatus('音声を準備中…', 'pending');
    this.timer = setTimeout(() => {
      if (id !== this.serial) return;
      this.stop(false);
      this.onStatus('音声の開始を確認できませんでした。別の音声で再試行してください。', 'error');
    }, 15000);
    try {
      this.engine.speak({
        text, voice, rate: Math.max(.6, Math.min(1.2, Number(rate) || 1)),
        onStart: () => {
          if (id !== this.serial) return;
          clearTimeout(this.timer);
          this.onStatus(`「${text}」を再生中…`, 'playing');
        },
        onEnd: () => {
          if (id !== this.serial) return;
          clearTimeout(this.timer);
          this.onStatus('再生しました。', 'idle');
        },
        onError: error => {
          if (id !== this.serial) return;
          clearTimeout(this.timer);
          this.onStatus(`音声を再生できませんでした（${error || 'unknown'}）。音声を変更して再試行してください。`, 'error');
        },
      });
      return true;
    } catch {
      clearTimeout(this.timer);
      this.onStatus('音声の開始に失敗しました。', 'error');
      return false;
    }
  }
}
