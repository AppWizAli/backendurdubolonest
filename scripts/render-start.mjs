import { spawn } from 'node:child_process';

const shell = process.platform === 'win32';
const migrationRetries = 6;
const retryDelaysMs = [5000, 10000, 15000, 30000, 30000];

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell, env: process.env });
    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (error) => {
      const text = `${error.message}\n`;
      output += text;
      process.stderr.write(text);
      resolve({ code: 1, output });
    });
  });
}

function isTransientMigrationLock(output) {
  return output.includes('P1002') || output.toLowerCase().includes('advisory lock');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrationWithRetry() {
  for (let attempt = 1; attempt <= migrationRetries; attempt += 1) {
    process.stdout.write(`==> Running Prisma migrations, attempt ${attempt}/${migrationRetries}\n`);
    const result = await run('npx', ['prisma', 'migrate', 'deploy']);
    if (result.code === 0) return;
    if (!isTransientMigrationLock(result.output) || attempt === migrationRetries) process.exit(result.code);
    const delay = retryDelaysMs[attempt - 1] ?? 30000;
    process.stdout.write(`==> Migration lock is busy. Retrying in ${Math.round(delay / 1000)}s...\n`);
    await wait(delay);
  }
}

async function main() {
  await runMigrationWithRetry();

  const seed = await run('npm', ['run', 'prisma:seed']);
  if (seed.code !== 0) process.exit(seed.code);

  const api = spawn('node', ['dist/src/main.js'], { shell, env: process.env, stdio: 'inherit' });
  api.on('close', (code) => process.exit(code ?? 1));
  api.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

void main();
