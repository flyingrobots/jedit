import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCREEN_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-screen.js');
const TITLE_SCENE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-scene.js');
const JEDIT_THEME_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');

async function run() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout);
  }

  const titleScreen = await import(pathToFileURL(TITLE_SCREEN_PATH).href);
  const titleScene = await import(pathToFileURL(TITLE_SCENE_PATH).href);
  const themes = await import(pathToFileURL(THEMES_PATH).href);

  // We'll use Solarized Light or just any default theme
  const theme = themes.resolveInitialJeditTheme();

  // Just render the scene at time 0
  const cols = 80;
  const rows = 24;
  const surface = titleScreen.renderTitleScreen(cols, rows, 0, theme, {
    camAngle: 0,
    camRadius: 8.5,
    sceneSeed: 0.5,
  });

  const lines = [];
  for (let y = 0; y < surface.height; y++) {
    let line = '';
    for (let x = 0; x < surface.width; x++) {
      const cell = surface.get(x, y);
      line += cell.char;
    }
    lines.push(line);
  }

  const output = lines.join('\n');
  const outputPath = path.join(REPO_ROOT, 'tests', 'canonical-scene-render.txt');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`Captured canonical render to ${outputPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
