import {
  animate,
  type Cmd,
  type SpringConfig,
} from '@flyingrobots/bijou-tui';
import { createNotificationTickCmd } from '../ui/feedback.js';
import type { DrawerKind } from '../ui/drawer-layout.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from '../app/workspace/msg.js';

const INITIAL_TIME_SECONDS = 0;
const DRAWER_DURATION_MS = 160;
const STARTUP_FILE_DRAWER_SPRING_MASS = 1;
const STARTUP_FILE_DRAWER_SPRING_STIFFNESS = 170;
const STARTUP_FILE_DRAWER_SPRING_PRECISION = 0.001;
export const STARTUP_FILE_DRAWER_SPRING = {
  mass: STARTUP_FILE_DRAWER_SPRING_MASS,
  stiffness: STARTUP_FILE_DRAWER_SPRING_STIFFNESS,
  damping:
    2 *
    Math.sqrt(
      STARTUP_FILE_DRAWER_SPRING_STIFFNESS * STARTUP_FILE_DRAWER_SPRING_MASS,
    ),
  precision: STARTUP_FILE_DRAWER_SPRING_PRECISION,
} satisfies SpringConfig;

export function createWorkspaceTimeTickCmd(): Cmd<WorkspaceMsg> {
  return (emit, capabilities) => {
    let timeSeconds = INITIAL_TIME_SECONDS;
    return capabilities.onPulse((dt) => {
      timeSeconds += dt;
      emit({
        type: WorkspaceMessageTypes.TimeTick,
        time: timeSeconds,
      });
    });
  };
}

export function createWorkspaceNotificationTickCmd(): Cmd<WorkspaceMsg> {
  return createNotificationTickCmd((atMs) => ({
    type: WorkspaceMessageTypes.NotificationTick,
    atMs,
  }));
}

export function createWorkspaceDrawerAnimationCmd(
  kind: DrawerKind,
  from: number,
  to: number,
): Cmd<WorkspaceMsg>[] {
  return [
    animate<WorkspaceMsg>({
      type: 'tween',
      from,
      to,
      duration: DRAWER_DURATION_MS,
      onFrame: (value) => ({ type: WorkspaceMessageTypes.DrawerProgress, kind, value }),
    }),
  ];
}

export function createStartupFileDrawerAnimationCmd(
  from: number,
  to: number,
): Cmd<WorkspaceMsg>[] {
  return [
    animate<WorkspaceMsg>({
      from,
      to,
      spring: STARTUP_FILE_DRAWER_SPRING,
      onFrame: (value) => ({
        type: WorkspaceMessageTypes.StartupFileDrawerProgress,
        value,
      }),
    }),
  ];
}
