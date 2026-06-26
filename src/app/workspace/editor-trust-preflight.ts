const REPORT_SCHEMA = 'jedit.editor-trust-preflight.v1';
const CYCLE_ID = 'WF-0108';
const SLICE_ID = 0;
const REPORT_STATUS_READY = 'ready';
const REPORT_STATUS_BLOCKED = 'blocked';
const GATE_STATUS_PASSED = 'passed';
const GATE_STATUS_BLOCKED = 'blocked';
const GATE_STATUS_SCOPED = 'scoped';
const GATE_OPEN_EDIT_SAVE_DISK = 'open-edit-save-disk';
const GATE_QUIT_CONFIRMATION = 'quit-confirmation';
const GATE_DIRTY_QUIT_GUARD = 'dirty-quit-guard';
const GATE_DIRTY_FILE_SWITCH_GUARD = 'dirty-file-switch-guard';
const GATE_SEARCH_ENTRY = 'slash-question-search-entry';
const GATE_SINGLE_BUFFER_POSTURE = 'single-buffer-posture';
const PASS_OPEN_EDIT_SAVE =
  'Open, edit, save, and disk output route through production text authority.';
const PASS_QUIT_CONFIRMATION =
  'Plain quit requires confirmation and forced quit remains explicit.';
const BLOCK_DIRTY_QUIT =
  'Dirty quit currently uses the generic quit confirmation instead of a dirty-specific guardrail.';
const BLOCK_DIRTY_SWITCH =
  'Dirty file switches can start a replacement open without first resolving unsaved changes.';
const BLOCK_SEARCH_ENTRY =
  'Repeat-search facts exist for n/N, but / and ? search entry is not product-complete.';
const SCOPED_SINGLE_BUFFER =
  'The current product posture is single-buffer; multi-buffer behavior is not claimed.';
const NEXT_ACTION =
  'Fix or explicitly scope blocked trust gates before starting WF-0108 Slice 1 command provenance.';
const EVIDENCE_OPEN = 'production-open';
const EVIDENCE_EDIT = 'production-edit';
const EVIDENCE_EXPORT = 'production-export';
const EVIDENCE_DISK = 'disk-write';
const EVIDENCE_QUIT_CONFIRM = 'quit-confirmation';
const EVIDENCE_FORCE_QUIT = 'force-quit';
const EVIDENCE_DIRTY_STATE = 'dirty-state';
const EVIDENCE_DIRTY_SWITCH = 'dirty-switch-attempt';
const EVIDENCE_SEARCH = 'search-entry-attempt';
const EVIDENCE_BUFFER_MODEL = 'workspace-buffer-model';

export const EditorTrustPreflightReportStatuses = Object.freeze({
  Ready: REPORT_STATUS_READY,
  Blocked: REPORT_STATUS_BLOCKED,
} as const);

export const EditorTrustPreflightGateStatuses = Object.freeze({
  Passed: GATE_STATUS_PASSED,
  Blocked: GATE_STATUS_BLOCKED,
  Scoped: GATE_STATUS_SCOPED,
} as const);

export type EditorTrustPreflightReportStatus =
  typeof EditorTrustPreflightReportStatuses[keyof typeof EditorTrustPreflightReportStatuses];

export type EditorTrustPreflightGateStatus =
  typeof EditorTrustPreflightGateStatuses[keyof typeof EditorTrustPreflightGateStatuses];

export interface EditorTrustPreflightObservation {
  readonly openUsesProductionAuthority: boolean;
  readonly editUsesProductionAuthority: boolean;
  readonly saveExportsProductionText: boolean;
  readonly diskOutputVerified: boolean;
  readonly quitRequiresConfirmation: boolean;
  readonly forceQuitAvailable: boolean;
  readonly dirtyStateTracked: boolean;
  readonly dirtyQuitHasDirtySpecificGuard: boolean;
  readonly dirtyFileSwitchBlocked: boolean;
  readonly slashSearchEntryAvailable: boolean;
  readonly questionSearchEntryAvailable: boolean;
  readonly hasMultipleOpenBuffers: boolean;
}

export interface EditorTrustPreflightGate {
  readonly id: string;
  readonly status: EditorTrustPreflightGateStatus;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly blocker?: string;
}

export interface EditorTrustPreflightReport {
  readonly schema: typeof REPORT_SCHEMA;
  readonly cycle: typeof CYCLE_ID;
  readonly slice: typeof SLICE_ID;
  readonly status: EditorTrustPreflightReportStatus;
  readonly gates: readonly EditorTrustPreflightGate[];
  readonly blockers: readonly EditorTrustPreflightGate[];
  readonly nextAction: typeof NEXT_ACTION;
}

export function createEditorTrustPreflightReport(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightReport {
  const gates = [
    openEditSaveDiskGate(observation),
    quitConfirmationGate(observation),
    dirtyQuitGate(observation),
    dirtyFileSwitchGate(observation),
    searchEntryGate(observation),
    singleBufferGate(observation),
  ];
  const blockers = gates.filter((gate) => gate.status === GATE_STATUS_BLOCKED);
  return {
    schema: REPORT_SCHEMA,
    cycle: CYCLE_ID,
    slice: SLICE_ID,
    status: blockers.length === 0 ? REPORT_STATUS_READY : REPORT_STATUS_BLOCKED,
    gates,
    blockers,
    nextAction: NEXT_ACTION,
  };
}

export function currentEditorTrustPreflightReport(): EditorTrustPreflightReport {
  return createEditorTrustPreflightReport(currentPreflightObservation());
}

export function currentPreflightObservation(): EditorTrustPreflightObservation {
  return {
    openUsesProductionAuthority: true,
    editUsesProductionAuthority: true,
    saveExportsProductionText: true,
    diskOutputVerified: true,
    quitRequiresConfirmation: true,
    forceQuitAvailable: true,
    dirtyStateTracked: true,
    dirtyQuitHasDirtySpecificGuard: false,
    dirtyFileSwitchBlocked: false,
    slashSearchEntryAvailable: false,
    questionSearchEntryAvailable: false,
    hasMultipleOpenBuffers: false,
  };
}

function openEditSaveDiskGate(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightGate {
  const passed =
    observation.openUsesProductionAuthority &&
    observation.editUsesProductionAuthority &&
    observation.saveExportsProductionText &&
    observation.diskOutputVerified;
  return gate({
    id: GATE_OPEN_EDIT_SAVE_DISK,
    status: passed ? GATE_STATUS_PASSED : GATE_STATUS_BLOCKED,
    summary: PASS_OPEN_EDIT_SAVE,
    evidence: [EVIDENCE_OPEN, EVIDENCE_EDIT, EVIDENCE_EXPORT, EVIDENCE_DISK],
  });
}

function quitConfirmationGate(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightGate {
  const passed = observation.quitRequiresConfirmation && observation.forceQuitAvailable;
  return gate({
    id: GATE_QUIT_CONFIRMATION,
    status: passed ? GATE_STATUS_PASSED : GATE_STATUS_BLOCKED,
    summary: PASS_QUIT_CONFIRMATION,
    evidence: [EVIDENCE_QUIT_CONFIRM, EVIDENCE_FORCE_QUIT],
  });
}

function dirtyQuitGate(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightGate {
  const passed = observation.dirtyStateTracked && observation.dirtyQuitHasDirtySpecificGuard;
  return gate({
    id: GATE_DIRTY_QUIT_GUARD,
    status: passed ? GATE_STATUS_PASSED : GATE_STATUS_BLOCKED,
    summary: BLOCK_DIRTY_QUIT,
    evidence: [EVIDENCE_DIRTY_STATE, EVIDENCE_QUIT_CONFIRM],
    blocker: passed ? undefined : BLOCK_DIRTY_QUIT,
  });
}

function dirtyFileSwitchGate(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightGate {
  return gate({
    id: GATE_DIRTY_FILE_SWITCH_GUARD,
    status: observation.dirtyFileSwitchBlocked ? GATE_STATUS_PASSED : GATE_STATUS_BLOCKED,
    summary: BLOCK_DIRTY_SWITCH,
    evidence: [EVIDENCE_DIRTY_STATE, EVIDENCE_DIRTY_SWITCH],
    blocker: observation.dirtyFileSwitchBlocked ? undefined : BLOCK_DIRTY_SWITCH,
  });
}

function searchEntryGate(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightGate {
  const passed =
    observation.slashSearchEntryAvailable &&
    observation.questionSearchEntryAvailable;
  return gate({
    id: GATE_SEARCH_ENTRY,
    status: passed ? GATE_STATUS_PASSED : GATE_STATUS_BLOCKED,
    summary: BLOCK_SEARCH_ENTRY,
    evidence: [EVIDENCE_SEARCH],
    blocker: passed ? undefined : BLOCK_SEARCH_ENTRY,
  });
}

function singleBufferGate(
  observation: EditorTrustPreflightObservation,
): EditorTrustPreflightGate {
  return gate({
    id: GATE_SINGLE_BUFFER_POSTURE,
    status: observation.hasMultipleOpenBuffers ? GATE_STATUS_PASSED : GATE_STATUS_SCOPED,
    summary: SCOPED_SINGLE_BUFFER,
    evidence: [EVIDENCE_BUFFER_MODEL],
  });
}

function gate(gateValue: EditorTrustPreflightGate): EditorTrustPreflightGate {
  return gateValue.blocker == null
    ? {
        id: gateValue.id,
        status: gateValue.status,
        summary: gateValue.summary,
        evidence: gateValue.evidence,
      }
    : gateValue;
}
