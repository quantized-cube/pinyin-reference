import { getFinal } from './data.js';
import type { FinalId, InitialId } from './types.js';

interface InitialSection {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly initials: readonly InitialId[];
}
export const initialSections: readonly InitialSection[] = [
  { id: 'zero', label: '声母なし', note: 'y / w の綴りも含む', initials: [''] },
  { id: 'labial', label: '唇音', note: 'b・p・m：両唇音 / f：唇歯音', initials: ['b','p','m','f'] },
  { id: 'alveolar', label: '歯茎音', note: 'd・t・n・l', initials: ['d','t','n','l'] },
  { id: 'velar', label: '軟口蓋音', note: 'g・k・h', initials: ['g','k','h'] },
  { id: 'alveolopalatal', label: '歯茎硬口蓋音', note: 'j・q・x', initials: ['j','q','x'] },
  { id: 'retroflex', label: 'そり舌音', note: 'zh・ch・sh・r', initials: ['zh','ch','sh','r'] },
  { id: 'sibilant', label: '歯茎音', note: 'z・c・s（破擦音・摩擦音）', initials: ['z','c','s'] },
];

interface FinalSection {
  readonly id: string;
  readonly label: string;
  readonly finals: readonly FinalId[];
}
// Traditional teaching categories: 10 simple, 13 compound, 16 nasal finals,
// plus yo (analytical io). Keep the three i sounds adjacent for comparison.
export const finalSections: readonly FinalSection[] = [
  { id: 'simple', label: '単韻母', finals: ['a','o','e','i','-i(z)','-i(zh)','u','ü','ê','er'] },
  { id: 'compound', label: '複合韻母', finals: ['ai','ei','uei','ao','ou','iou','ie','üe','ia','ua','uo','iao','uai'] },
  { id: 'nasal-n', label: '鼻韻母 · -n', finals: ['an','en','in','uen','ün','ian','uan','üan'] },
  { id: 'nasal-ng', label: '鼻韻母 · -ng', finals: ['ang','eng','ing','ong','iang','uang','iong','ueng'] },
  { id: 'extra', label: '補足の音節', finals: ['io'] },
];
export const orderedFinals = finalSections.flatMap(section => section.finals.map(getFinal));
const aliases: Partial<Record<FinalId, string>> = { iou: 'iu', uei: 'ui', uen: 'un' };
export function finalHeading(id: FinalId): string {
  return aliases[id] ? `${id} (${aliases[id]})` : id;
}

// Merge spelling columns only; each syllable retains its analytical final/IPA.
export function matrixFinalId(id: FinalId): FinalId {
  return id === '-i(z)' || id === '-i(zh)' ? 'i' : id;
}
export function finalContext(id: FinalId): string {
  return id === '-i(z)' ? 'zi・ci・si 系' : id === '-i(zh)' ? 'zhi・chi・shi・ri 系' : '';
}
export const matrixFinals = orderedFinals.filter(f => matrixFinalId(f.id) === f.id).map(f => ({
  ...f,
  variants: f.id === 'i' ? (['i', '-i(z)', '-i(zh)'] as const).map(getFinal) : [f],
  ipa: f.id === 'i' ? 'i / ɹ̩ / ɻ̩' : f.ipa,
  note: f.id === 'i' ? '声母によって発音が変わる。yi・mi などは [i]、zi・ci・si は [ɹ̩]、zhi・chi・shi・ri は [ɻ̩]。' : f.note,
}));
