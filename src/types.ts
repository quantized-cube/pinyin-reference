export type InitialId = '' | 'b' | 'p' | 'm' | 'f' | 'd' | 't' | 'n' | 'l'
  | 'g' | 'k' | 'h' | 'j' | 'q' | 'x' | 'zh' | 'ch' | 'sh' | 'r' | 'z' | 'c' | 's';
export type FinalId = 'a' | 'o' | 'e' | 'ai' | 'ei' | 'ao' | 'ou' | 'an' | 'en'
  | 'ang' | 'eng' | 'ong' | 'i' | 'ia' | 'ie' | 'iao' | 'iou' | 'ian' | 'in'
  | 'iang' | 'ing' | 'iong' | 'u' | 'ua' | 'uo' | 'uai' | 'uei' | 'uan' | 'uen'
  | 'uang' | 'ueng' | 'ü' | 'üe' | 'üan' | 'ün' | 'er' | '-i(z)' | '-i(zh)' | 'ê' | 'io';
export type FinalGroup = 'plain' | 'i' | 'u' | 'ü' | 'special';
export type GroupFilter = 'all' | FinalGroup;
export type ToneId = 1 | 2 | 3 | 4 | 5;
export type ThirdToneFormId = 'full' | 'half' | 'sandhi';
export interface ThirdToneForm {
  readonly id: ThirdToneFormId;
  readonly label: string;
  readonly value: string;
  readonly ipa: string;
  readonly points: string;
  readonly note: string;
}
export type TabId = 'matrix' | 'finals' | 'initials' | 'rules';
export interface Initial { readonly id: InitialId; readonly ipa: string; readonly label: string; readonly note: string; }
export interface Final { readonly id: FinalId; readonly ipa: string; readonly group: FinalGroup; readonly note: string; }
export interface Syllable {
  readonly pinyin: string;
  readonly initial: InitialId;
  readonly final: FinalId;
  readonly ipa: string;
  readonly rimeIpa: string;
  readonly peripheral: boolean;
}
export interface Tone {
  readonly id: ToneId;
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly ipa: string;
  readonly points: string;
  readonly note: string;
}
export interface SearchFilters {
  group?: GroupFilter;
  initial?: InitialId | 'all';
  rare?: boolean;
}
export interface AppState {
  tab: TabId;
  group: GroupFilter;
  initial: InitialId | 'all';
  rare: boolean;
  ipa: boolean;
  query: string;
  selected: string;
  tone: ToneId;
  thirdToneForm: ThirdToneFormId;
  voice: string;
  rate: number;
  settings: boolean;
}
export interface PronunciationExample {
  readonly text: string;
  readonly tokens: readonly string[];
  readonly target: number;
}
export type ExampleMap = Readonly<Record<string, PronunciationExample | undefined>>;
export type ThirdToneExampleMap = Readonly<Record<string, Readonly<Partial<Record<ThirdToneFormId, PronunciationExample>>> | undefined>>;
export interface ExampleCatalog {
  readonly meta: {
    readonly source: string;
    readonly url: string;
    readonly license: string;
    readonly licenseUrl: string;
    readonly retrieved: string;
    readonly sha256: string;
    readonly changes: string;
  };
  readonly examples: ExampleMap;
  readonly thirdToneExamples: ThirdToneExampleMap;
}

export function isToneId(value: unknown): value is ToneId {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}
export function isTabId(value: unknown): value is TabId {
  return value === 'matrix' || value === 'finals' || value === 'initials' || value === 'rules';
}
export function required<T>(value: T | null | undefined, description: string): T {
  if (value == null) throw new Error(`Missing ${description}`);
  return value;
}
