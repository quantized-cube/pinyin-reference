import type {AppState} from './types.js';

export function getSetting(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function save(key: string, value: string | number | boolean): void {
  try { localStorage.setItem(key, String(value)); } catch { /* Storage may be unavailable. */ }
}

export function createState(): AppState {
  const savedIpa = getSetting('pinyin.ipa', '');
  const rate = Number(getSetting('pinyin.rate', '0.85')) || .85;
  return {
    tab: 'matrix', group: 'all', initial: 'all', rare: true,
    ipa: savedIpa === '' ? !matchMedia('(max-width:800px)').matches : savedIpa === 'true',
    searchMode: 'pinyin', query: '', selected: 'xuan', tone: 1,
    thirdToneForm: 'full', thirdToneExpanded: false,
    voice: getSetting('pinyin.voice', ''), rate: Math.max(.6, Math.min(1.2, rate)), settings: false,
    compareA: 'an', compareB: 'ang', compareTone: 1, japaneseVowels: false,
  };
}
