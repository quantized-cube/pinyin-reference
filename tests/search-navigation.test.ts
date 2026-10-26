import test from 'node:test';
import assert from 'node:assert/strict';
import {findSyllables} from '../src/data.js';
import {SearchNavigation, searchPresentation} from '../src/search-navigation.js';
import type {AppState, TabId} from '../src/types.js';

function state(): AppState {
  return {
    tab: 'matrix', query: '', searchMode: 'pinyin', group: 'all', initial: 'all', rare: true,
    selected: 'yan', tone: 3, thirdToneForm: 'half', thirdToneExpanded: true,
    comparePreset: 'an-ang', ipa: true, japaneseVowels: true, voice: 'preferred', rate: .9, settings: true,
  };
}

function visit(navigation: SearchNavigation, current: AppState, tab: TabId): void {
  const oldTab = current.tab;
  navigation.transition(current, tab);
  assert.equal(current.tab, oldTab, 'the caller owns tab selection');
  current.tab = tab;
}

test('returning to a pinyin search restores its interpretation after IPA was used elsewhere', () => {
  const navigation = new SearchNavigation(), current = state();
  current.query = 'pa';
  const expected = findSyllables(current.query, current).map(syllable => syllable.pinyin);
  assert.ok(!expected.includes('ba'));

  visit(navigation, current, 'initials');
  assert.equal(current.query, '');
  assert.equal(current.searchMode, 'pinyin');
  current.searchMode = 'ipa';
  current.query = 'pʰ';

  visit(navigation, current, 'matrix');
  assert.equal(current.query, 'pa');
  assert.equal(current.searchMode, 'pinyin');
  assert.deepEqual(findSyllables(current.query, current).map(syllable => syllable.pinyin), expected);
  visit(navigation, current, 'initials');
  assert.equal(current.query, 'pʰ');
  assert.equal(current.searchMode, 'ipa');
});

test('matrix and final filters remain independent across other views and a local reset', () => {
  const navigation = new SearchNavigation(), current = state();
  Object.assign(current, {query: 'x', group: 'i', initial: 'x', rare: false});
  visit(navigation, current, 'finals');
  assert.equal(current.group, 'all');
  assert.equal(current.initial, 'all');
  assert.equal(current.rare, true);
  Object.assign(current, {query: '嗯', group: 'special'});

  visit(navigation, current, 'compare');
  const beforeReset = {...current};
  navigation.reset(current);
  assert.deepEqual(current, beforeReset, 'a non-searchable view does not reset hidden searches');
  visit(navigation, current, 'vowels');
  visit(navigation, current, 'finals');
  assert.equal(current.query, '嗯');
  assert.equal(current.group, 'special');
  navigation.reset(current);
  assert.equal(current.query, '');
  assert.equal(current.group, 'all');

  visit(navigation, current, 'matrix');
  assert.equal(current.query, 'x');
  assert.equal(current.group, 'i');
  assert.equal(current.initial, 'x');
  assert.equal(current.rare, false);
  visit(navigation, current, 'finals');
  assert.equal(current.query, '');
  assert.equal(current.group, 'all');
});

test('reset clears current conditions while preserving the search mode and shared settings', () => {
  const navigation = new SearchNavigation(), current = state();
  Object.assign(current, {query: 'ɕ', searchMode: 'ipa', group: 'i', initial: 'x', rare: false});
  const expected = {...current, query: '', group: 'all', initial: 'all', rare: true};
  navigation.reset(current);
  assert.deepEqual(current, expected);
  visit(navigation, current, 'rules');
  visit(navigation, current, 'matrix');
  assert.deepEqual(current, expected);
});

test('restoring searches does not change the selected pronunciation or shared settings', () => {
  const navigation = new SearchNavigation(), current = state();
  current.query = 'ma1';
  const {selected, tone, thirdToneForm, thirdToneExpanded, ipa, voice, rate, settings} = current;
  const expected = {selected, tone, thirdToneForm, thirdToneExpanded, ipa, voice, rate, settings};
  visit(navigation, current, 'finals');
  current.query = 'ian';
  visit(navigation, current, 'initials');
  current.query = '無気音';
  visit(navigation, current, 'matrix');
  assert.equal(current.query, 'ma1');
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.equal(current[key], expected[key], key);
  }
});

test('selecting the current tab leaves the active search intact', () => {
  const navigation = new SearchNavigation(), current = state();
  Object.assign(current, {query: 'ŋ', searchMode: 'ipa', group: 'plain'});
  const before = {...current};
  navigation.transition(current, 'matrix');
  assert.deepEqual(current, before);
});

test('search controls identify the active reference and advertise supported kinds of input', () => {
  for (const tab of ['matrix', 'finals', 'initials'] as const) {
    const pinyin = searchPresentation(tab, 'pinyin'), ipa = searchPresentation(tab, 'ipa');
    assert.equal(pinyin.searchable, true);
    assert.equal(ipa.searchable, true);
    assert.notEqual(pinyin.placeholder, ipa.placeholder);
    assert.equal(pinyin.label, ipa.label);
  }
  assert.equal(searchPresentation('matrix', 'pinyin').label, '音節を検索');
  assert.equal(searchPresentation('finals', 'pinyin').label, '韻母を検索');
  assert.equal(searchPresentation('initials', 'pinyin').label, '声母を検索');
  assert.equal(searchPresentation('finals', 'pinyin').pinyinOption, 'ピンイン');
  for (const tab of ['compare', 'rules', 'vowels', 'erhua'] as const) {
    assert.equal(searchPresentation(tab, 'pinyin').searchable, false);
    assert.equal(searchPresentation(tab, 'ipa').searchable, false);
  }
});
