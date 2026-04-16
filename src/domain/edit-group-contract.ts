const EDIT_GROUP_ERROR_INVALID_STATE = 1;
const EDIT_GROUP_ERROR_UNKNOWN_TICK = 2;
const FIRST_EDIT_GROUP_ID = 1;
const FIRST_TICK_ID = 1;

export interface EditGroup {
  readonly id: number;
  readonly tickIds: readonly number[];
}

export interface OpenEditGroup {
  readonly id: number;
  readonly tickIds: readonly number[];
}

export interface EditGroupState {
  readonly knownTickIds: readonly number[];
  readonly groups: readonly EditGroup[];
  readonly openGroup?: OpenEditGroup;
}

export interface EditGroupReceipt {
  readonly groupId: number;
  readonly tickIds: readonly number[];
}

export interface EditGroupResult {
  readonly nextState: EditGroupState;
  readonly receipt?: EditGroupReceipt;
}

export class EditGroupContractError extends Error {
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.name = 'EditGroupContractError';
    this.code = code;
  }
}

export function createEditGroupState(
  knownTickIds: readonly number[] = [],
  groups: readonly EditGroup[] = [],
): EditGroupState {
  validateTickIds(knownTickIds);
  validateGroups(groups, knownTickIds);

  return {
    knownTickIds: [...knownTickIds],
    groups: groups.map(copyGroup),
  };
}

export function registerTick(state: EditGroupState, tickId: number): EditGroupState {
  validateState(state);
  validateTickId(tickId);

  if (state.knownTickIds.includes(tickId)) {
    return state;
  }

  const expectedTickId = nextSequentialTickId(state.knownTickIds);
  if (tickId !== expectedTickId) {
    throw new EditGroupContractError(
      EDIT_GROUP_ERROR_INVALID_STATE,
      'Edit-group state requires contiguous canonical tick ids.',
    );
  }

  return {
    knownTickIds: [...state.knownTickIds, tickId],
    groups: state.groups.map(copyGroup),
    openGroup: state.openGroup == null ? undefined : copyOpenGroup(state.openGroup),
  };
}

export function openEditGroup(state: EditGroupState): EditGroupState {
  validateState(state);

  if (state.openGroup != null) {
    return state;
  }

  return {
    knownTickIds: [...state.knownTickIds],
    groups: state.groups.map(copyGroup),
    openGroup: {
      id: nextGroupId(state.groups),
      tickIds: [],
    },
  };
}

export function includeTickInOpenGroup(state: EditGroupState, tickId: number): EditGroupState {
  validateState(state);
  validateTickId(tickId);

  if (!state.knownTickIds.includes(tickId)) {
    throw new EditGroupContractError(
      EDIT_GROUP_ERROR_UNKNOWN_TICK,
      'Edit groups may only contain known canonical ticks.',
    );
  }

  if (state.openGroup == null) {
    return state;
  }

  if (state.openGroup.tickIds.includes(tickId)) {
    return state;
  }

  return {
    knownTickIds: [...state.knownTickIds],
    groups: state.groups.map(copyGroup),
    openGroup: {
      id: state.openGroup.id,
      tickIds: [...state.openGroup.tickIds, tickId],
    },
  };
}

export function closeEditGroup(state: EditGroupState): EditGroupResult {
  validateState(state);

  if (state.openGroup == null) {
    return { nextState: state };
  }

  if (state.openGroup.tickIds.length === 0) {
    return {
      nextState: {
        knownTickIds: [...state.knownTickIds],
        groups: state.groups.map(copyGroup),
      },
    };
  }

  const closedGroup = {
    id: state.openGroup.id,
    tickIds: [...state.openGroup.tickIds],
  };

  return {
    nextState: {
      knownTickIds: [...state.knownTickIds],
      groups: [...state.groups.map(copyGroup), closedGroup],
    },
    receipt: {
      groupId: closedGroup.id,
      tickIds: [...closedGroup.tickIds],
    },
  };
}

function validateState(state: EditGroupState): void {
  validateTickIds(state.knownTickIds);
  validateGroups(state.groups, state.knownTickIds);

  if (state.openGroup != null) {
    validateGroupId(state.openGroup.id);
    validateTickIds(state.openGroup.tickIds);

    for (const tickId of state.openGroup.tickIds) {
      if (!state.knownTickIds.includes(tickId)) {
        throw new EditGroupContractError(
          EDIT_GROUP_ERROR_INVALID_STATE,
          'Open edit groups may only reference known canonical ticks.',
        );
      }
    }

    const expectedOpenGroupId = nextGroupId(state.groups);
    if (state.openGroup.id !== expectedOpenGroupId) {
      throw new EditGroupContractError(
        EDIT_GROUP_ERROR_INVALID_STATE,
        'Open edit groups require the next sequential group id.',
      );
    }
  }
}

function validateGroups(groups: readonly EditGroup[], knownTickIds: readonly number[]): void {
  let expectedGroupId = FIRST_EDIT_GROUP_ID;

  for (const group of groups) {
    validateGroupId(group.id);
    validateTickIds(group.tickIds);

    if (group.id !== expectedGroupId) {
      throw new EditGroupContractError(
        EDIT_GROUP_ERROR_INVALID_STATE,
        'Edit groups require contiguous positive group ids.',
      );
    }

    for (const tickId of group.tickIds) {
      if (!knownTickIds.includes(tickId)) {
        throw new EditGroupContractError(
          EDIT_GROUP_ERROR_INVALID_STATE,
          'Closed edit groups may only reference known canonical ticks.',
        );
      }
    }

    expectedGroupId += 1;
  }
}

function validateTickIds(tickIds: readonly number[]): void {
  let expectedTickId = FIRST_TICK_ID;

  for (const tickId of tickIds) {
    validateTickId(tickId);

    if (tickId < expectedTickId) {
      throw new EditGroupContractError(
        EDIT_GROUP_ERROR_INVALID_STATE,
        'Edit-group tick history must remain ordered.',
      );
    }

    expectedTickId = tickId + 1;
  }
}

function validateTickId(tickId: number): void {
  if (!Number.isInteger(tickId) || tickId < FIRST_TICK_ID) {
    throw new EditGroupContractError(
      EDIT_GROUP_ERROR_INVALID_STATE,
      'Edit-group state requires positive integer tick ids.',
    );
  }
}

function validateGroupId(groupId: number): void {
  if (!Number.isInteger(groupId) || groupId < FIRST_EDIT_GROUP_ID) {
    throw new EditGroupContractError(
      EDIT_GROUP_ERROR_INVALID_STATE,
      'Edit-group state requires positive integer group ids.',
    );
  }
}

function nextSequentialTickId(knownTickIds: readonly number[]): number {
  const lastTickId = knownTickIds[knownTickIds.length - 1];
  if (lastTickId == null) {
    return FIRST_TICK_ID;
  }
  return lastTickId + 1;
}

function nextGroupId(groups: readonly EditGroup[]): number {
  const lastGroup = groups[groups.length - 1];
  if (lastGroup == null) {
    return FIRST_EDIT_GROUP_ID;
  }
  return lastGroup.id + 1;
}

function copyGroup(group: EditGroup): EditGroup {
  return {
    id: group.id,
    tickIds: [...group.tickIds],
  };
}

function copyOpenGroup(group: OpenEditGroup): OpenEditGroup {
  return {
    id: group.id,
    tickIds: [...group.tickIds],
  };
}
