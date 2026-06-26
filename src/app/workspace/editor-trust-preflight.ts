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
const BLOCK_OPEN_EDIT_SAVE =
  'Open, edit, save, or disk output is not routed through production text authority.';
const PASS_QUIT_CONFIRMATION =
  'Plain quit requires confirmation and forced quit remains explicit.';
const BLOCK_QUIT_CONFIRMATION =
  'Plain quit confirmation or explicit forced quit behavior is not available.';
const PASS_DIRTY_QUIT = 'Dirty quit uses a dirty-specific guardrail.';
const BLOCK_DIRTY_QUIT =
  'Dirty quit currently uses the generic quit confirmation instead of a dirty-specific guardrail.';
const PASS_DIRTY_SWITCH =
  'Dirty file switches resolve unsaved changes before opening a replacement file.';
const BLOCK_DIRTY_SWITCH =
  'Dirty file switches can start a replacement open without first resolving unsaved changes.';
const PASS_SEARCH_ENTRY = 'Both / and ? search entry are product-complete.';
const BLOCK_SEARCH_ENTRY =
  'Repeat-search facts exist for n/N, but / and ? search entry is not product-complete.';
const PASS_SINGLE_BUFFER =
  'Multi-buffer behavior is supported and explicitly claimed.';
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

interface EditorTrustPreflightReportStatusToken {
  readonly value: EditorTrustPreflightReportStatus;
}

interface EditorTrustPreflightGateStatusToken {
  readonly value: EditorTrustPreflightGateStatus;
}

const REPORT_STATUS = Object.freeze({
  Ready: Object.freeze({ value: REPORT_STATUS_READY }),
  Blocked: Object.freeze({ value: REPORT_STATUS_BLOCKED }),
} as const);

const GATE_STATUS = Object.freeze({
  Passed: Object.freeze({ value: GATE_STATUS_PASSED }),
  Blocked: Object.freeze({ value: GATE_STATUS_BLOCKED }),
  Scoped: Object.freeze({ value: GATE_STATUS_SCOPED }),
} as const);

type InternalGateStatus = typeof GATE_STATUS[keyof typeof GATE_STATUS];

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

export interface EditorTrustPreflightProbe {
  readonly observe: () =>
    | EditorTrustPreflightObservation
    | Promise<EditorTrustPreflightObservation>;
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

interface InternalEditorTrustPreflightGate {
  readonly id: string;
  readonly status: InternalGateStatus;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly blocker?: string;
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
  const blockers = gates.filter(isBlockedGate);
  return {
    schema: REPORT_SCHEMA,
    cycle: CYCLE_ID,
    slice: SLICE_ID,
    status: encodeReportStatus(blockers.length === 0 ? REPORT_STATUS.Ready : REPORT_STATUS.Blocked),
    gates: gates.map(encodeGate),
    blockers: blockers.map(encodeGate),
    nextAction: NEXT_ACTION,
  };
}

export function createEditorTrustPreflightReporter(
  probe: EditorTrustPreflightProbe,
): {
  readonly currentObservation: () => Promise<EditorTrustPreflightObservation>;
  readonly currentReport: () => Promise<EditorTrustPreflightReport>;
} {
  return Object.freeze({
    currentObservation: () => currentPreflightObservation(probe),
    currentReport: () => currentEditorTrustPreflightReport(probe),
  });
}

export async function currentEditorTrustPreflightReport(
  probe: EditorTrustPreflightProbe,
): Promise<EditorTrustPreflightReport> {
  return createEditorTrustPreflightReport(await currentPreflightObservation(probe));
}

export async function currentPreflightObservation(
  probe: EditorTrustPreflightProbe,
): Promise<EditorTrustPreflightObservation> {
  return probe.observe();
}

function openEditSaveDiskGate(
  observation: EditorTrustPreflightObservation,
): InternalEditorTrustPreflightGate {
  const passed =
    observation.openUsesProductionAuthority &&
    observation.editUsesProductionAuthority &&
    observation.saveExportsProductionText &&
    observation.diskOutputVerified;
  return gate({
    id: GATE_OPEN_EDIT_SAVE_DISK,
    status: passed ? GATE_STATUS.Passed : GATE_STATUS.Blocked,
    summary: passed ? PASS_OPEN_EDIT_SAVE : BLOCK_OPEN_EDIT_SAVE,
    evidence: [EVIDENCE_OPEN, EVIDENCE_EDIT, EVIDENCE_EXPORT, EVIDENCE_DISK],
    blocker: passed ? undefined : BLOCK_OPEN_EDIT_SAVE,
  });
}

function quitConfirmationGate(
  observation: EditorTrustPreflightObservation,
): InternalEditorTrustPreflightGate {
  const passed = observation.quitRequiresConfirmation && observation.forceQuitAvailable;
  return gate({
    id: GATE_QUIT_CONFIRMATION,
    status: passed ? GATE_STATUS.Passed : GATE_STATUS.Blocked,
    summary: passed ? PASS_QUIT_CONFIRMATION : BLOCK_QUIT_CONFIRMATION,
    evidence: [EVIDENCE_QUIT_CONFIRM, EVIDENCE_FORCE_QUIT],
    blocker: passed ? undefined : BLOCK_QUIT_CONFIRMATION,
  });
}

function dirtyQuitGate(
  observation: EditorTrustPreflightObservation,
): InternalEditorTrustPreflightGate {
  const passed = observation.dirtyStateTracked && observation.dirtyQuitHasDirtySpecificGuard;
  return gate({
    id: GATE_DIRTY_QUIT_GUARD,
    status: passed ? GATE_STATUS.Passed : GATE_STATUS.Blocked,
    summary: passed ? PASS_DIRTY_QUIT : BLOCK_DIRTY_QUIT,
    evidence: [EVIDENCE_DIRTY_STATE, EVIDENCE_QUIT_CONFIRM],
    blocker: passed ? undefined : BLOCK_DIRTY_QUIT,
  });
}

function dirtyFileSwitchGate(
  observation: EditorTrustPreflightObservation,
): InternalEditorTrustPreflightGate {
  const passed = observation.dirtyFileSwitchBlocked;
  return gate({
    id: GATE_DIRTY_FILE_SWITCH_GUARD,
    status: passed ? GATE_STATUS.Passed : GATE_STATUS.Blocked,
    summary: passed ? PASS_DIRTY_SWITCH : BLOCK_DIRTY_SWITCH,
    evidence: [EVIDENCE_DIRTY_STATE, EVIDENCE_DIRTY_SWITCH],
    blocker: passed ? undefined : BLOCK_DIRTY_SWITCH,
  });
}

function searchEntryGate(
  observation: EditorTrustPreflightObservation,
): InternalEditorTrustPreflightGate {
  const passed =
    observation.slashSearchEntryAvailable &&
    observation.questionSearchEntryAvailable;
  return gate({
    id: GATE_SEARCH_ENTRY,
    status: passed ? GATE_STATUS.Passed : GATE_STATUS.Blocked,
    summary: passed ? PASS_SEARCH_ENTRY : BLOCK_SEARCH_ENTRY,
    evidence: [EVIDENCE_SEARCH],
    blocker: passed ? undefined : BLOCK_SEARCH_ENTRY,
  });
}

function singleBufferGate(
  observation: EditorTrustPreflightObservation,
): InternalEditorTrustPreflightGate {
  const passed = observation.hasMultipleOpenBuffers;
  return gate({
    id: GATE_SINGLE_BUFFER_POSTURE,
    status: passed ? GATE_STATUS.Passed : GATE_STATUS.Scoped,
    summary: passed ? PASS_SINGLE_BUFFER : SCOPED_SINGLE_BUFFER,
    evidence: [EVIDENCE_BUFFER_MODEL],
  });
}

function gate(
  gateValue: InternalEditorTrustPreflightGate,
): InternalEditorTrustPreflightGate {
  return gateValue.blocker == null
    ? {
        id: gateValue.id,
        status: gateValue.status,
        summary: gateValue.summary,
        evidence: gateValue.evidence,
      }
    : gateValue;
}

function isBlockedGate(gateValue: InternalEditorTrustPreflightGate): boolean {
  return gateValue.status === GATE_STATUS.Blocked;
}

function encodeGate(
  gateValue: InternalEditorTrustPreflightGate,
): EditorTrustPreflightGate {
  return gateValue.blocker == null
    ? {
        id: gateValue.id,
        status: encodeGateStatus(gateValue.status),
        summary: gateValue.summary,
        evidence: gateValue.evidence,
      }
    : {
        id: gateValue.id,
        status: encodeGateStatus(gateValue.status),
        summary: gateValue.summary,
        evidence: gateValue.evidence,
        blocker: gateValue.blocker,
      };
}

function encodeReportStatus(
  status: EditorTrustPreflightReportStatusToken,
): EditorTrustPreflightReportStatus {
  return status.value;
}

function encodeGateStatus(
  status: EditorTrustPreflightGateStatusToken,
): EditorTrustPreflightGateStatus {
  return status.value;
}
