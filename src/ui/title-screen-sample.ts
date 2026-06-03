import type { TitleSceneEnvironment } from './title-scene-environment.js';
import type { TitleSceneMaterialColors } from './title-scene-material-colors.js';
import type { TitleSceneCameraPlacement, TitleSceneObject, TitleSceneVector3 } from './title-scene.js';

export interface TitleSceneSampleOptions {
  readonly u: number;
  readonly v: number;
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly camAngle: number;
  readonly camRadius: number;
  readonly spotlightCamera: TitleSceneCameraPlacement;
  readonly objects: readonly TitleSceneObject[];
  readonly colors: TitleSceneMaterialColors;
  readonly environment: TitleSceneEnvironment | undefined;
}

export interface TitleSceneRayContext {
  readonly origin: TitleSceneVector3;
  readonly ray: TitleSceneVector3;
  readonly lightDirection: TitleSceneVector3;
  readonly spotlight: TitleSceneSpotlight;
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
  readonly spotlight: TitleSceneSpotlight;
}

export interface TitleSceneSpotlight {
  readonly source: TitleSceneVector3;
  readonly target: TitleSceneVector3;
  readonly direction: TitleSceneVector3;
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly innerConeCosine: number;
  readonly outerConeCosine: number;
}
