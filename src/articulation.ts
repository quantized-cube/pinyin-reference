import type { InitialId } from './types.js';

// Put textbook names first and retain the app's broad IPA place names.
export const places = {
  bilabial: { label: '両唇音', aliases: ['双唇音','唇音'], note: '上下の唇を使う音。b・p・m。双唇音とも呼び、唇歯音とあわせて「唇音」と呼びます。' },
  labiodental: { label: '唇歯音', aliases: ['唇音'], note: '下唇と上の前歯を使う音。f。両唇音とともに唇音の仲間です。' },
  alveolar: { label: '舌尖音（歯茎音）', aliases: ['舌尖中音'], note: '舌先と上の歯茎を使う音。d・t・n・l。舌尖中音とも呼びます。この表の「舌尖音」はこの4つを指します。' },
  velar: { label: '舌根音（軟口蓋音）', aliases: ['舌面後音'], note: '舌の奥と、口の天井の奥にある柔らかい部分を使う音。g・k・h。舌面後音とも呼びます。' },
  alveolopalatal: { label: '舌面音（歯茎硬口蓋音）', aliases: ['舌面前音'], note: '舌の前部と、歯茎の後ろから硬口蓋（口の天井の硬い部分）にかけて狭める音。j・q・x。舌面前音とも呼びます。' },
  retroflex: { label: 'そり舌音（舌尖後音）', aliases: ['捲舌音','巻舌音','反り舌音'], note: '舌先を歯茎より後ろへ向けて作る音。zh・ch・sh・r。捲舌音・巻舌音とも呼びます。舌を強く巻き込む必要はありません。' },
  apicalFront: { label: '舌歯音（歯茎音）', aliases: ['舌尖前音','平舌音'], note: '舌先付近と上の前歯の裏〜歯茎付近を使う音。z・c・s。舌尖前音・平舌音とも呼びます。歯音・歯茎音などの細かな分類は資料によって異なり、このアプリでは [ts・tsʰ・s] と表記します。' },
} as const;

export const placeTerminologyNote = '教材での呼び方を先に置き、括弧内に音声学上の名称や別名を添えています。この表の「舌尖音」は d・t・n・l（舌尖中音）です。広い用法では、舌歯音（舌尖前音）やそり舌音（舌尖後音）も舌尖音に含めます。';

export const manners = {
  plosive: { label: '破裂音', note: '口の中で息の通り道をいったん閉じ、開放して作る音。b・p・d・t・g・k。' },
  affricate: { label: '破擦音', note: 'いったん閉じた後、狭いすき間を残して摩擦を伴いながら開放する音。j・q・zh・ch・z・c。' },
  fricative: { label: '摩擦音', note: '狭いすき間に息を通し、摩擦を起こす音。f・h・x・sh・s。' },
  nasal: { label: '鼻音', note: '口の通り道を閉じ、鼻に息を通す音。m・n。' },
  lateral: { label: '側面接近音', note: '舌の中央を閉じ、側面に息を通す音。l。' },
  approximant: { label: '接近音', note: '発音器官を近づけ、強い摩擦を起こさず息を通す音。このアプリの r [ɻ]。摩擦音 [ʐ] とする分析もあります。' },
} as const;

export const aspirations = {
  unaspirated: { label: '無気音', note: '子音を開放した直後の強い息（帯気）が目立たない音。空気が全く出ないという意味ではありません。b・d・g・j・zh・z。' },
  aspirated: { label: '有気音', note: '子音の開放後に、はっきりした息（帯気）が続く音。IPAでは ʰ を添えます。p・t・k・q・ch・c。' },
} as const;

export const voicings = {
  voiceless: { label: '無声音', note: '子音を作る間、声帯の振動を伴わない音。普通話の b・d・g もここに含みます。' },
  voiced: { label: '有声音', note: '子音を作る間、声帯の振動を伴う音。このアプリでは m・n・l・r。' },
} as const;

interface Articulation {
  readonly place: keyof typeof places;
  readonly manner: keyof typeof manners;
  readonly aspiration: keyof typeof aspirations | null;
  readonly voicing: keyof typeof voicings;
}

const profiles: Record<Exclude<InitialId, ''>, Articulation> = {
  b: { place: 'bilabial', manner: 'plosive', aspiration: 'unaspirated', voicing: 'voiceless' },
  p: { place: 'bilabial', manner: 'plosive', aspiration: 'aspirated', voicing: 'voiceless' },
  m: { place: 'bilabial', manner: 'nasal', aspiration: null, voicing: 'voiced' },
  f: { place: 'labiodental', manner: 'fricative', aspiration: null, voicing: 'voiceless' },
  d: { place: 'alveolar', manner: 'plosive', aspiration: 'unaspirated', voicing: 'voiceless' },
  t: { place: 'alveolar', manner: 'plosive', aspiration: 'aspirated', voicing: 'voiceless' },
  n: { place: 'alveolar', manner: 'nasal', aspiration: null, voicing: 'voiced' },
  l: { place: 'alveolar', manner: 'lateral', aspiration: null, voicing: 'voiced' },
  g: { place: 'velar', manner: 'plosive', aspiration: 'unaspirated', voicing: 'voiceless' },
  k: { place: 'velar', manner: 'plosive', aspiration: 'aspirated', voicing: 'voiceless' },
  h: { place: 'velar', manner: 'fricative', aspiration: null, voicing: 'voiceless' },
  j: { place: 'alveolopalatal', manner: 'affricate', aspiration: 'unaspirated', voicing: 'voiceless' },
  q: { place: 'alveolopalatal', manner: 'affricate', aspiration: 'aspirated', voicing: 'voiceless' },
  x: { place: 'alveolopalatal', manner: 'fricative', aspiration: null, voicing: 'voiceless' },
  zh: { place: 'retroflex', manner: 'affricate', aspiration: 'unaspirated', voicing: 'voiceless' },
  ch: { place: 'retroflex', manner: 'affricate', aspiration: 'aspirated', voicing: 'voiceless' },
  sh: { place: 'retroflex', manner: 'fricative', aspiration: null, voicing: 'voiceless' },
  r: { place: 'retroflex', manner: 'approximant', aspiration: null, voicing: 'voiced' },
  z: { place: 'apicalFront', manner: 'affricate', aspiration: 'unaspirated', voicing: 'voiceless' },
  c: { place: 'apicalFront', manner: 'affricate', aspiration: 'aspirated', voicing: 'voiceless' },
  s: { place: 'apicalFront', manner: 'fricative', aspiration: null, voicing: 'voiceless' },
};

export function articulationFor(id: InitialId): Articulation | undefined { return id ? profiles[id] : undefined; }

export function articulationTerms(id: InitialId): readonly { readonly label: string; readonly note: string }[] {
  const profile = articulationFor(id);
  if (!profile) return [];
  return [places[profile.place], manners[profile.manner],
    ...(profile.aspiration ? [aspirations[profile.aspiration]] : []), voicings[profile.voicing]];
}

export function articulationSearchText(id: InitialId): string {
  const profile = articulationFor(id);
  return [...articulationTerms(id).map(term => term.label),
    ...(profile ? places[profile.place].aliases : [])].join(' ');
}

export const aspirationPairs: readonly (readonly [InitialId, InitialId, string, string])[] = [
  ['b', 'p', 'ba', 'pa'], ['d', 't', 'da', 'ta'], ['g', 'k', 'ga', 'ka'],
  ['j', 'q', 'ji', 'qi'], ['zh', 'ch', 'zhi', 'chi'], ['z', 'c', 'zi', 'ci'],
];
