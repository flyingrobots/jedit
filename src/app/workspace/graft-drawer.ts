import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { graftVisibleOutlineRows } from '../../ui/workspace-render.js';
import { DRAWER_INNER_PAD } from './viewport.js';
import { clampIndex } from './viewport.js';
import { workspaceBodyHeight } from './viewport.js';
import { editorViewport, ensureEditorVisible } from './editor-session.js';
import type { GraftRefreshOptions } from './editor-session.js';
import { withFocusPane } from './focus.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import { WorkspaceKeys, isWorkspaceDownKey, isWorkspaceRefreshKey, isWorkspaceUpKey } from './workspace-key.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { graftProjectionPanelLaneRowCount, graftProjectionPanelLanes } from '../../ports/graft-projection-lanes.js';
import { projectionReviewPayloadLineCount } from '../../ui/projection-review-payload.js';
import type { GraftProjectionPanelLane } from '../../ports/graft-session.js';
import type { GraftProjectionLaneSource } from '../../ports/graft-projection-lanes.js';

const GRAFT_BASE_META_ROWS = 7;
const GRAFT_RECEIPT_BASE_ROWS = 3;
const GRAFT_RECEIPT_REASON_ROWS = 1;
const GRAFT_RECEIPT_PAYLOAD_ROWS = 3;
const GRAFT_RECEIPT_OMITTED_ROW = 1;
const GRAFT_CHANGE_ROWS = 5;

export function updateGraftDrawerFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  beginGraftRefresh: (model: WorkspaceModel, options: GraftRefreshOptions) => [WorkspaceModel, Cmd<WorkspaceMsg>[]],
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (isWorkspaceRefreshKey(msg)) {
    return beginGraftRefresh(model, { force: true });
  }

  const graftInfo = model.graftInfo;
  if (graftInfo == null) {
    return [model, []];
  }

  if (msg.key === WorkspaceKeys.Space) {
    return [toggleProjectionReviewPayload(model, graftInfo), []];
  }

  if (graftInfo.outlineItems.length === 0) {
    return [model, []];
  }

  const selectedIndex = updateGraftSelectionIndex(msg, model, graftInfo.outlineItems.length);
  if (selectedIndex != null) {
    return [{ ...model, graftSelectedIndex: selectedIndex }, []];
  }

  return msg.key === WorkspaceKeys.Enter && model.editor != null
    ? focusSelectedGraftItem(model)
    : [model, []];
}

function updateGraftSelectionIndex(
  msg: KeyMsg,
  model: WorkspaceModel,
  outlineLength: number,
): number | undefined {
  if (isWorkspaceDownKey(msg)) {
    return clampIndex(model.graftSelectedIndex + 1, outlineLength);
  }

  if (isWorkspaceUpKey(msg)) {
    return clampIndex(model.graftSelectedIndex - 1, outlineLength);
  }

  return updateGraftPageSelectionIndex(msg, model, outlineLength);
}

function updateGraftPageSelectionIndex(
  msg: KeyMsg,
  model: WorkspaceModel,
  outlineLength: number,
): number | undefined {
  const visible = graftVisibleOutlineRows(
    workspaceBodyHeight({
      rows: model.rows,
      footerVisible: model.footerVisible,
    }),
    DRAWER_INNER_PAD,
    graftMetaRows(model),
    GRAFT_CHANGE_ROWS,
  );

  if (msg.key === WorkspaceKeys.PageUp) {
    return clampIndex(model.graftSelectedIndex - visible, outlineLength);
  }

  if (msg.key === WorkspaceKeys.PageDown) {
    return clampIndex(model.graftSelectedIndex + visible, outlineLength);
  }

  return updateGraftExtremeSelectionIndex(msg, outlineLength);
}

function updateGraftExtremeSelectionIndex(msg: KeyMsg, outlineLength: number): number | undefined {
  if (isPlainGraftEdgeKey(msg)) {
    return 0;
  }

  if (isShiftGraftEdgeKey(msg)) {
    return outlineLength - 1;
  }

  return undefined;
}

function isPlainGraftEdgeKey(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && !msg.shift && msg.key === WorkspaceKeys.G;
}

function isShiftGraftEdgeKey(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && msg.shift && msg.key === WorkspaceKeys.G;
}

function toggleProjectionReviewPayload(model: WorkspaceModel, source: GraftProjectionLaneSource): WorkspaceModel {
  return {
    ...model,
    expandedProjectionLaneIndex: nextProjectionReviewPayloadIndex(
      graftProjectionPanelLanes(source),
      model.expandedProjectionLaneIndex,
    ),
  };
}

function nextProjectionReviewPayloadIndex(
  lanes: readonly GraftProjectionPanelLane[],
  currentIndex: number | undefined,
): number | undefined {
  const indices = lanes
    .flatMap((lane, index) => lane.reviewPayload == null ? [] : [index]);
  if (currentIndex == null) {
    return indices[0];
  }
  const offset = indices.indexOf(currentIndex);
  return offset >= 0 && offset < indices.length - 1
    ? indices[offset + 1]
    : undefined;
}

function graftMetaRows(model: WorkspaceModel): number {
  const info = model.graftInfo;
  const receipt = info?.obstructionReceipt;
  return GRAFT_BASE_META_ROWS
    + (info == null ? 0 : projectionLaneRowCount(info, model.expandedProjectionLaneIndex))
    + (receipt == null
      ? 0
      : GRAFT_RECEIPT_BASE_ROWS
        + (receipt.reasonKind == null ? 0 : GRAFT_RECEIPT_REASON_ROWS)
        + receiptPayloadRowCount(receipt.reasonPayload));
}

function projectionLaneRowCount(source: GraftProjectionLaneSource, expandedProjectionLaneIndex: number | undefined): number {
  return graftProjectionPanelLanes(source)
    .reduce((sum, lane, index) => sum + expandedProjectionLaneRowCount(lane, index, expandedProjectionLaneIndex), 0);
}

function expandedProjectionLaneRowCount(
  lane: GraftProjectionPanelLane,
  index: number,
  expandedProjectionLaneIndex: number | undefined,
): number {
  return graftProjectionPanelLaneRowCount(lane)
    + (expandedProjectionLaneIndex === index && lane.reviewPayload != null
      ? projectionReviewPayloadLineCount(lane.reviewPayload)
      : 0);
}

function receiptPayloadRowCount(
  payload: Readonly<Record<string, object | string | number | boolean | null>> | undefined,
): number {
  if (payload == null) {
    return 0;
  }

  const entryCount = Object.keys(payload).length;
  if (entryCount === 0) {
    return 1;
  }

  return Math.min(entryCount, GRAFT_RECEIPT_PAYLOAD_ROWS)
    + (entryCount > GRAFT_RECEIPT_PAYLOAD_ROWS ? GRAFT_RECEIPT_OMITTED_ROW : 0);
}

function focusSelectedGraftItem(model: WorkspaceModel): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const selected = model.graftInfo?.outlineItems[model.graftSelectedIndex];
  if (selected == null || model.editor == null) {
    return [model, []];
  }

  const viewport = editorViewport(model);
  const editor = ensureEditorVisible({
    ...model.editor,
    cursorRow: Math.max(0, selected.startLine - 1),
    cursorCol: 0,
  }, viewport.width, viewport.height);

  return [
    withFocusPane({
      ...model,
      editor,
    }, FocusPanes.Editor),
    [],
  ];
}
