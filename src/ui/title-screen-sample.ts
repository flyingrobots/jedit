import type { TitleSceneEnvironment } from './title-scene-environment.js';
import type { TitleSceneMaterialColors } from './title-screen.js';
import type { TitleSceneObject, TitleSceneVector3 } from './title-scene.js';

export interface TitleSceneSampleOptions {
  readonly u: number;
  readonly v: number;
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly camAngle: number;
  readonly camRadius: number;
  readonly objects: readonly TitleSceneObject[];
  readonly colors: TitleSceneMaterialColors;
  readonly environment: TitleSceneEnvironment | undefined;
}

export interface TitleSceneRayContext {
  readonly origin: TitleSceneVector3;
  readonly ray: TitleSceneVector3;
  readonly lightDirection: TitleSceneVector3;
}

export interface ReflectedEnvironmentColorOptions {
  readonly point: TitleSceneVector3;
  readonly ray: TitleSceneVector3;
  readonly colors: TitleSceneMaterialColors;
  readonly objects: readonly TitleSceneObject[];
  readonly time: number;
  readonly ignoredObject: TitleSceneObject;
  readonly environment: TitleSceneEnvironment | undefined;
  readonly lightDirection: TitleSceneVector3;
}
