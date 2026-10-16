// Copies maplibre-gl's web worker into public/ so it is served at /maplibre-gl-worker.mjs
// by `expo start --web` and included in `expo export --platform web` output (A9).
// Runs on postinstall; safe to re-run. The copy is gitignored.
const fs = require('fs');
const path = require('path');

let pkgDir;
try {
  pkgDir = path.dirname(require.resolve('maplibre-gl/package.json'));
} catch {
  console.warn('[copy-maplibre-worker] maplibre-gl is not installed yet; skipping.');
  process.exit(0);
}

const src = path.join(pkgDir, 'dist', 'maplibre-gl-worker.mjs');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'maplibre-gl-worker.mjs');

if (!fs.existsSync(src)) {
  console.warn(`[copy-maplibre-worker] ${src} not found; skipping.`);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-maplibre-worker] ${path.relative(process.cwd(), dest)}`);
