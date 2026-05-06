import { canvas, type ShaderFn } from '@flyingrobots/bijou-tui';
import type { Surface } from '@flyingrobots/bijou';
import type { JeditTheme } from './jedit-theme.js';
import { JEDIT_LOGO_WIDTH, JEDIT_LOGO_HEIGHT, JEDIT_LOGO_MASK } from './logo-data.js';

type Vector3 = readonly [number, number, number];
type Color3 = readonly [number, number, number];

interface Sphere {
  pos: Vector3;
  rad: number;
  reflective: boolean;
  color: Color3;
}

/**
 * Zen Title Screen - v4 "Stable Zen"
 * 
 * Improvements:
 * - Much slower, calmer logo animation.
 * - Clean sky (removed noise).
 * - Reactive theme coloring (handles theme toggles gracefully).
 * - Smoother color fallback.
 */
export function renderTitleScreen(
  cols: number,
  rows: number,
  time: number,
  theme: JeditTheme
): Surface {
  const mask = JEDIT_LOGO_MASK.map((row: string) => {
    const bytes = [];
    for (let i = 0; i < row.length; i += 4) {
      bytes.push(parseInt(row.substr(i + 2, 2), 16));
    }
    return bytes;
  });

  // Sample theme colors dynamically
  const accentColor = theme.chrome.activeEdge.bgRGB ?? [100, 100, 255];
  const surfaceColor = theme.surface.workspace.bgRGB ?? [0, 0, 0];
  const fgColor = theme.surface.workspace.fgRGB ?? [150, 150, 150];

  const spheres: Sphere[] = [
    { pos: [0, 1.2, 0], rad: 1.2, reflective: true, color: accentColor },
    { pos: [2.5, 0.6, 1.5], rad: 0.6, reflective: false, color: fgColor },
    { pos: [-2.0, 0.8, -1.0], rad: 0.8, reflective: true, color: accentColor },
  ];

  const shader: ShaderFn = ({ u, v, time: t }) => {
    // 1. Logo Pass
    const logoScale = Math.min(cols * 2 / JEDIT_LOGO_WIDTH, rows * 4 / JEDIT_LOGO_HEIGHT) * 0.6;
    const lw = JEDIT_LOGO_WIDTH * logoScale;
    const lh = JEDIT_LOGO_HEIGHT * logoScale;
    const px = u * cols * 2;
    const py = v * rows * 4;
    const lx = Math.floor((px - (cols * 2 - lw) / 2) / logoScale);
    const ly = Math.floor((py - (rows * 4 - lh) / 2) / logoScale);
    
    let inLogo = false;
    if (lx >= 0 && lx < JEDIT_LOGO_WIDTH && ly >= 0 && ly < JEDIT_LOGO_HEIGHT) {
      const rowMask = mask[ly];
      if (rowMask && rowMask[Math.floor(lx / 8)]! & (1 << (7 - (lx % 8)))) {
        inLogo = true;
      }
    }

    if (inLogo) {
      // Very slow, subtle gradient shift
      const slowT = t * 0.1; // 10x slower than before
      const gradT = (u * 0.5 + slowT) % 1.0;
      const r = Math.floor(Math.sin(gradT * Math.PI * 2) * 40 + 200);
      const g = Math.floor(Math.sin((gradT + 0.33) * Math.PI * 2) * 40 + 200);
      const b = Math.floor(Math.sin((gradT + 0.66) * Math.PI * 2) * 40 + 200);
      
      return {
        char: '█',
        fgRGB: [r, g, b],
      };
    }

    // 2. Ray Trace Pass
    const aspect = (cols * 2) / (rows * 4);
    const rx = (u * 2 - 1) * aspect;
    const ry = (v * 2 - 1);
    
    const camAngle = t * 0.03; // Even slower orbit
    const camDist = 7.0;
    const ro: Vector3 = [Math.sin(camAngle) * camDist, 2.8, Math.cos(camAngle) * camDist];
    const target: Vector3 = [0, 0.6, 0];
    const rd = getRayDir(ro, target, [rx, -ry - 0.2, 2.5]);

    // Trace Scene
    let closestT = Infinity;
    let hitSphere: Sphere | null = null;
    
    for (const s of spheres) {
      const dist = intersectSphere(ro, rd, s.pos, s.rad);
      if (dist > 0 && dist < closestT) {
        closestT = dist;
        hitSphere = s;
      }
    }

    const planeDist = -ro[1] / rd[1];
    const hitPlane = planeDist > 0 && planeDist < closestT;

    const lightDir = normalize([1, 2, -1]);

    if (hitSphere) {
      const p = add(ro, scale(rd, closestT));
      const n = normalize(sub(p, hitSphere.pos));
      
      let finalColor = hitSphere.color;
      let char = '·';

      if (hitSphere.reflective) {
        const refRd = reflect(rd, n);
        const refPlaneDist = -p[1] / refRd[1];
        if (refPlaneDist > 0) {
          const refP = add(p, scale(refRd, refPlaneDist));
          const check = (Math.floor(refP[0]) + Math.floor(refP[2])) % 2 === 0;
          if (!check) char = ' ';
        } else {
          const fresnel = Math.pow(1.0 - Math.max(0, -dot(rd, n)), 3);
          if (fresnel < 0.5) char = ' ';
        }
      } else {
        const diff = Math.max(0, dot(n, lightDir));
        if (diff < 0.6) char = ' ';
      }

      const shadow = dot(n, lightDir);
      finalColor = scaleColor(finalColor, Math.max(0.4, shadow));

      return {
        char,
        fgRGB: finalColor,
        bgRGB: surfaceColor,
      };
    }

    if (hitPlane) {
      const p = add(ro, scale(rd, planeDist));
      const distToCam = planeDist;
      
      const fade = Math.max(0, 1.0 - distToCam / 18.0);
      if (fade <= 0) return { char: ' ', bgRGB: surfaceColor };

      const check = (Math.floor(p[0]) + Math.floor(p[2])) % 2 === 0;
      if (!check) return { char: ' ', bgRGB: surfaceColor };

      let inShadow = false;
      for (const s of spheres) {
        const toSphere = sub(s.pos, p);
        const proj = dot(toSphere, lightDir);
        const d2 = dot(toSphere, toSphere) - proj * proj;
        if (proj > 0 && d2 < (s.rad * s.rad)) {
          inShadow = true;
          break;
        }
      }

      if (inShadow) return { char: ' ', bgRGB: surfaceColor };
      
      return {
        char: '·',
        fgRGB: scaleColor(fgColor, fade * 0.4),
        bgRGB: surfaceColor,
      };
    }

    // Sky - clean black space
    return {
      char: ' ',
      bgRGB: surfaceColor,
    };
  };

  return canvas(cols, rows, shader, { resolution: 'braille', time });
}

// Helpers
function scaleColor(c: Color3, s: number): Color3 {
  return [
    Math.max(0, Math.min(255, Math.floor(c[0] * s))),
    Math.max(0, Math.min(255, Math.floor(c[1] * s))),
    Math.max(0, Math.min(255, Math.floor(c[2] * s)))
  ];
}

function getRayDir(ro: Vector3, target: Vector3, screenCoords: Vector3): Vector3 {
  const forward = normalize(sub(target, ro));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return normalize(add(add(scale(right, screenCoords[0]), scale(up, screenCoords[1])), scale(forward, screenCoords[2])));
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

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
