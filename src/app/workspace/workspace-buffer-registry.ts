import type { GraftInfo } from '../../ports/graft-session.js';
import type { SourceHighlightReading } from '../../ports/source-highlighter.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import type { EditorState } from './editor/model.js';
import type { WorkspaceModel } from './model.js';
import { ViewModes } from './view-mode.js';
import {
  WorkspaceTextAuthorityKinds,
  type WorkspaceTextAuthorityOpened,
} from './workspace-text-authority.js';
import type { WorkspaceMaterializationKind } from './workspace-materialization.js';

export interface WorkspaceBufferRecord {
  readonly bufferId: string;
  readonly pathBinding: string;
  readonly textAuthority: WorkspaceTextAuthorityOpened;
  readonly editorProjection: EditorState;
  readonly materializationState: WorkspaceMaterializationKind;
  readonly sourceHighlight?: SourceHighlightReading;
  readonly graftInfo?: GraftInfo;
  readonly graftSelectedIndex: number;
  readonly lastActivatedAt: number;
}

export type WorkspaceBufferRegistry = Readonly<Record<string, WorkspaceBufferRecord>>;

export function emptyWorkspaceBufferRegistry(): WorkspaceBufferRegistry {
  return {};
}

export function findWorkspaceBufferRecordByPath(
  model: WorkspaceModel,
  pathBinding: string,
): WorkspaceBufferRecord | undefined {
  return Object.values(workspaceBuffers(model)).find((record) => record.pathBinding === pathBinding);
}

export function clearActiveWorkspaceBuffer(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    activeBufferId: undefined,
    editor: undefined,
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
    graftInfo: undefined,
    graftLoading: false,
    graftSelectedIndex: 0,
    expandedProjectionLaneIndex: undefined,
  };
}

export function activateWorkspaceBufferRecord(
  model: WorkspaceModel,
  record: WorkspaceBufferRecord,
  atMs: number,
): WorkspaceModel {
  const activated = {
    ...record,
    lastActivatedAt: atMs,
  };
  return {
    ...model,
    activeBufferId: record.bufferId,
    buffers: {
      ...workspaceBuffers(model),
      [record.bufferId]: activated,
    },
    editor: record.editorProjection,
    textAuthority: record.textAuthority,
    viewMode: ViewModes.Source,
    focusPane: FocusPanes.Editor,
    sourceHighlight: record.sourceHighlight,
    sourceHighlightLoading: false,
    graftInfo: record.graftInfo,
    graftLoading: false,
    graftSelectedIndex: record.graftSelectedIndex,
    expandedProjectionLaneIndex: undefined,
  };
}

export function syncActiveWorkspaceBufferRecord(model: WorkspaceModel): WorkspaceModel {
  const record = activeWorkspaceBufferRecord(model);
  if (record == null) {
    return model;
  }
  const buffers = workspaceBuffers(model);
  const existing = buffers[record.bufferId];
  if (model.activeBufferId === record.bufferId && sameWorkspaceBufferRecord(existing, record)) {
    return model;
  }
  return {
    ...model,
    activeBufferId: record.bufferId,
    buffers: {
      ...buffers,
      [record.bufferId]: record,
    },
  };
}

function activeWorkspaceBufferRecord(model: WorkspaceModel): WorkspaceBufferRecord | undefined {
  const authority = model.textAuthority;
  const editor = model.editor;
  if (authority?.kind !== WorkspaceTextAuthorityKinds.Opened || editor == null) {
    return undefined;
  }
  const existing = workspaceBuffers(model)[authority.bufferId];
  return {
    bufferId: authority.bufferId,
    pathBinding: authority.filePath,
    textAuthority: authority,
    editorProjection: editor,
    materializationState: authority.materialization,
    sourceHighlight: sourceHighlightForEditor(model, editor),
    graftInfo: graftInfoForEditor(model, editor),
    graftSelectedIndex: model.graftSelectedIndex,
    lastActivatedAt: existing?.lastActivatedAt ?? model.time,
  };
}

function workspaceBuffers(model: WorkspaceModel): WorkspaceBufferRegistry {
  return model.buffers ?? emptyWorkspaceBufferRegistry();
}

function sourceHighlightForEditor(
  model: WorkspaceModel,
  editor: EditorState,
): SourceHighlightReading | undefined {
  return model.sourceHighlight?.path === editor.path ? model.sourceHighlight : undefined;
}

function graftInfoForEditor(model: WorkspaceModel, editor: EditorState): GraftInfo | undefined {
  return model.graftInfo?.path === editor.path ? model.graftInfo : undefined;
}

function sameWorkspaceBufferRecord(
  existing: WorkspaceBufferRecord | undefined,
  next: WorkspaceBufferRecord,
): boolean {
  if (existing == null) {
    return false;
  }
  return [
    existing.pathBinding === next.pathBinding,
    existing.textAuthority === next.textAuthority,
    existing.editorProjection === next.editorProjection,
    existing.materializationState === next.materializationState,
    existing.sourceHighlight === next.sourceHighlight,
    existing.graftInfo === next.graftInfo,
    existing.graftSelectedIndex === next.graftSelectedIndex,
    existing.lastActivatedAt === next.lastActivatedAt,
  ].every(Boolean);
}
