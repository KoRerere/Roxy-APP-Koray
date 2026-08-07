import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const remoteSkills = [
  {
    name: 'roxybrowser-control',
    repo: 'https://github.com/roxybrowserlabs/roxybrowser-mcp-server.git',
    remotePath: 'skills/roxybrowser-control',
  },
  {
    name: 'roxybrowser-automation',
    repo: 'https://github.com/roxybrowserlabs/roxybrowser-playwright-mcp.git',
    remotePath: 'skills/roxybrowser-automation',
  },
];

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

function syncSkill(skill, workDir) {
  const repoDir = path.join(workDir, skill.name);
  const sourceDir = path.join(repoDir, skill.remotePath);
  const targetDir = path.join(srcDir, skill.name);

  console.log(`同步 ${skill.name}...`);
  run('git', [
    'clone',
    '--depth',
    '1',
    '--filter=blob:none',
    '--sparse',
    '--no-checkout',
    skill.repo,
    repoDir,
  ]);
  run('git', ['-C', repoDir, 'sparse-checkout', 'set', skill.remotePath]);
  run('git', ['-C', repoDir, 'checkout', 'HEAD', '--', skill.remotePath]);

  if (!fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    throw new Error(`远端目录缺少 SKILL.md: ${skill.remotePath}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`已更新 ${path.relative(rootDir, targetDir)}`);
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-skills-'));

try {
  for (const skill of remoteSkills) {
    syncSkill(skill, workDir);
  }
  console.log('远端 skills 同步完成');
}
finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
