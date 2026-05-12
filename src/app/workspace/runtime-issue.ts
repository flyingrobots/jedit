import type { RuntimeIssueLevel, RuntimeIssueSource } from '@flyingrobots/bijou-tui';

const RUNTIME_ISSUE_LEVEL_ERROR: RuntimeIssueLevel = 'error';
const RUNTIME_ISSUE_LEVEL_WARNING: RuntimeIssueLevel = 'warning';
const RUNTIME_ISSUE_SOURCE_COMMAND: RuntimeIssueSource = 'command';
const RUNTIME_ISSUE_SOURCE_EVENTBUS: RuntimeIssueSource = 'eventbus';
const RUNTIME_ISSUE_SOURCE_RUNTIME: RuntimeIssueSource = 'runtime';
const WORKSPACE_RUNTIME_ISSUE_TYPE_SYSTEM = 'system';
const WORKSPACE_RUNTIME_ISSUE_NAME_SCENE_LOAD_ERROR = 'SceneLoadError';

export const RuntimeIssueLevels = Object.freeze({
  Error: RUNTIME_ISSUE_LEVEL_ERROR,
  Warning: RUNTIME_ISSUE_LEVEL_WARNING,
});

export const RuntimeIssueSources = Object.freeze({
  Command: RUNTIME_ISSUE_SOURCE_COMMAND,
  EventBus: RUNTIME_ISSUE_SOURCE_EVENTBUS,
  Runtime: RUNTIME_ISSUE_SOURCE_RUNTIME,
});

export const WorkspaceRuntimeIssueTypes = Object.freeze({
  System: WORKSPACE_RUNTIME_ISSUE_TYPE_SYSTEM,
});

export const WorkspaceRuntimeIssueNames = Object.freeze({
  SceneLoadError: WORKSPACE_RUNTIME_ISSUE_NAME_SCENE_LOAD_ERROR,
});
