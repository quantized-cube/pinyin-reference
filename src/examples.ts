import type { ExampleCatalog, PronunciationExample, ThirdToneFormId } from './types.js';
import { fitsThirdToneForm, isThirdToneFormId } from './third-tone.js';

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
  if (!isRecord(value) || !isRecord(value.meta) || !isRecord(value.examples)) {
    throw new Error('Invalid example catalog');
  }
  const meta = value.meta;
  const examples: Record<string, PronunciationExample> = {};
  for (const [key, example] of Object.entries(value.examples)) examples[key] = parseExample(key, example);
  const thirdToneExamples: Record<string, Partial<Record<ThirdToneFormId, PronunciationExample>>> = {};
  if (value.thirdToneExamples !== undefined) {
    if (!isRecord(value.thirdToneExamples)) throw new Error('Invalid third-tone examples');
    for (const [key, forms] of Object.entries(value.thirdToneExamples)) {
      if (!/^[a-züê]+3$/.test(key) || !isRecord(forms)) throw new Error(`Invalid third-tone key: ${key}`);
      const validated: Partial<Record<ThirdToneFormId, PronunciationExample>> = {};
      for (const [form, example] of Object.entries(forms)) {
        if (!isThirdToneFormId(form)) throw new Error(`Invalid third-tone form: ${form}`);
        const parsed = parseExample(key, example);
        if (!fitsThirdToneForm(form, parsed)) throw new Error(`Invalid third-tone context: ${key}/${form}`);
        validated[form] = parsed;
      }
      thirdToneExamples[key] = validated;
    }
  }
  return {
    meta: {
      source: stringField(meta, 'source'), url: stringField(meta, 'url'),
      license: stringField(meta, 'license'), licenseUrl: stringField(meta, 'licenseUrl'),
      retrieved: stringField(meta, 'retrieved'), sha256: stringField(meta, 'sha256'),
      changes: stringField(meta, 'changes'),
    },
    examples, thirdToneExamples,
  };
}
