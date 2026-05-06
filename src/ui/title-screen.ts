import { canvas, type ShaderFn } from '@flyingrobots/bijou-tui';
import type { Surface } from '@flyingrobots/bijou';
import type { JeditTheme } from './jedit-theme.js';
import { JEDIT_LOGO_WIDTH, JEDIT_LOGO_HEIGHT, JEDIT_LOGO_MASK } from './logo-data.js';

type Vector3 = readonly [number, number, number];

/**
 * Zen Title Screen shader using Braille ray tracing.
 * 
 * Features a reflective sphere over a checkerboard ground plane,
 * with the "jedit" logo carved into the scene.
 */
export function renderTitleScreen(
  cols: number,
  rows: number,
  time: number,
  theme: JeditTheme
): Surface {
  // Pre-decode the logo mask for faster access
  const mask = JEDIT_LOGO_MASK.map((row: string) => {
    const bytes = [];
    for (let i = 0; i < row.length; i += 4) {
      bytes.push(parseInt(row.substr(i + 2, 2), 16));
    }
    return bytes;
  });

  const shader: ShaderFn = ({ u, v, time: t }) => {
    // Sub-pixel coordinates in Braille resolution (2x4)
    const px = u * cols * 2;
    const py = v * rows * 4;

    // Logo check - centered and scaled
    const logoScale = Math.min(cols * 2 / JEDIT_LOGO_WIDTH, rows * 4 / JEDIT_LOGO_HEIGHT) * 0.7;
    const lw = JEDIT_LOGO_WIDTH * logoScale;
    const lh = JEDIT_LOGO_HEIGHT * logoScale;
    
    const lx = Math.floor((px - (cols * 2 - lw) / 2) / logoScale);
    const ly = Math.floor((py - (rows * 4 - lh) / 2) / logoScale);
    
    let inLogo = false;
    if (lx >= 0 && lx < JEDIT_LOGO_WIDTH && ly >= 0 && ly < JEDIT_LOGO_HEIGHT) {
      const byteIdx = Math.floor(lx / 8);
      const bitIdx = 7 - (lx % 8);
      const rowMask = mask[ly];
      if (rowMask && rowMask[byteIdx]! & (1 << bitIdx)) {
        inLogo = true;
      }
    }

    // Ray generation (normalized coordinates -1 to 1)
    const aspect = (cols * 2) / (rows * 4); // Use sub-pixel aspect ratio
    const rx = (u * 2 - 1) * aspect;
    const ry = (v * 2 - 1);
    
    const ro: Vector3 = [0, 1.2, -4]; // Ray origin
    const rd: Vector3 = normalize([rx, -ry - 0.1, 2.0]); // Ray direction

    // Sphere (oscillating)
    const spherePos: Vector3 = [
      Math.sin(t * 0.4) * 1.8, 
      1.2 + Math.sin(t * 0.7) * 0.4, 
      2.5
    ];
    const sphereRad = 1.2;
    
    const sphereDist = intersectSphere(ro, rd, spherePos, sphereRad);
    
    // Plane
    const planeDist = -ro[1] / rd[1];
    
    let char = ' ';
    const lightDir = normalize([1, 2, -1]);

    if (sphereDist > 0 && (planeDist < 0 || sphereDist < planeDist)) {
      // Shading sphere
      const p = add(ro, scale(rd, sphereDist));
      const n = normalize(sub(p, spherePos));
      
      // Reflection
      const refRd = reflect(rd, n);
      const refPlaneDist = -p[1] / refRd[1];
      
      if (refPlaneDist > 0) {
        const refP = add(p, scale(refRd, refPlaneDist));
        const check = (Math.floor(refP[0] * 0.8) + Math.floor(refP[2] * 0.8)) % 2 === 0;
        char = check ? 'X' : ' ';
      } else {
        // Sky reflection (with stars)
        const star = hash3(refRd) > 0.97;
        const fresnel = Math.pow(1.0 - Math.max(0, -dot(rd, n)), 3);
        char = (star || fresnel > 0.4) ? 'X' : ' ';
      }

      // Specular highlight
      if (dot(n, lightDir) > 0.92) char = 'X';
    } else if (planeDist > 0) {
      // Shading plane
      const p = add(ro, scale(rd, planeDist));
      const check = (Math.floor(p[0] * 0.8) + Math.floor(p[2] * 0.8)) % 2 === 0;
      
      // Shadow from sphere
      const toSphere = sub(spherePos, p);
      const proj = dot(toSphere, lightDir);
      const d2 = dot(toSphere, toSphere) - proj * proj;
      const inShadow = proj > 0 && d2 < (sphereRad * sphereRad * 0.8);
      
      if (inShadow) char = ' ';
      else char = check ? 'X' : ' ';
    } else {
      // Sky (with stars)
      const star = hash3(rd) > 0.995;
      char = star ? 'X' : ' ';
    }

    // Composite logo (XOR-ish effect)
    if (inLogo) {
      const logoChar = char === ' ' ? 'X' : ' ';
      return {
        char: logoChar,
        fgRGB: theme.surface.workspace.fgRGB,
        bgRGB: theme.surface.workspace.bgRGB,
      };
    }

    return {
      char,
      fgRGB: theme.surface.workspace.fgRGB,
      bgRGB: theme.surface.workspace.bgRGB,
    };
  };

  return canvas(cols, rows, shader, { resolution: 'braille', time });
}

// Simple deterministic hash for stars
function hash3(v: Vector3): number {
  const x = Math.sin(v[0] * 12.9898 + v[1] * 78.233 + v[2] * 37.719) * 43758.5453123;
  return x - Math.floor(x);
}

// Vector math helpers
function normalize(v: Vector3): Vector3 {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (l === 0) return [0, 0, 0];
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
