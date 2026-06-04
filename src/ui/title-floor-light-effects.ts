import {
  intersectsTitleSceneObjectAlongRay,
  titleSceneObjectFootprintCenter,
  type TitleSceneObject,
  type TitleSceneVector3,
} from "./title-scene.js";
import type { TitleFloorLightEffects } from "./title-screen.js";

type Vector3 = TitleSceneVector3;

const SHADOW_RAY_BIAS = 0.03;
const FLOOR_SHADOW_MULTIPLIER = 0.34;
const CONTACT_SHADOW_RADIUS_SCALE = 1.32;
const CONTACT_SHADOW_STRENGTH = 0.72;
const CONTACT_SHADOW_POWER = 1.75;
const CONTACT_SHADOW_MIN_MULTIPLIER = 0.18;
const CAUSTIC_RADIUS_SCALE = 2.4;
const CAUSTIC_WAVE_FREQUENCY = 3.1;
const CAUSTIC_WAVE_SECONDARY_FREQUENCY = 1.7;
const CAUSTIC_TIME_RATE = 0.9;
const CAUSTIC_STRENGTH = 0.45;
const MAX_CAUSTIC_STRENGTH = 0.42;

export function titleFloorLightEffectsAtWithLight(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
  lightDirection: Vector3,
): TitleFloorLightEffects {
  return {
    shadowMultiplier: titleFloorPointInShadow(
      point,
      objects,
      lightDirection,
      time,
    )
      ? FLOOR_SHADOW_MULTIPLIER
      : 1,
    contactShadowMultiplier: titleFloorContactShadowMultiplierAt(
      point,
      objects,
      time,
    ),
    causticStrength: titleFloorCausticStrengthAt(point, objects, time),
  };
}

function titleFloorPointInShadow(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  lightDirection: Vector3,
  time: number,
): boolean {
  const shadowOrigin: Vector3 = [
    point[0],
    point[1] + SHADOW_RAY_BIAS,
    point[2],
  ];
  return objects.some((object) =>
    intersectsTitleSceneObjectAlongRay(
      shadowOrigin,
      lightDirection,
      object,
      time,
    ),
  );
}

function titleFloorCausticStrengthAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): number {
  let strength = 0;
  for (const object of objects) {
    const causticIntensity = Math.max(
      object.reflectivity,
      object.transparency ?? 0,
    );
    if (causticIntensity <= 0) {
      continue;
    }
    const footprintCenter = titleSceneObjectFootprintCenter(object, time);
    const dx = point[0] - footprintCenter[0];
    const dz = point[2] - footprintCenter[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const radius =
      (object.footprintRadius ?? object.radius) * CAUSTIC_RADIUS_SCALE;
    const falloff = Math.max(0, 1 - distance / radius);
    if (falloff <= 0) {
      continue;
    }
    const wave =
      (Math.sin(
        dx * CAUSTIC_WAVE_FREQUENCY +
          dz * CAUSTIC_WAVE_SECONDARY_FREQUENCY +
          time * CAUSTIC_TIME_RATE,
      ) +
        1) /
      2;
    strength += falloff * wave * causticIntensity * CAUSTIC_STRENGTH;
  }
  return Math.min(MAX_CAUSTIC_STRENGTH, strength);
}

function titleFloorContactShadowMultiplierAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): number {
  let strength = 0;
  for (const object of objects) {
    const footprintCenter = titleSceneObjectFootprintCenter(object, time);
    const dx = point[0] - footprintCenter[0];
    const dz = point[2] - footprintCenter[2];
    const falloff = Math.max(
      0,
      1 -
        Math.sqrt(dx * dx + dz * dz) /
          (object.footprintRadius * CONTACT_SHADOW_RADIUS_SCALE),
    );
    strength = Math.max(
      strength,
      Math.pow(falloff, CONTACT_SHADOW_POWER) * CONTACT_SHADOW_STRENGTH,
    );
  }
  return Math.max(CONTACT_SHADOW_MIN_MULTIPLIER, 1 - strength);
}
