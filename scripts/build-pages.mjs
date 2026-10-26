import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error('Refusing to write outside the project dist directory.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
await cp(path.join(root, 'styles.css'), path.join(output, 'styles.css'));
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
console.log(`Cloudflare Pages assets prepared in ${output}`);
