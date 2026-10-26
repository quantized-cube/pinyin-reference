import type {AppState, TabId} from './types.js';

type DetailSelection = Pick<AppState, 'selected' | 'tone' | 'thirdToneForm' | 'thirdToneExpanded'>;

function selection(state: AppState): DetailSelection {
  return {selected: state.selected, tone: state.tone, thirdToneForm: state.thirdToneForm, thirdToneExpanded: state.thirdToneExpanded};
}

/** Keep the comparison's detail separate from the ordinary reference selection. */
export class ComparisonNavigation {
  private reference: DetailSelection | undefined;
  private comparison: DetailSelection | undefined;
  private open = false;

  get detailOpen(): boolean { return this.open; }

  transition(state: AppState, nextTab: TabId): void {
    if (state.tab === nextTab) return;
    if (state.tab === 'compare') {
      this.comparison = selection(state);
      if (this.reference) Object.assign(state, this.reference);
    } else if (nextTab === 'compare') {
      this.reference = selection(state);
      // The initial selection stays available in the hidden detail DOM.
      this.comparison ??= selection(state);
      Object.assign(state, this.comparison);
    }
  }

  showDetail(): void { this.open = true; }
  closeDetail(): void { this.open = false; }

  selectPreset(state: AppState, preset: AppState['comparePreset']): void {
    if (state.comparePreset === preset) return;
    state.comparePreset = preset;
    this.closeDetail();
  }
}
