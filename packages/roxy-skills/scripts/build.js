import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

const skills = [
  'roxybrowser-playwright-skills',
  'roxybrowser-openapi-skills',
  'playwright-rpa-enhance-skills',
];

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

async function build() {
  for (const skill of skills) {
    const sourceDir = path.join(srcDir, skill);
    if (!fs.existsSync(sourceDir)) {
      console.warn(`跳过（目录不存在）: ${skill}`);
      continue;
    }
    const zipPath = path.join(distDir, `${skill}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`已生成: ${path.relative(rootDir, zipPath)} (${(archive.pointer() / 1024).toFixed(2)} KB)`);
        resolve();
      });
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
  console.log('build 完成，压缩包已输出到 dist/');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
