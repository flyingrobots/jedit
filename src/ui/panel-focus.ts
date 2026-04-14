export type FocusPane = 'editor' | 'files' | 'graft';

export interface FocusCycleState {
  readonly fileDrawerOpen: boolean;
  readonly graftDrawerOpen: boolean;
  readonly hasEditor: boolean;
  readonly focusPane: FocusPane;
}

export function cycleFocusPane(state: FocusCycleState): FocusPane {
  const panes = visibleFocusPanes(state);
  if (panes.length === 0) {
    return state.focusPane;
  }

  const index = panes.indexOf(state.focusPane);
  if (index < 0) {
    return firstVisiblePane(panes);
  }

  return panes[(index + 1) % panes.length] ?? firstVisiblePane(panes);
}

export function defaultFocusPane(state: Omit<FocusCycleState, 'focusPane'>): FocusPane {
  if (state.hasEditor) {
    return 'editor';
  }

  if (state.fileDrawerOpen) {
    return 'files';
  }

  if (state.graftDrawerOpen) {
    return 'graft';
  }

  return 'editor';
}

export function hasFocusablePeers(state: FocusCycleState): boolean {
  return visibleFocusPanes(state).length > 1;
}

export function visibleFocusPanes(state: FocusCycleState): readonly FocusPane[] {
  const panes: FocusPane[] = [];

  if (state.fileDrawerOpen) {
    panes.push('files');
  }

  if (state.hasEditor) {
    panes.push('editor');
  }

  if (state.graftDrawerOpen) {
    panes.push('graft');
  }

  return panes;
}

function firstVisiblePane(panes: readonly FocusPane[]): FocusPane {
  const pane = panes[0];
  if (pane == null) {
    return 'editor';
  }

  return pane;
}
