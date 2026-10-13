import type { ExampleCatalog, ExampleMap, PronunciationExample, ThirdToneContextId, ThirdToneFormId, ToneId } from './types.js';
import { fitsThirdToneForm, thirdToneExample } from './third-tone.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value) throw new Error(`Invalid example metadata: ${key}`);
  return value;
}

function parseExample(key: string, example: unknown): PronunciationExample {
    if (!/^[a-züê]+[1-5]$/.test(key) || !isRecord(example)) throw new Error(`Invalid example key: ${key}`);
    const { text, tokens, target } = example;
    if (typeof text !== 'string' || !/^[\u4e00-\u9fff]{1,3}$/.test(text)
      || !Array.isArray(tokens) || !tokens.every((token: unknown): token is string => typeof token === 'string' && /^[a-züê]+[1-5]$/.test(token))
      || tokens.length !== [...text].length || typeof target !== 'number'
      || !Number.isInteger(target) || target < 0 || target >= tokens.length || tokens[target] !== key
      || (key.endsWith('5') && tokens.length < 2)) {
      throw new Error(`Invalid pronunciation example: ${key}`);
    }
    return { text, tokens: [...tokens], target };
}

// JSON is an external boundary: validate it before using its values in the UI.
export function parseExampleCatalog(value: unknown): ExampleCatalog {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.meta)
    || !isRecord(value.isolatedExamples) || !isRecord(value.contextualExamples) || !isRecord(value.thirdToneExamples)) {
    throw new Error('Invalid example catalog');
  }
  const meta = value.meta;
  const isolatedExamples: Record<string, PronunciationExample> = {};
  const contextualExamples: Record<string, PronunciationExample> = {};
  for (const [key, example] of Object.entries(value.isolatedExamples)) {
    const parsed = parseExample(key, example);
    if (parsed.tokens.length !== 1 || key.endsWith('5')) throw new Error(`Invalid isolated example: ${key}`);
    isolatedExamples[key] = parsed;
  }
  for (const [key, example] of Object.entries(value.contextualExamples)) {
    const parsed = parseExample(key, example);
    if (parsed.tokens.length < 2) throw new Error(`Invalid contextual example: ${key}`);
    contextualExamples[key] = parsed;
  }
  const thirdToneExamples: Record<string, Partial<Record<ThirdToneContextId, PronunciationExample>>> = {};
  for (const [key, forms] of Object.entries(value.thirdToneExamples)) {
    if (!/^[a-züê]+3$/.test(key) || !isRecord(forms)) throw new Error(`Invalid third-tone key: ${key}`);
    const validated: Partial<Record<ThirdToneContextId, PronunciationExample>> = {};
    for (const [form, example] of Object.entries(forms)) {
      if (form !== 'half' && form !== 'sandhi') throw new Error(`Invalid third-tone form: ${form}`);
      const parsed = parseExample(key, example);
      if (!fitsThirdToneForm(form, parsed)) throw new Error(`Invalid third-tone context: ${key}/${form}`);
      validated[form] = parsed;
    }
    thirdToneExamples[key] = validated;
  }
  return {
    schemaVersion: 2,
    meta: {
      source: stringField(meta, 'source'), url: stringField(meta, 'url'),
      license: stringField(meta, 'license'), licenseUrl: stringField(meta, 'licenseUrl'),
      retrieved: stringField(meta, 'retrieved'), sha256: stringField(meta, 'sha256'),
      changes: stringField(meta, 'changes'),
    },
    isolatedExamples, contextualExamples, thirdToneExamples,
  };
}

export function isolatedExample(pinyin: string, tone: ToneId, examples: ExampleMap): PronunciationExample | undefined {
  if (tone === 5) return undefined;
  const key = pinyin + tone, example = examples[key];
  return example?.tokens.length === 1 && example.target === 0 && example.tokens[0] === key ? example : undefined;
}

export function detailExample(pinyin: string, tone: ToneId, form: ThirdToneFormId, catalog: ExampleCatalog | undefined): PronunciationExample | undefined {
  if (!catalog) return undefined;
  if (tone === 3) return thirdToneExample(pinyin, form, catalog.thirdToneExamples, catalog.isolatedExamples);
  return isolatedExample(pinyin, tone, catalog.isolatedExamples) ?? catalog.contextualExamples[pinyin + tone];
}
