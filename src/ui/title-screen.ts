import { canvas, type ShaderFn } from '@flyingrobots/bijou-tui';
import { type Surface } from '@flyingrobots/bijou';
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
 * Zen Title Screen - v7 "Unified Zen"
 * 
 * Final stability fix:
 * - Solid background pass to fix light themes.
 * - Robust color interpolation and scaling.
 * - Smooth logo with contrast halo.
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

  const accentColor = theme.chrome.activeEdge.bgRGB ?? [100, 100, 255];
  const surfaceColor = theme.surface.workspace.bgRGB ?? [10, 10, 15];
  const inkColor = theme.surface.workspace.fgRGB ?? [200, 200, 200];

  const spheres: Sphere[] = [
    { pos: [0, 1.0, 0], rad: 1.0, reflective: true, color: accentColor },
    { pos: [2.2, 0.5, 1.0], rad: 0.5, reflective: false, color: inkColor },
    { pos: [-2.0, 0.7, -0.5], rad: 0.7, reflective: true, color: accentColor },
  ];

  const shader: ShaderFn = ({ u, v, time: t }) => {
    const px = u * cols * 2;
    const py = v * rows * 4;

    const logoScale = Math.min(cols * 2 / JEDIT_LOGO_WIDTH, rows * 4 / JEDIT_LOGO_HEIGHT) * 0.48;
    const lw = JEDIT_LOGO_WIDTH * logoScale;
    const lh = JEDIT_LOGO_HEIGHT * logoScale;
    const lx = Math.floor((px - (cols * 2 - lw) / 2) / logoScale);
    const ly = Math.floor((py - (rows * 4 - lh) / 2) / logoScale);
    
    const checkMask = (x: number, y: number) => {
      if (x < 0 || x >= JEDIT_LOGO_WIDTH || y < 0 || y >= JEDIT_LOGO_HEIGHT) return false;
      const r = mask[y];
      return r && (r[Math.floor(x / 8)]! & (1 << (7 - (x % 8))));
    };

    if (lx >= 0 && lx < JEDIT_LOGO_WIDTH && ly >= 0 && ly < JEDIT_LOGO_HEIGHT) {
      if (checkMask(lx, ly)) {
        return { char: '█', fgRGB: accentColor, bgRGB: surfaceColor };
      }
      if (checkMask(lx-1, ly) || checkMask(lx+1, ly) || checkMask(lx, ly-1) || checkMask(lx, ly+1)) {
        return { char: ' ', bgRGB: surfaceColor };
      }
    }

    const aspect = (cols * 2) / (rows * 4);
    const rx = (u * 2 - 1) * aspect;
    const ry = (v * 2 - 1);
    
    const camAngle = t * 0.008; 
    const ro: Vector3 = [Math.sin(camAngle) * 8.5, 3.8, Math.cos(camAngle) * 8.5];
    const target: Vector3 = [0, 0.4, 0];
    const rd = getRayDir(ro, target, [rx, -ry - 0.2, 3.2]);

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
    const lightDir = normalize([1.2, 2, -1]);

    if (hitSphere) {
      const p = add(ro, scale(rd, closestT));
      const n = normalize(sub(p, hitSphere.pos));
      const shadow = Math.max(0, dot(n, lightDir));
      let color = scaleColor(hitSphere.color, 0.4 + shadow * 0.6);
      let char = shadow > 0.45 ? '·' : ' ';
      if (hitSphere.reflective) {
        const refRd = reflect(rd, n);
        const refPlaneDist = -p[1] / refRd[1];
        if (refPlaneDist > 0) {
          const refP = add(p, scale(refRd, refPlaneDist));
          if ((Math.floor(refP[0] * 0.8) + Math.floor(refP[2] * 0.8)) % 2 === 0) char = '·';
        }
      }
      return { char, fgRGB: color, bgRGB: surfaceColor };
    }

    if (hitPlane) {
      const p = add(ro, scale(rd, planeDist));
      const fade = Math.max(0, 1.0 - planeDist / 28.0);
      if (fade <= 0) return { char: ' ', bgRGB: surfaceColor };
      if ((Math.floor(p[0] * 0.8) + Math.floor(p[2] * 0.8)) % 2 !== 0) return { char: ' ', bgRGB: surfaceColor };
      
      let inShadow = false;
      for (const s of spheres) {
        const toSphere = sub(s.pos, p);
        const proj = dot(toSphere, lightDir);
        if (proj > 0 && dot(toSphere, toSphere) - proj * proj < (s.rad * s.rad * 0.9)) {
          inShadow = true;
          break;
        }
      }
      if (inShadow) return { char: ' ', bgRGB: surfaceColor };
      return { char: '·', fgRGB: scaleColor(inkColor, fade * 0.3), bgRGB: surfaceColor };
    }

    return { char: ' ', bgRGB: surfaceColor };
  };

  const surface = canvas(cols, rows, shader, { resolution: 'braille', time });
  
  // Post-process to fix light themes: ensure ALL cells have the surface background.
  const [sR, sG, sB] = surfaceColor;
  const [iR, iG, iB] = inkColor;
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = surface.get(x, y);
      const bg = cell.bgRGB;
      const fg = cell.fgRGB;
      
      // If cell style is missing (happens for empty Braille blocks), fill it.
      if (!bg || !fg) {
        surface.set(x, y, {
          char: cell.char,
          fgRGB: fg ?? [iR, iG, iB],
          bgRGB: bg ?? [sR, sG, sB],
        });
      }
    }
  }

  return surface;
}

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
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function normalize(v: Vector3): Vector3 {
  const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return l === 0 ? [0,0,0] : [v[0]/l, v[1]/l, v[2]/l];
}

function dot(v1: Vector3, v2: Vector3): number { return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]; }
function add(v1: Vector3, v2: Vector3): Vector3 { return [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]]; }
function sub(v1: Vector3, v2: Vector3): Vector3 { return [v1[0]-v2[0], v1[1]-v2[1], v1[2]-v2[2]]; }
function scale(v: Vector3, s: number): Vector3 { return [v[0]*s, v[1]*s, v[2]*s]; }
function reflect(i: Vector3, n: Vector3): Vector3 { return sub(i, scale(n, 2 * dot(i, n))); }

function intersectSphere(ro: Vector3, rd: Vector3, pos: Vector3, rad: number): number {
  const oc = sub(ro, pos);
  const b = dot(oc, rd);
  const c = dot(oc, oc) - rad * rad;
  const h = b * b - c;
  if (h < 0) return -1;
  return -b - Math.sqrt(h);
}
