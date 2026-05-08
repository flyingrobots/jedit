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
 * Zen Title Screen - v10 "Vivid Interactive"
 * 
 * Features:
 * - Multi-colored spheres (Accent, Info, Success).
 * - Dual-light setup (Key light + Fill light) for balanced shading.
 * - Density-ramped ASCII logo (using █▓▒░).
 * - Atmospheric sky gradient.
 */
export function renderTitleScreen(
  cols: number,
  rows: number,
  time: number,
  theme: JeditTheme,
  camAngle: number,
  camRadius: number
): Surface {
  const mask = JEDIT_LOGO_MASK.map((row: string) => {
    const bytes = [];
    for (let i = 0; i < row.length; i += 4) {
      bytes.push(parseInt(row.substr(i + 2, 2), 16));
    }
    return bytes;
  });

  // Dynamically sample theme colors
  const accentColor = theme.chrome.activeEdge.fgRGB ?? [216, 151, 255];
  const infoColor = theme.source.get(Symbol.for('jedit.theme.source.number'))?.fgRGB ?? [101, 194, 255];
  const successColor = theme.source.get(Symbol.for('jedit.theme.source.string'))?.fgRGB ?? [124, 213, 156];
  const surfaceColor = theme.surface.workspace.bgRGB ?? [10, 10, 15];
  const inkColor = theme.surface.workspace.fgRGB ?? [200, 200, 200];

  const spheres: Sphere[] = [
    { pos: [0, 1.0, 0], rad: 1.0, reflective: true, color: accentColor },
    { pos: [2.5, 0.5, 1.5], rad: 0.5, reflective: false, color: successColor },
    { pos: [-2.2, 0.7, -1.0], rad: 0.7, reflective: true, color: infoColor },
  ];

  // 1. Ray Trace Pass
  const shader: ShaderFn = ({ u, v, time: t }) => {
    const aspect = (cols * 2) / (rows * 4);
    const rx = (u * 2 - 1) * aspect;
    const ry = (v * 2 - 1);
    
    const finalAngle = camAngle + (t * 0.005);
    const ro: Vector3 = [Math.sin(finalAngle) * camRadius, 3.5, Math.cos(finalAngle) * camRadius];
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
    
    const lightDir = normalize([1.5, 2.5, -1]);
    const fillDir = normalize([-2, 1, 1]);

    if (hitSphere) {
      const p = add(ro, scale(rd, closestT));
      const n = normalize(sub(p, hitSphere.pos));
      
      const key = Math.max(0, dot(n, lightDir));
      const fill = Math.max(0, dot(n, fillDir)) * 0.3;
      const ambient = 0.15;
      const lighting = key + fill + ambient;
      
      let color = scaleColor(hitSphere.color, lighting);
      let char = lighting > 0.4 ? '·' : ' ';

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
      const fade = Math.max(0, 1.0 - planeDist / 35.0);
      if (fade <= 0) return ' ';

      const check = (Math.floor(p[0] * 0.8) + Math.floor(p[2] * 0.8)) % 2 === 0;
      if (!check) return ' ';

      let inShadow = false;
      for (const s of spheres) {
        const toSphere = sub(s.pos, p);
        if (dot(toSphere, lightDir) > 0 && dot(toSphere, toSphere) - Math.pow(dot(toSphere, lightDir), 2) < (s.rad * s.rad)) {
          inShadow = true;
          break;
        }
      }
      if (inShadow) return ' ';
      return { char: '·', fgRGB: scaleColor(inkColor, fade * 0.3), bgRGB: surfaceColor };
    }

    // Sky gradient
    const skyFade = Math.max(0, rd[1] + 0.2);
    return { char: ' ', bgRGB: scaleColor(surfaceColor, 1.0 + skyFade * 0.2) };
  };

  const surface = canvas(cols, rows, shader, { resolution: 'braille', time });
  const [sR, sG, sB] = surfaceColor;
  const [iR, iG, iB] = inkColor;
  const [aR, aG, aB] = accentColor;
  const anySurface = surface as any;

  // 2. High-Contrast Shaded Logo Pass (Cell level)
  const logoScale = 0.5;
  const lw = Math.floor(JEDIT_LOGO_WIDTH * logoScale);
  const lh = Math.floor(JEDIT_LOGO_HEIGHT * logoScale);
  const startX = Math.floor((cols - lw / 2) / 2);
  const startY = Math.floor((rows - lh / 4) / 2);

  const DENSITY_RAMP = [' ', '·', '░', '▒', '▓', '█'];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = surface.get(x, y);
      
      // Calculate density of logo sub-pixels in this cell
      let density = 0;
      const lx_base = Math.floor((x - startX) * (JEDIT_LOGO_WIDTH / (lw/2)));
      const ly_base = Math.floor((y - startY) * (JEDIT_LOGO_HEIGHT / (lh/4)));

      if (lx_base >= 0 && lx_base < JEDIT_LOGO_WIDTH && ly_base >= 0 && ly_base < JEDIT_LOGO_HEIGHT) {
        // Check 2x4 sub-pixel block
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const lx = lx_base + sx;
            const ly = ly_base + sy;
            const rowMask = mask[ly];
            if (rowMask && rowMask[Math.floor(lx / 8)]! & (1 << (7 - (lx % 8)))) {
              density++;
            }
          }
        }
      }

      if (density > 0) {
        // Map density (0-8) to ramp index (0-5)
        const rampIdx = Math.min(5, Math.ceil(density / 1.5));
        const char = DENSITY_RAMP[rampIdx]!;
        anySurface.setRGB(x, y, char, aR, aG, aB, sR, sG, sB, 0);
      } else {
        // Final color stabilization pass for the whole surface
        const fg = cell.fgRGB ?? [iR, iG, iB];
        const bg = cell.bgRGB ?? [sR, sG, sB];
        anySurface.setRGB(x, y, cell.char, fg[0], fg[1], fg[2], bg[0], bg[1], bg[2], 0);
      }
    }
  }

  return surface;
}

function scaleColor(c: Color3, s: number): Color3 {
  return [Math.max(0, Math.min(255, Math.floor(c[0] * s))), Math.max(0, Math.min(255, Math.floor(c[1] * s))), Math.max(0, Math.min(255, Math.floor(c[2] * s)))];
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
