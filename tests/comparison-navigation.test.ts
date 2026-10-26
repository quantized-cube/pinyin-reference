import test from 'node:test';
import assert from 'node:assert/strict';
import {ComparisonNavigation} from '../src/comparison-navigation.js';
import type {AppState, TabId} from '../src/types.js';

function state(): AppState {
  return {
    tab: 'matrix', query: '', searchMode: 'pinyin', group: 'all', initial: 'all', rare: true,
    selected: 'yan', tone: 3, thirdToneForm: 'half', thirdToneExpanded: true,
    comparePreset: 'an-ang', ipa: true, japaneseVowels: true, voice: 'preferred', rate: .9, settings: true,
  };
}

function visit(navigation: ComparisonNavigation, current: AppState, tab: TabId): void {
  const oldTab=current.tab;
  navigation.transition(current,tab);
  assert.equal(current.tab,oldTab,'the caller owns tab selection');
  current.tab=tab;
}

test('comparison preserves its detail separately from ordinary references and shared preferences', () => {
  const current=state(), navigation=new ComparisonNavigation();
  visit(navigation,current,'compare');
  assert.equal(navigation.detailOpen,false);
  navigation.showDetail();
  Object.assign(current,{selected:'an',tone:2,thirdToneForm:'full',thirdToneExpanded:false});
  visit(navigation,current,'finals');
  assert.equal(current.selected,'yan');
  assert.equal(current.tone,3);
  assert.equal(current.thirdToneForm,'half');
  assert.equal(current.thirdToneExpanded,true);
  Object.assign(current,{selected:'ma',tone:4,voice:'new-voice',rate:.7,ipa:false});
  visit(navigation,current,'rules');
  assert.equal(current.selected,'ma');
  visit(navigation,current,'compare');
  assert.equal(current.selected,'an');
  assert.equal(current.tone,2);
  assert.equal(current.thirdToneForm,'full');
  assert.equal(current.thirdToneExpanded,false);
  assert.equal(navigation.detailOpen,true);
  assert.equal(current.voice,'new-voice');
  assert.equal(current.rate,.7);
  assert.equal(current.ipa,false);
  navigation.closeDetail();
  visit(navigation,current,'matrix');
  assert.equal(current.selected,'ma');
  visit(navigation,current,'compare');
  assert.equal(navigation.detailOpen,false);
});

test('reselecting a comparison keeps detail open and a different preset closes it without changing its pronunciation', () => {
  const current=state(), navigation=new ComparisonNavigation();
  visit(navigation,current,'compare');navigation.showDetail();
  navigation.selectPreset(current,'an-ang');
  assert.equal(navigation.detailOpen,true);
  navigation.selectPreset(current,'si-shi-xi');
  assert.equal(navigation.detailOpen,false);
  assert.equal(current.comparePreset,'si-shi-xi');
  assert.equal(current.selected,'yan');
  assert.equal(current.tone,3);
  assert.equal(current.thirdToneForm,'half');
});
