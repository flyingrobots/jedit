export const TITLE_UNFREEZE_LABEL = 'title-unfreeze';

export const FROZEN_TITLE_PATH_PATTERNS = Object.freeze([
  /^src\/ui\/title/,
  /^src\/ui\/.*\.obj$/,
  /^src\/app\/title/,
  /^src\/app\/workspace\/title/,
  /^src\/adapters\/title/,
  /^src\/adapters\/raytracer-profiler\.ts$/,
  /^scripts\/title/,
]);

const FREEZE_POLICY_DOC = 'docs/method/backlog/leash/title-scene-freeze.md';

export function isFrozenTitlePath(pathName) {
  return FROZEN_TITLE_PATH_PATTERNS.some((pattern) => pattern.test(pathName));
}

export function evaluateFrozenPaths(paths, options) {
  const frozenPaths = [...new Set(paths.filter(isFrozenTitlePath))].sort();
  const allowed = frozenPaths.length === 0 || options.allowTitleChanges === true;

  return {
    allowed,
    frozenPaths,
    reason: allowed ? frozenReasonAllowed(frozenPaths) : frozenReasonBlocked(frozenPaths),
  };
}

function frozenReasonAllowed(frozenPaths) {
  if (frozenPaths.length === 0) {
    return 'no frozen title-scene paths changed';
  }
  return `frozen title-scene paths changed with the ${TITLE_UNFREEZE_LABEL} label`;
}

function frozenReasonBlocked(frozenPaths) {
  return [
    'the title scene is frozen: changed paths',
    frozenPaths.join(', '),
    `require the ${TITLE_UNFREEZE_LABEL} PR label (policy: ${FREEZE_POLICY_DOC})`,
  ].join(' ');
}
