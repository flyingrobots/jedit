#!/usr/bin/env node

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
rmSync(join(SCRIPT_DIRECTORY, '..', 'dist'), { recursive: true, force: true });
