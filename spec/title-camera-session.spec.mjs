import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const TITLE_CAMERA_PATH = path.join(
  REPO_ROOT,
  "dist",
  "app",
  "title-camera-session.js",
);
const SPRING_FRAME_DT = 1 / 60;
const SLOW_FRAME_DT = 1;
const SPRING_FRAME_LIMIT = 160;
const WORLD_CAMERA_POSITION = [0, 0.92, 2.25];
const WORLD_CAMERA_TARGET = [0, 0.8, 0];

let titleCameraSessionPromise;

async function loadTitleCameraSession() {
  if (titleCameraSessionPromise) {
    return titleCameraSessionPromise;
  }

  titleCameraSessionPromise = (async () => {
    await ensureDistBuilt();
    return import(pathToFileURL(TITLE_CAMERA_PATH).href);
  })();

  return titleCameraSessionPromise;
}

test("title camera arrow keys move targets through spring commands", async () => {
  const camera = await loadTitleCameraSession();
  const initial = camera.createTitleCameraState();
  const angleUpdate = camera.updateTitleCameraFromKey("right", initial);
  const radiusUpdate = camera.updateTitleCameraFromKey("up", angleUpdate.state);

  assert.equal(angleUpdate.state.angle, initial.angle);
  assert.equal(
    angleUpdate.state.angleTarget,
    initial.angleTarget + camera.TITLE_CAMERA_ANGLE_STEP,
  );
  assert.equal(angleUpdate.state.angleMotionId, initial.angleMotionId + 1);
  assert.equal(angleUpdate.commands.length, 1);

  assert.equal(radiusUpdate.state.radius, initial.radius);
  assert.equal(
    radiusUpdate.state.radiusTarget,
    initial.radiusTarget - camera.TITLE_CAMERA_RADIUS_STEP,
  );
  assert.equal(radiusUpdate.state.radiusMotionId, initial.radiusMotionId + 1);
  assert.equal(radiusUpdate.commands.length, 1);
});

test("title camera state preserves authored world-space placement", async () => {
  const camera = await loadTitleCameraSession();
  const initial = camera.createTitleCameraState({
    angle: 0,
    radius: 2.25,
    position: WORLD_CAMERA_POSITION,
    target: WORLD_CAMERA_TARGET,
  });

  assert.deepEqual(initial.position, WORLD_CAMERA_POSITION);
  assert.deepEqual(initial.target, WORLD_CAMERA_TARGET);
  assert.equal(initial.eyeY, WORLD_CAMERA_POSITION[1]);
});

test("title camera WASD translates through FPS view axes", async () => {
  const camera = await loadTitleCameraSession();
  const initial = camera.createTitleCameraState({
    angle: 0,
    radius: 2,
    position: [0, 1, 0],
    target: [0, 1, -2],
  });
  const forward = camera.updateTitleCameraFromKey("w", initial).state;
  const backward = camera.updateTitleCameraFromKey("s", initial).state;
  const left = camera.updateTitleCameraFromKey("a", initial).state;
  const right = camera.updateTitleCameraFromKey("d", initial).state;

  assert.ok(forward.position[2] < initial.position[2]);
  assert.ok(forward.target[2] < initial.target[2]);
  assert.ok(backward.position[2] > initial.position[2]);
  assert.ok(left.position[0] < initial.position[0]);
  assert.ok(right.position[0] > initial.position[0]);
  assert.equal(distance(forward.position, forward.target), 2);
});

test("title camera space jumps and shift toggles slower crouch movement", async () => {
  const camera = await loadTitleCameraSession();
  const initial = camera.createTitleCameraState({
    angle: 0,
    radius: 2,
    position: [0, 1, 0],
    target: [0, 1, -2],
  });
  const jumped = camera.updateTitleCameraFromKey("space", initial).state;
  const crouched = camera.updateTitleCameraFromKey("shift", initial).state;
  const walked = camera.updateTitleCameraFromKey("w", initial).state;
  const crouchWalked = camera.updateTitleCameraFromKey("w", crouched).state;
  const shiftWalked = camera.updateTitleCameraFromKey(
    "w",
    initial,
    { shift: true },
  ).state;

  assert.ok(jumped.position[1] > initial.position[1]);
  assert.equal(crouched.crouching, true);
  assert.equal(shiftWalked.crouching, true);
  assert.ok(crouched.position[1] < initial.position[1]);
  assert.ok(shiftWalked.position[1] < initial.position[1]);
  assert.ok(
    Math.abs(crouchWalked.position[2] - crouched.position[2]) <
      Math.abs(walked.position[2] - initial.position[2]),
  );
});

test("title camera mouse look rotates target while keeping eye fixed", async () => {
  const camera = await loadTitleCameraSession();
  const initial = camera.createTitleCameraState({
    angle: 0,
    radius: 2,
    position: [0, 1, 0],
    target: [0, 1, -2],
  });
  const anchored = camera.updateTitleCameraFromMouseLook(
    { col: 10, row: 10 },
    initial,
  );
  const rotated = camera.updateTitleCameraFromMouseLook(
    { col: 14, row: 12 },
    anchored.state,
    anchored.pointer,
  );

  assert.deepEqual(anchored.state, initial);
  assert.deepEqual(rotated.state.position, initial.position);
  assert.ok(rotated.state.target[0] > initial.target[0]);
  assert.ok(rotated.state.target[1] < initial.target[1]);
});

test("title camera spring config is critically damped", async () => {
  const camera = await loadTitleCameraSession();
  const expectedDamping =
    2 *
    Math.sqrt(
      camera.TITLE_CAMERA_SPRING.stiffness * camera.TITLE_CAMERA_SPRING.mass,
    );

  assert.equal(camera.TITLE_CAMERA_SPRING.damping, expectedDamping);
});

test("title camera ignores stale spring frames", async () => {
  const camera = await loadTitleCameraSession();
  const first = camera.updateTitleCameraFromKey(
    "right",
    camera.createTitleCameraState(),
  ).state;
  const second = camera.updateTitleCameraFromKey("right", first).state;
  const stale = camera.reduceTitleCameraMotion(second, {
    type: camera.TITLE_CAMERA_MESSAGE.Frame,
    axis: camera.TITLE_CAMERA_AXIS.Angle,
    motionId: first.angleMotionId,
    value: first.angleTarget,
  });
  const current = camera.reduceTitleCameraMotion(second, {
    type: camera.TITLE_CAMERA_MESSAGE.Frame,
    axis: camera.TITLE_CAMERA_AXIS.Angle,
    motionId: second.angleMotionId,
    value: second.angleTarget / 2,
  });

  assert.deepEqual(stale, second);
  assert.equal(current.angle, second.angleTarget / 2);
  assert.notDeepEqual(current.position, second.position);
});

test("title camera spring command emits interpolated frames before target", async () => {
  const camera = await loadTitleCameraSession();
  const update = camera.updateTitleCameraFromKey(
    "right",
    camera.createTitleCameraState(),
  );
  const frames = await runSpringCommand(update.commands[0]);
  const firstFrame = frames.find(
    (frame) => frame.type === camera.TITLE_CAMERA_MESSAGE.Frame,
  );
  const finalFrame = frames.at(-1);

  assert.ok(firstFrame.value > 0);
  assert.ok(firstFrame.value < update.state.angleTarget);
  assert.equal(finalFrame.value, update.state.angleTarget);
});

test("title camera spring command remains bounded under slow pulse frames", async () => {
  const camera = await loadTitleCameraSession();
  const update = camera.updateTitleCameraFromKey(
    "right",
    camera.createTitleCameraState(),
  );
  const frames = await runSpringCommand(update.commands[0], SLOW_FRAME_DT);
  const values = frames
    .filter((frame) => frame.type === camera.TITLE_CAMERA_MESSAGE.Frame)
    .map((frame) => frame.value);

  assert.ok(values.length > 0);
  assert.ok(values.every((value) => value >= 0));
  assert.ok(values.every((value) => value <= update.state.angleTarget));
  assert.ok(values[0] < update.state.angleTarget);
  assert.equal(values.at(-1), update.state.angleTarget);
});

async function runSpringCommand(command, dt = SPRING_FRAME_DT) {
  const frames = [];
  let pulseHandler;
  let disposed = false;
  const result = command((msg) => frames.push(msg), {
    onPulse(handler) {
      pulseHandler = handler;
      return {
        dispose() {
          disposed = true;
        },
      };
    },
  });

  assert.equal(typeof pulseHandler, "function");

  for (let frame = 0; frame < SPRING_FRAME_LIMIT && !disposed; frame += 1) {
    pulseHandler(dt);
  }

  assert.equal(disposed, true);
  await result;
  return frames;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
