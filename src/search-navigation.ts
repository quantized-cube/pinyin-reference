import type {AppState, SearchMode, TabId} from './types.js';

type SearchTab = 'matrix' | 'finals' | 'initials';
type SearchState = Pick<AppState, 'query' | 'searchMode' | 'group' | 'initial' | 'rare'>;

function isSearchTab(tab: TabId): tab is SearchTab {
  return tab === 'matrix' || tab === 'finals' || tab === 'initials';
}

function initialSearchState(): SearchState {
  return {query: '', searchMode: 'pinyin', group: 'all', initial: 'all', rare: true};
}

function captureSearch(state: AppState, tab: SearchTab): SearchState {
  return {
    query: state.query,
    searchMode: state.searchMode,
    group: tab === 'initials' ? 'all' : state.group,
    initial: tab === 'matrix' ? state.initial : 'all',
    rare: tab === 'matrix' ? state.rare : true,
  };
}

/** Search history for this page visit. Active fields remain compatible with the views. */
export class SearchNavigation {
  private readonly searches: Record<SearchTab, SearchState> = {
    matrix: initialSearchState(),
    finals: initialSearchState(),
    initials: initialSearchState(),
  };

  /** Call before assigning state.tab; restoring controls must not simulate user input. */
  transition(state: AppState, nextTab: TabId): void {
    if (state.tab === nextTab) return;
    if (isSearchTab(state.tab)) this.searches[state.tab] = captureSearch(state, state.tab);
    if (isSearchTab(nextTab)) Object.assign(state, this.searches[nextTab]);
  }

  reset(state: AppState): void {
    if (!isSearchTab(state.tab)) return;
    const reset = {...initialSearchState(), searchMode: state.searchMode};
    this.searches[state.tab] = reset;
    Object.assign(state, reset);
  }
}

interface SearchPresentation {
  searchable: boolean;
  label: string;
  placeholder: string;
  modeLabel: string;
  pinyinOption: string;
}

const presentation: Record<SearchTab, {label: string; pinyin: string; ipa: string}> = {
  matrix: {
    label: '音節を検索',
    pinyin: '例：xuan / nǚ / ma3 / 唇音',
    ipa: '例：pa / ɕ / ɥɛn',
  },
  finals: {
    label: '韻母を検索',
    pinyin: '例：ian / uen / xuan',
    ipa: '例：jɛn / y / ŋ',
  },
  initials: {
    label: '声母を検索',
    pinyin: '例：x / zh / 無気音',
    ipa: '例：pʰ / ɕ / ʈʂ',
  },
};

export function searchPresentation(tab: TabId, mode: SearchMode): SearchPresentation {
  const searchable = isSearchTab(tab);
  return {
    searchable,
    label: searchable ? presentation[tab].label : '検索',
    placeholder: searchable ? presentation[tab][mode] : '',
    modeLabel: '検索方式',
    pinyinOption: tab === 'finals' ? 'ピンイン' : 'ピンイン・用語',
  };
}
