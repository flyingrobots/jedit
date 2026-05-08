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
 * Zen Title Screen - v9 "Interactive Vivid Zen"
 * 
 * Features:
 * - Full arrow-key camera control (passed from main.ts).
 * - Standard ASCII logo overlay (High Contrast).
 * - Hardened color propagation for light/dark themes.
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

  const accentColor = theme.chrome.activeEdge.fgRGB ?? [216, 151, 255];
  const surfaceColor = theme.surface.workspace.bgRGB ?? [10, 10, 15];
  const inkColor = theme.surface.workspace.fgRGB ?? [200, 200, 200];

  const spheres: Sphere[] = [
    { pos: [0, 1.0, 0], rad: 1.0, reflective: true, color: accentColor },
    { pos: [2.5, 0.5, 1.5], rad: 0.5, reflective: false, color: inkColor },
    { pos: [-2.2, 0.7, -1.0], rad: 0.7, reflective: true, color: accentColor },
  ];

  const shader: ShaderFn = ({ u, v, time: t }) => {
    const aspect = (cols * 2) / (rows * 4);
    const rx = (u * 2 - 1) * aspect;
    const ry = (v * 2 - 1);
    
    // Combine interactive angle with a tiny drift for life
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

    if (hitSphere) {
      const p = add(ro, scale(rd, closestT));
      const n = normalize(sub(p, hitSphere.pos));
      const shadow = Math.max(0, dot(n, lightDir));
      let color = scaleColor(hitSphere.color, 0.4 + shadow * 0.6);
      let char = shadow > 0.4 ? '·' : ' ';

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
      const fade = Math.max(0, 1.0 - planeDist / 30.0);
      if (fade <= 0) return { char: ' ', fgRGB: inkColor, bgRGB: surfaceColor };
      if ((Math.floor(p[0] * 0.8) + Math.floor(p[2] * 0.8)) % 2 !== 0) return { char: ' ', fgRGB: inkColor, bgRGB: surfaceColor };
      
      let inShadow = false;
      for (const s of spheres) {
        const toSphere = sub(s.pos, p);
        if (dot(toSphere, lightDir) > 0 && dot(toSphere, toSphere) - Math.pow(dot(toSphere, lightDir), 2) < (s.rad * s.rad)) {
          inShadow = true;
          break;
        }
      }
      if (inShadow) return { char: ' ', fgRGB: inkColor, bgRGB: surfaceColor };
      return { char: '·', fgRGB: scaleColor(inkColor, fade * 0.3), bgRGB: surfaceColor };
    }

    return { char: ' ', fgRGB: inkColor, bgRGB: surfaceColor };
  };

  const surface = canvas(cols, rows, shader, { resolution: 'braille', time });
  
  const [sR, sG, sB] = surfaceColor;
  const [iR, iG, iB] = inkColor;
  const [aR, aG, aB] = accentColor;
  const anySurface = surface as any;

  const logoScale = 0.5;
  const lw = JEDIT_LOGO_WIDTH * logoScale;
  const lh = JEDIT_LOGO_HEIGHT * logoScale;
  const startX = Math.floor((cols - lw / 2) / 2);
  const startY = Math.floor((rows - lh / 4) / 2);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = surface.get(x, y);
      
      const lx = Math.floor((x - startX) * (JEDIT_LOGO_WIDTH / (lw/2)));
      const ly = Math.floor((y - startY) * (JEDIT_LOGO_HEIGHT / (lh/4)));

      let logoCell = false;
      if (lx >= 0 && lx < JEDIT_LOGO_WIDTH && ly >= 0 && ly < JEDIT_LOGO_HEIGHT) {
        const rowMask = mask[ly];
        if (rowMask && rowMask[Math.floor(lx / 8)]! & (1 << (7 - (lx % 8)))) {
          logoCell = true;
        }
      }

      if (logoCell) {
        anySurface.setRGB(x, y, '█', aR, aG, aB, sR, sG, sB, 0);
      } else if (!cell.bgRGB || cell.bgRGB[0] === -1 || !cell.fgRGB || cell.fgRGB[0] === -1) {
        if (typeof anySurface.setRGB === 'function') {
          anySurface.setRGB(
            x, y, cell.char, 
            cell.fgRGB ? cell.fgRGB[0] : iR, cell.fgRGB ? cell.fgRGB[1] : iG, cell.fgRGB ? cell.fgRGB[2] : iB, 
            cell.bgRGB ? cell.bgRGB[0] : sR, cell.bgRGB ? cell.bgRGB[1] : sG, cell.bgRGB ? cell.bgRGB[2] : sB, 
            0
          );
        } else {
          surface.set(x, y, {
            char: cell.char,
            fgRGB: cell.fgRGB ?? [iR, iG, iB],
            bgRGB: cell.bgRGB ?? [sR, sG, sB],
          });
        }
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
