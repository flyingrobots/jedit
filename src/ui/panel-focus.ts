export const FocusPanes = Object.freeze({
  Editor: 'editor',
  Files: 'files',
  Graft: 'graft',
} as const);

export type FocusPane = typeof FocusPanes[keyof typeof FocusPanes];

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
    return FocusPanes.Editor;
  }

  if (state.fileDrawerOpen) {
    return FocusPanes.Files;
  }

  if (state.graftDrawerOpen) {
    return FocusPanes.Graft;
  }

  return FocusPanes.Editor;
}

export function hasFocusablePeers(state: FocusCycleState): boolean {
  return visibleFocusPanes(state).length > 1;
}

export function shouldClearPendingNormalOnPaneChange(from: FocusPane, to: FocusPane): boolean {
  return from === FocusPanes.Editor && to !== FocusPanes.Editor;
}

export function visibleFocusPanes(state: FocusCycleState): readonly FocusPane[] {
  const panes: FocusPane[] = [];

  if (state.fileDrawerOpen) {
    panes.push(FocusPanes.Files);
  }

  if (state.hasEditor) {
    panes.push(FocusPanes.Editor);
  }

  if (state.graftDrawerOpen) {
    panes.push(FocusPanes.Graft);
  }

  return panes;
}

function firstVisiblePane(panes: readonly FocusPane[]): FocusPane {
  const pane = panes[0];
  if (pane == null) {
    return FocusPanes.Editor;
  }

  return pane;
}
