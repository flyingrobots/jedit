import { canvas, type ShaderFn } from '@flyingrobots/bijou-tui';
import type { Surface } from '@flyingrobots/bijou';

type Vector3 = readonly [number, number, number];

/**
 * Zen Title Screen shader using Braille ray tracing.
 * 
 * Features a reflective sphere over a checkerboard ground plane.
 */
export function renderTitleScreen(
  cols: number,
  rows: number,
  time: number
): Surface {
  const shader: ShaderFn = ({ u, v, time: t }) => {
    // Ray generation (normalized coordinates -1 to 1)
    const aspect = cols / rows;
    const x = (u * 2 - 1) * aspect;
    const y = (v * 2 - 1);
    
    const ro: Vector3 = [0, 1.5, -4]; // Ray origin
    const rd: Vector3 = normalize([x, -y - 0.2, 1.5]); // Ray direction

    // Sphere
    const spherePos: Vector3 = [Math.sin(t * 0.5) * 1.5, 1.0 + Math.sin(t * 0.8) * 0.5, 2];
    const sphereRad = 1.0;
    
    const sphereDist = intersectSphere(ro, rd, spherePos, sphereRad);
    
    // Plane
    const planeDist = -ro[1] / rd[1];
    
    if (sphereDist > 0 && (planeDist < 0 || sphereDist < planeDist)) {
      // Shading sphere
      const p = add(ro, scale(rd, sphereDist));
      const n = normalize(sub(p, spherePos));
      
      // Reflection
      const refRd = reflect(rd, n);
      const refPlaneDist = -p[1] / refRd[1];
      
      if (refPlaneDist > 0) {
        const refP = add(p, scale(refRd, refPlaneDist));
        const check = (Math.floor(refP[0]) + Math.floor(refP[2])) % 2 === 0;
        return check ? 'X' : ' ';
      }
      
      // Sky reflection / fresnel
      const fresnel = Math.pow(1.0 - Math.max(0, -dot(rd, n)), 5);
      return fresnel > 0.3 ? 'X' : ' ';
    }
    
    if (planeDist > 0) {
      // Shading plane
      const p = add(ro, scale(rd, planeDist));
      const check = (Math.floor(p[0]) + Math.floor(p[2])) % 2 === 0;
      
      // Shadow
      const lightDir = normalize([1, 2, -1]);
      const toSphere = sub(spherePos, p);
      const proj = dot(toSphere, lightDir);
      const d2 = dot(toSphere, toSphere) - proj * proj;
      const inShadow = proj > 0 && d2 < sphereRad * sphereRad;
      
      if (inShadow) return ' ';
      return check ? 'X' : ' ';
    }

    return ' ';
  };

  return canvas(cols, rows, shader, { resolution: 'braille', time });
}

// Vector math helpers
function normalize(v: Vector3): Vector3 {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot(v1: Vector3, v2: Vector3): number {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function add(v1: Vector3, v2: Vector3): Vector3 {
  return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
}

function sub(v1: Vector3, v2: Vector3): Vector3 {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}

function scale(v: Vector3, s: number): Vector3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function reflect(i: Vector3, n: Vector3): Vector3 {
  return sub(i, scale(n, 2 * dot(i, n)));
}

function intersectSphere(ro: Vector3, rd: Vector3, pos: Vector3, rad: number): number {
  const oc = sub(ro, pos);
  const b = dot(oc, rd);
  const c = dot(oc, oc) - rad * rad;
  const h = b * b - c;
  if (h < 0) return -1;
  return -b - Math.sqrt(h);
}
