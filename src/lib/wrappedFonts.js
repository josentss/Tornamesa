// Inter (OFL) bundled for the yearly PNG. Without explicit fonts next/og only has
// one regular face, so every fontWeight renders the same.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let pending = null;

async function read() {
  const dir = join(process.cwd(), 'src/assets/fonts');
  const faces = [];
  for (const [subset, name] of [['latin', 'Inter'], ['latin-ext', 'InterExt']]) {
    for (const weight of [400, 600, 800]) {
      faces.push({
        name, weight, style: 'normal',
        data: await readFile(join(dir, `inter-${subset}-${weight}-normal.woff`)),
      });
    }
  }
  return faces;
}

export function loadWrappedFonts() {
  pending ||= read().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}
