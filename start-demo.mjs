import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const release = '20260914';
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'PraxisClass');
const tooling = path.join(root, '.tools');
const store = path.join(tooling, 'store');
const pnpm = path.join(tooling, 'pnpm/package/bin/pnpm.cjs');
const localEnvPath = path.join(source, '.env.local');
const statePath = path.join(tooling, 'local-deployment.json');
const composeFile = path.join(tooling, 'postgres.compose.yml');
const prepared = path.join(tooling, `prepared-${release}-${process.platform}-${process.arch}.yaml`);
const lockfile = path.join(source, 'pnpm-lock.yaml');
const args = new Set(process.argv.slice(2));
const env = {
  ...process.env,
  PATH: [path.join(tooling, 'bin'), path.dirname(process.execPath), process.env.PATH || ''].join(path.delimiter),
  NEXT_TELEMETRY_DISABLED: '1',
  COREPACK_ENABLE_NETWORK: '0',
  npm_config_registry: 'https://registry.npmjs.org/',
};

function portNumber(value, name) {
  const text = String(value);
  if (!/^\d+$/.test(text) || Number(text) < 1024 || Number(text) > 65535) {
    throw new Error(`${name} must be between 1024 and 65535.`);
  }
  return text;
}

function run(exe, commandArgs, cwd = source, commandEnv = env) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, commandArgs, { cwd, env: commandEnv, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 || signal === 'SIGINT') resolve();
      else reject(new Error(`${path.basename(exe)} exited with ${code ?? signal}.`));
    });
  });
}

const pm = commandArgs => run(process.execPath, [pnpm, ...commandArgs]);
function loadState() {
  return fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
}
function composeArgs(state, ...tail) {
  return ['compose', '--project-name', state.project, '--file', composeFile, ...tail];
}
function composeEnv(state) {
  return { ...env, PRAXIS_LOCAL_PG_PASSWORD: state.password, PRAXIS_LOCAL_PG_PORT: String(state.port) };
}
function checkDocker() {
  const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    env, stdio: 'pipe', encoding: 'utf8', windowsHide: true, timeout: 15000,
  });
  if (result.error || result.status !== 0) {
    throw new Error('Start Docker Desktop before launching this package. See README-部署.md.');
  }
}

function prepareLocalConfiguration() {
  // Existing configurations are preserved. Fresh packages receive their own local
  // database and demo persistence token; no developer credentials are bundled.
  if (!fs.existsSync(localEnvPath)) {
    let state = loadState();
    if (!state) {
      state = {
        project: `praxisclass-internal-${release}-${randomBytes(4).toString('hex')}`,
        password: randomBytes(24).toString('hex'),
        token: randomBytes(24).toString('hex'),
        port: portNumber(process.env.PRAXIS_PG_PORT || '55414', 'PRAXIS_PG_PORT'),
      };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    const overrides = {
      PRAXIS_ENABLE_VOCATIONAL: 'true',
      NEXT_PUBLIC_SHOW_VOCATIONAL_TEST_UI: 'true',
      NEXT_PUBLIC_ENABLE_PPTX_IMPORT: 'true',
      NEXT_PUBLIC_PRAXIS_EDITOR_ENABLED: 'true',
      NEXT_PUBLIC_PRO_WORKBENCH_ENABLED: 'true',
      PRAXIS_AGENT_RUNTIME_ENABLED: 'true',
      DATABASE_URL: `postgresql://praxis:${state.password}@127.0.0.1:${state.port}/praxis`,
      PERSISTENCE_DEV_TOKEN: state.token,
      NEXT_PUBLIC_PERSISTENCE: '1',
      NEXT_PUBLIC_PERSISTENCE_TOKEN: state.token,
    };
    const template = fs.readFileSync(path.join(source, '.env.example'), 'utf8');
    fs.writeFileSync(localEnvPath, template + '\n# Local package settings; generated on this computer.\n' +
      Object.entries(overrides).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  const config = parseEnv(fs.readFileSync(localEnvPath, 'utf8'));
  Object.assign(env, config);
  // Business files belong to this extracted copy. Explicit custom data locations
  // in a user's .env.local remain supported.
  if (!config.PLATFORM_DATA_DIR) env.PLATFORM_DATA_DIR = path.join(source, 'data');
  return config;
}

async function ensureDatabase(config) {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is missing in PraxisClass/.env.local.');
  if (config.NEXT_PUBLIC_PERSISTENCE === '1' && (!config.PERSISTENCE_DEV_TOKEN || config.PERSISTENCE_DEV_TOKEN !== config.NEXT_PUBLIC_PERSISTENCE_TOKEN)) {
    throw new Error('The two persistence tokens in PraxisClass/.env.local must be nonempty and match.');
  }
  const state = loadState();
  const managedUrl = state && `postgresql://praxis:${state.password}@127.0.0.1:${state.port}/praxis`;
  if (state && config.DATABASE_URL === managedUrl) {
    checkDocker();
    console.log('[Database] Starting this package\'s PostgreSQL (existing data is retained)...');
    await run('docker', composeArgs(state, 'up', '-d', '--wait', '--wait-timeout', '90'), root, composeEnv(state));
  }
  // Validate a real database connection, not merely an open TCP port. Credentials
  // and database connection errors are intentionally not echoed to the terminal.
  const pgPath = path.join(source, 'node_modules/pg/lib/index.js');
  await run(process.execPath, ['--input-type=module', '-e',
    'const pg = (await import(process.argv[1])).default; const client = new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000}); try {await client.connect(); await client.query("SELECT 1"); console.log("[Database] Connection verified.");} catch {console.error("Database connection failed. Check Docker Desktop and PraxisClass/.env.local."); process.exitCode=1;} finally {await client.end().catch(()=>{});}',
    pathToFileURL(pgPath).href]);
}

try {
  for (const required of [pnpm, lockfile, path.join(tooling, 'dependencies.tar.gz'), composeFile]) {
    if (!fs.existsSync(required)) throw new Error(`Package file missing: ${path.relative(root, required)}. Extract the complete ZIP again.`);
  }
  if (args.has('--check')) {
    console.log(`PraxisClass ${release}: bundled Node ${process.version}, ${process.platform}/${process.arch}; required package files found.`);
    process.exit(0);
  }
  if (args.has('--stop')) {
    const state = loadState();
    if (state) { checkDocker(); await run('docker', composeArgs(state, 'stop'), root, composeEnv(state)); }
    console.log('Package database stopped. Saved data was retained.');
    process.exit(0);
  }
  const prepareOnly = args.has('--prepare-only');
  if (!prepareOnly && (!fs.existsSync(localEnvPath) || loadState())) checkDocker();
  if (!fs.existsSync(path.join(store, '.extracted'))) {
    console.log('[1/3] Extracting bundled offline dependencies...');
    fs.mkdirSync(store, { recursive: true });
    await run('tar', ['-xzf', path.join(tooling, 'dependencies.tar.gz'), '-C', store], root);
    fs.writeFileSync(path.join(store, '.extracted'), release + '\n');
  }
  const ready = fs.existsSync(prepared) && fs.existsSync(path.join(source, 'node_modules/.modules.yaml')) &&
    fs.readFileSync(prepared, 'utf8') === fs.readFileSync(lockfile, 'utf8');
  if (!ready) {
    console.log('[2/3] Installing the frozen dependencies from the bundled cache...');
    await pm(['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--store-dir', store, '--reporter', 'append-only']);
    console.log('[3/3] Building the local course components...');
    await pm(['run', 'postinstall']);
    fs.copyFileSync(lockfile, prepared);
  }
  await pm(['run', 'gen:training']);
  if (prepareOnly) {
    console.log('Offline dependency setup, workspace builds and training resources completed.');
    process.exit(0);
  }
  const config = prepareLocalConfiguration();
  await ensureDatabase(config);
  const port = portNumber(process.env.PRAXIS_DEMO_PORT || '3210', 'PRAXIS_DEMO_PORT');
  console.log(`\nOpen http://127.0.0.1:${port}/portal`);
  console.log('Enter model settings separately on the teacher/student side. Chrome is needed for browser interaction checks.');
  console.log('Keep this terminal open. Press Ctrl+C to stop the app; run the stop launcher to stop the database.\n');
  await pm(['run', 'dev', '--hostname', '127.0.0.1', '--port', port]);
} catch (error) {
  console.error('\nStartup failed: ' + error.message);
  console.error('See README-部署.md. Keep the complete extracted directory and the error message.');
  process.exitCode = 1;
}
