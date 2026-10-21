// Copies the MediaPipe Tasks Vision WASM assets from node_modules into
// public/vision so they are self-hosted by the static site.
// If the @mediapipe/tasks-vision package is not installed (for example on a
// fresh checkout before the vision labs land), this script skips quietly.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'public', 'vision');

if (!existsSync(source)) {
  console.log(
    'copy-vision-assets: @mediapipe/tasks-vision not installed, skipping (public/vision stays empty).',
  );
  process.exit(0);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`copy-vision-assets: copied WASM assets to ${target}`);
