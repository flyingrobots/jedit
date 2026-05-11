#!/usr/bin/env node

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ASSETS = [
  {
    source: join('src', 'ui', 'bunny.obj'),
    destination: join('dist', 'ui', 'bunny.obj'),
  },
  {
    source: join('src', 'ui', 'flyingrobotslogo.txt'),
    destination: join('dist', 'ui', 'flyingrobotslogo.txt'),
  },
];

for (const asset of ASSETS) {
  mkdirSync(dirname(asset.destination), { recursive: true });
  copyFileSync(asset.source, asset.destination);
}
